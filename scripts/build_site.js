// 把微信小程序核心(utils/*.js) + 网页壳 打包成单文件浏览器版 preview/site_app.html
// 用法: node scripts/build_site.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 「开练」示范覆盖通道：打包时扫描 docs/media/kailian/，把 <动作名>.<gif|mp4|webm> 映射成
// media/kailian/<file>，注入为 window.__KAILIAN，供 data.js 优先覆盖 ExerciseDB 的图。无该目录则为空对象。
var KAILIAN_MAP = {};
var klDir = path.join(ROOT, 'docs', 'media', 'kailian');
if (fs.existsSync(klDir)) {
  fs.readdirSync(klDir).forEach(function (f) {
    var m = f.match(/^(.+)\.(gif|mp4|webm)$/i);
    if (m) KAILIAN_MAP[m[1]] = 'media/kailian/' + f;
  });
}

// 1) 源码模块（含依赖顺序，惰性加载）
const MODS = ['media_map.js', 'media_local.js', 'gif_map.js', 'zh_steps.js', 'data.js', 'plan.js'];
// 网页版把 GIF 的 CDN 地址改写为本地相对路径 media/<id>.gif（本地已做统一底色处理）；
// 小程序端共用同一 gif_map.js 源文件，仍走远程，不受影响。
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/sovanndevid/my-exercisedb@main/media/';
const modContent = n => n === 'gif_map.js' ? read('utils/' + n).split(CDN_BASE).join('media/') : read('utils/' + n);

// 2) mini-CommonJS loader
const loader = `(function () {
  window.__KAILIAN = ${JSON.stringify(KAILIAN_MAP)};
  var __fact = {};
  var __cache = {};
  function __r(n) {
    n = n.replace(/^\\.\\//, '');
    if (__cache[n]) return __cache[n].exports;
    var m = { exports: {} };
    __cache[n] = m;
    __fact[n](m, m.exports, __r);
    return m.exports;
  }
  ${MODS.map(name => `__fact[${JSON.stringify(name)}] = new Function('module', 'exports', 'require', ${JSON.stringify(modContent(name))});`).join('\n  ')}
  var __d = __r('data.js'), __p = __r('plan.js');
  window.__NS = {
    courses: __d.courses, ACTION_CUE: __d.ACTION_CUE, ACT_LIB: __d.ACT_LIB, actionByName: __d.actionByName,
    generatePlan: __p.generatePlan, computeGoal: __p.computeGoal, PHASES: __p.PHASES
  };
})();
`;

const ui = read('scripts/site_src/ui.html');
const app = read('scripts/site_src/app.js');

const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>健身教练 · 网页版预览</title>
<meta name="theme-color" content="#1FD6A8">
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icon-192.png">
<style>
/* ===== 桌面舞台 ===== */
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
body { background: linear-gradient(135deg, #1a2029 0%, #0f1419 100%); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
</style>
${ui}
<script>
${loader}
</script>
</head>
<body>
<div class="phone"><div id="app"></div></div>
<script>
${app}
</script>
<script>
/* PWA：Service Worker 注册（仅 https / localhost，file:// 预览静默跳过） */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
</script>
</body>
</html>
`;

const out = path.join(ROOT, 'preview', 'site_app.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('written', out, (html.length / 1024).toFixed(0) + 'KB');

/* ===== PWA 资产：manifest + Service Worker（缓存版本取 index.html 内容 hash）===== */
var crypto = require('crypto');
var cv = 'fit-' + crypto.createHash('md5').update(html).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(ROOT, 'docs', 'manifest.json'), JSON.stringify({
  name: '健身教练', short_name: '健身教练',
  description: '144 个真人示范动作 · AI 4 周计划 · HIIT 计时 · 打卡与趋势',
  start_url: './index.html', scope: './', display: 'standalone',
  background_color: '#0f1419', theme_color: '#1FD6A8',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ]
}, null, 2));
console.log('written docs/manifest.json');

var sw = `/* 健身教练 Service Worker · cache ${cv}（由 build_site.js 生成，勿手改） */
var CV = '${cv}';
var SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CV).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CV; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return; // 只管同源 GET
  if (u.pathname.indexOf('/media/') >= 0) {
    // GIF 媒体：缓存优先，首次取回后入缓存（离线可跟练的关键）
    e.respondWith(caches.open(CV).then(function (c) {
      return c.match(e.request).then(function (r) {
        if (r) return r;
        return fetch(e.request).then(function (resp) {
          if (resp.ok) c.put(e.request, resp.clone());
          return resp;
        });
      });
    }));
    return;
  }
  // 页面/资产：网络优先（保证更新），断网回退缓存；导航请求兜底到 index.html
  e.respondWith(fetch(e.request).then(function (resp) {
    if (resp.ok) { var cl = resp.clone(); caches.open(CV).then(function (c) { c.put(e.request, cl); }); }
    return resp;
  }).catch(function () {
    return caches.match(e.request).then(function (r) {
      return r || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined);
    });
  }));
});
`;
fs.writeFileSync(path.join(ROOT, 'docs', 'sw.js'), sw);
console.log('written docs/sw.js (cache', cv + ')');

// 同步三份产物（preview/site_app.html + preview/index.html + docs/index.html），
// 保证本地预览与 GitHub Pages 三端字节一致（md5 相同）。
const targets = [
  path.join(ROOT, 'preview', 'index.html'),
  path.join(ROOT, 'docs', 'index.html')
];
targets.forEach(function (t) {
  fs.mkdirSync(path.dirname(t), { recursive: true });
  fs.copyFileSync(out, t);
  console.log('synced', t);
});

// 同步静态媒体目录 docs/media → preview/media（含开练覆盖通道的 docs/media/kailian/），保证本地预览与 Pages 一致
// 注：fs.cpSync 在本机（含子目录的媒体树）会卡死，改用稳健的逐文件镜像复制
function mirrorCopy(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  var srcFiles = fs.readdirSync(srcDir);
  fs.readdirSync(dstDir).forEach(function (f) {
    if (srcFiles.indexOf(f) < 0) { try { fs.rmSync(path.join(dstDir, f), { recursive: true, force: true }); } catch (e) {} }
  });
  srcFiles.forEach(function (f) {
    var sp = path.join(srcDir, f), dp = path.join(dstDir, f);
    if (fs.statSync(sp).isDirectory()) mirrorCopy(sp, dp);
    else fs.copyFileSync(sp, dp);
  });
}
var mediaSrc = path.join(ROOT, 'docs', 'media');
var mediaDst = path.join(ROOT, 'preview', 'media');
if (fs.existsSync(mediaSrc)) {
  mirrorCopy(mediaSrc, mediaDst);
  console.log('synced media', mediaSrc);
}
