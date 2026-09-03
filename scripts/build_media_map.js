// 从 WGER (https://wger.de, LGPL 开源，免鉴权) 生成动作演示图映射 utils/media_map.js
// 策略：WGER 图库对「基础动作」覆盖好，但「变式/瑜伽/有氧」基本无图。
//   自动子串匹配在图库不全时会误匹配（如俯卧撑变式张冠李戴），故采用「手工精校 id 表」
//   —— 每个中文动作直接对应 WGER 里一个名字正确的真实动作图；变式俯卧撑共用通用 Push-Up 图。
//   图 URL 从 WGER 缓存（wger_cache.json）按 id 精确取出，零硬编码。
// 用法: node scripts/build_media_map.js   （加 --probe 只打印不写文件）
const https = require('https');
const fs = require('fs');
const path = require('path');

// 中文动作名 -> WGER exercise id（对照 WGER 真实动作名手工选定，保证名字正确、零误匹配）
// 变式俯卧撑(钻石/宽距/上斜/窄距)共用 1551 Push-Up（WGER 无细分图，共用通用图优于火柴人）
const PICK = {
  '卷腹': 167,           // Crunches
  '平板支撑': 458,       // Plank
  '俄罗斯转体': 1193,    // Russian Twist
  '仰卧抬腿': 377,       // Leg raises, lying
  '仰卧交替抬腿': 377,   // Leg raises, lying
  '左侧平板': 2509,      // Side Plank (Core L1)
  '右侧平板': 2509,      // Side Plank (Core L1)
  '开合跳': 320,         // Jumping Jacks
  '高抬腿': 983,         // High Knees
  '仰卧起坐': 1479,      // Sit Up Elbow Thrust
  '弓步蹲': 984,         // Lunges
  '婴儿式': 1002,        // Child's Pose
  '标准俯卧撑': 1551,    // Push-Up
  '钻石俯卧撑': 1551,    // Push-Up（WGER 无细分，共用）
  '宽距俯卧撑': 1551,    // Push-Up（WGER 无细分，共用）
  '上斜俯卧撑': 1551,    // Push-Up（WGER 无细分，共用）
  '窄距俯卧撑': 1551,    // Push-Up（WGER 无细分，共用）
  '等长收缩': 1733,      // Isometric Squat to Failure
  '水瓶飞鸟': 238,       // Fly with Dumbbells
  '深蹲': 203,           // Dumbbell Goblet Squat
  '深蹲跳': 203,         // 借深蹲图（同属蹲类）
  '臀桥': 265,           // Glute Bridge
  '箭步蹲': 984,         // Lunges
  '跪姿后抬腿': 1616,    // Dumbbell Donkey Kick
  '后踢腿': 990,         // Kneeling Kickbacks
  '原地踏步': 1965       // Marching High Knees
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CACHE = path.join(__dirname, 'wger_cache.json');

async function fetchAll(base) {
  let all = [];
  let offset = 0;
  const limit = 50;
  while (true) {
    const sep = base.includes('?') ? '&' : '?';
    const u = `${base}${sep}format=json&limit=${limit}&offset=${offset}`;
    const { body } = await get(u);
    const j = JSON.parse(body);
    all = all.concat(j.results || []);
    if (!j.next) break;
    offset += limit;
    await sleep(60);
  }
  return all;
}
async function fetchInfo(ids) {
  const idToName = {};
  const idToImg = {};
  const CONC = 6;
  for (let i = 0; i < ids.length; i += CONC) {
    const batch = ids.slice(i, i + CONC);
    await Promise.all(batch.map(async id => {
      try {
        const { status, body } = await get(`https://wger.de/api/v2/exerciseinfo/${id}/?format=json`);
        if (status !== 200) return;
        const j = JSON.parse(body);
        const tr = j.translations || [];
        const en = tr.find(t => t.language === 2) || tr[0];
        idToName[id] = (en && en.name) || '';
        const imgs = j.images || [];
        if (imgs.length) {
          const im = imgs.find(x => x.is_main) || imgs[0];
          idToImg[id] = (im.thumbnails && im.thumbnails.medium) || im.image;
        }
      } catch (e) { /* skip */ }
    }));
    await sleep(80);
  }
  return { idToName, idToImg };
}
async function loadWger() {
  if (fs.existsSync(CACHE)) {
    console.log('使用本地缓存', CACHE);
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  }
  console.log('拉取动作图列表...');
  const images = await fetchAll('https://wger.de/api/v2/exerciseimage/');
  const ids = [...new Set(images.map(im => im.exercise).filter(Boolean))];
  console.log(`有图动作 ${ids.length} 个，并发查英文名 + 图片...`);
  const { idToName, idToImg } = await fetchInfo(ids);
  fs.writeFileSync(CACHE, JSON.stringify({ idToName, idToImg }));
  console.log('已写入缓存', CACHE);
  return { idToName, idToImg };
}

(async () => {
  const { idToName, idToImg } = await loadWger();
  const out = {};
  for (const zh of Object.keys(PICK)) {
    const id = PICK[zh];
    const url = idToImg[id];
    const wgerName = idToName[id] || '(未知名)';
    if (url) {
      out[zh] = url;
      console.log('OK  ', zh, '<= [', id, ']', wgerName);
    } else {
      console.log('WARN', zh, 'WGER id', id, '无图或被吞:', wgerName || '(无此id/404)');
    }
  }
  const probe = process.argv.includes('--probe');
  if (!probe) {
    const header = '// 自动生成，请勿手改。来源 WGER (https://wger.de, LGPL)。重跑 scripts/build_media_map.js 刷新。\nmodule.exports = ';
    const body = JSON.stringify(out, null, 2) + ';\n';
    fs.writeFileSync(path.join(__dirname, '..', 'utils', 'media_map.js'), header + body);
  }
  console.log('\n命中', Object.keys(out).length, '/', Object.keys(PICK).length, probe ? '(仅诊断)' : '(已写入 media_map.js)');
})();
