// 把 WGER 真人示范图下载到工程本地，供小程序离线/真机直接显示（像 Keep 一样打开即有照片）。
// 用法: node scripts/download_media.js
// 输入: utils/media_map.js (中文动作名 -> WGER 图片 URL)
// 输出: assets/actions/<imageId>.<ext>  +  utils/media_local.js (中文动作名 -> 本地路径)
const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSET_DIR = path.join(ROOT, 'assets', 'actions');
const mediaMap = require(path.join(ROOT, 'utils', 'media_map.js'));

if (!fs.existsSync(ASSET_DIR)) fs.mkdirSync(ASSET_DIR, { recursive: true });

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      // 跟随一次重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP ' + res.statusCode + ' ' + url));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function extFromBuffer(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf.slice(0, 4).toString() === 'RIFF') return 'webp';
  return 'png';
}

function imageIdFromUrl(url) {
  const m = url.match(/\/exercise-images\/(\d+)\//);
  return m ? m[1] : String(Math.abs(hashCode(url)));
}
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return h;
}

(async () => {
  // 去重: 同一 URL 只下载一次
  const urlToFile = {}; // url -> filename
  const seen = new Set();
  const jobs = [];
  for (const name of Object.keys(mediaMap)) {
    const url = mediaMap[name];
    if (seen.has(url)) continue;
    seen.add(url);
    const id = imageIdFromUrl(url);
    const file = id + '.__tmp'; // 先占位, 下载后按真实格式改名
    urlToFile[url] = { file, id };
    jobs.push({ url, id });
  }

  let totalBytes = 0;
  const nameToLocal = {}; // 中文名 -> 本地路径
  for (const { url, id } of jobs) {
    try {
      const buf = await get(url);
      const ext = extFromBuffer(buf);
      const fname = id + '.' + ext;
      fs.writeFileSync(path.join(ASSET_DIR, fname), buf);
      totalBytes += buf.length;
      // 回填所有用到这个 URL 的动作名
      for (const name of Object.keys(mediaMap)) {
        if (mediaMap[name] === url) nameToLocal[name] = '/assets/actions/' + fname;
      }
      console.log('OK  ', id + '.' + ext, (buf.length / 1024).toFixed(1) + 'KB', '<-', url.slice(0, 60));
    } catch (e) {
      console.log('FAIL', url, e.message);
    }
  }

  // 写本地映射
  const out = '// 自动生成, 请勿手改。由 scripts/download_media.js 依据 media_map.js 下载生成。\nmodule.exports = ' +
    JSON.stringify(nameToLocal, null, 2) + ';\n';
  fs.writeFileSync(path.join(ROOT, 'utils', 'media_local.js'), out);

  // 清理临时占位文件(若有)
  fs.readdirSync(ASSET_DIR).forEach(f => { if (f.endsWith('.__tmp')) fs.unlinkSync(path.join(ASSET_DIR, f)); });

  console.log('\n=== 下载完成 ===');
  console.log('图片数:', jobs.length, '| 动作映射数:', Object.keys(nameToLocal).length);
  console.log('本地图片总体积:', (totalBytes / 1024).toFixed(1) + 'KB', '(' + (totalBytes / 1024 / 1024).toFixed(2) + 'MB)');
  console.log('主包代码 ~238KB + 图片 =', ((238 * 1024 + totalBytes) / 1024 / 1024).toFixed(2) + 'MB (上限 2MB)');
})();
