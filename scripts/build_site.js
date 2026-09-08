// 把微信小程序核心(utils/*.js) + 网页壳 打包成单文件浏览器版 preview/site_app.html
// 用法: node scripts/build_site.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 1) 源码模块（含依赖顺序，惰性加载）
const MODS = ['media_map.js', 'media_local.js', 'gif_map.js', 'data.js', 'plan.js'];
// 网页版把 GIF 的 CDN 地址改写为本地相对路径 media/<id>.gif（本地已做统一底色处理）；
// 小程序端共用同一 gif_map.js 源文件，仍走远程，不受影响。
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/sovanndevid/my-exercisedb@main/media/';
const modContent = n => n === 'gif_map.js' ? read('utils/' + n).split(CDN_BASE).join('media/') : read('utils/' + n);

// 2) mini-CommonJS loader
const loader = `(function () {
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
</body>
</html>
`;

const out = path.join(ROOT, 'preview', 'site_app.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('written', out, (html.length / 1024).toFixed(0) + 'KB');

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
