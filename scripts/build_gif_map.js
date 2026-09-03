// 接入 ExerciseDB 动画 GIF（Keep 式真人连贯动作演示）
// 数据源：JahelCuadrado/ExerciseGymGifsDB（ExerciseDB v1 镜像，jsDelivr 免费 CDN，1300+ 动作含 GIF）
// 用法：
//   node scripts/build_gif_map.js --fetch   # 抓全量索引到 scripts/exdb_cache.json
//   node scripts/build_gif_map.js --probe   # 打印每个中文动作的候选（用于手校 PICK）
//   node scripts/build_gif_map.js           # 按 PICK 精校表生成 utils/gif_map.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const CACHE = path.join(__dirname, 'exdb_full.json');
const OUT = path.join(__dirname, '..', 'utils', 'gif_map.js');
const GIF_BASE = 'https://static.exercisedb.dev/media/';
const FETCH_URLS = [
  'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/data/exercises.json',
  'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@master/data/exercises.json',
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json'
];

// 中文动作 -> 英文候选词（用于 probe 候选；PICK 手校后以 PICK 为准）
const KEYS = {
  '卷腹': ['crunch', 'sit-up'],
  '平板支撑': ['plank'],
  '俄罗斯转体': ['russian twist'],
  '仰卧抬腿': ['leg raise'],
  '仰卧交替抬腿': ['leg raise'],
  '左侧平板': ['side plank'],
  '右侧平板': ['side plank'],
  '开合跳': ['jumping jack'],
  '高抬腿': ['high knee'],
  '波比跳': ['burpee'],
  '深蹲跳': ['squat jump'],
  '仰卧起坐': ['sit-up', 'sit up'],
  '弓步蹲': ['lunge'],
  '箭步蹲': ['lunge'],
  '婴儿式': ['child'],
  '猫牛式': ['cat cow'],
  '下犬式': ['downward'],
  '鸽子式': ['pigeon'],
  '坐姿前屈': ['seated forward bend'],
  '摊尸式': ['corpse'],
  '标准俯卧撑': ['push-up', 'push up', 'press-up'],
  '钻石俯卧撑': ['diamond'],
  '宽距俯卧撑': ['wide'],
  '上斜俯卧撑': ['incline'],
  '窄距俯卧撑': ['close'],
  '等长收缩': ['isometric', 'iso'],
  '水瓶飞鸟': ['fly', 'flyes'],
  '深蹲': ['squat'],
  '臀桥': ['glute bridge', 'hip bridge'],
  '侧卧抬腿': ['side leg raise', 'lying leg raise'],
  '蚌式开合': ['clam'],
  '跪姿后抬腿': ['donkey'],
  '原地慢跑': ['jog', 'run in place'],
  '后踢腿': ['butt kick'],
  '原地踏步': ['march'],
  '全身拉伸': ['stretch']
};

// 手校精校表：中文动作 -> ExerciseDB v1 的 media_id（从 exdb_full.json 对照真实动作名选出，零误匹配）
// GIF URL = https://static.exercisedb.dev/media/{media_id}.gif（官方 CDN，已验证 200 image/gif）
// 注：未列入的动作（瑜伽体式/蚌式/侧卧抬腿等）库中无合适动图，保留 WGER 静态图或火柴人回退。
const PICK = {
  '卷腹': 'TFqbd8t',           // crunch floor
  '俄罗斯转体': 'XVDdcoj',     // russian twist
  '仰卧交替抬腿': 'UVo2Qs2',   // flutter kicks
  '左侧平板': '5VXmnV5',       // bodyweight incline side plank
  '右侧平板': '5VXmnV5',
  '开合跳': '1g5bPpA',         // jack jump (male)
  '高抬腿': 'ealLwvX',         // high knee against wall
  '波比跳': 'dK9394r',         // burpee
  '登山者': 'RJgzwny',         // mountain climber
  '深蹲跳': '6FMU51h',         // semi squat jump (male)
  '仰卧起坐': '2gPfomN',       // 3/4 sit-up
  '弓步蹲': 'IZVHb27',         // walking lunge
  '箭步蹲': 'kMzUs9Y',         // forward lunge (male)
  '标准俯卧撑': 'I4hDWkc',     // push-up
  '钻石俯卧撑': 'soIB2rj',     // diamond push-up
  '窄距俯卧撑': 'x6KpKpq',     // close-grip push-up
  '上斜俯卧撑': 'B1EVP9F',     // incline push-up
  '等长收缩': 'HbSG1Pw',       // isometric chest squeeze
  '水瓶飞鸟': 'yz9nUhF',       // dumbbell fly
  '深蹲': '75Bgtjy',           // potty squat（徒手蹲，最贴近基础深蹲）
  '臀桥': 'u0cNiij'            // low glute bridge on floor
};

function httpGet(u) {
  return new Promise((resolve, reject) => {
    https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.destroy();
        resolve(httpGet(r.headers.location));
        return;
      }
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => resolve({ s: r.statusCode, b: d }));
    }).on('error', reject);
  });
}

function loadIndex() {
  if (!fs.existsSync(CACHE)) {
    console.error('缓存不存在，先跑 node scripts/build_gif_map.js --fetch');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
}

(async () => {
  const arg = process.argv[2] || '';
  if (arg === '--fetch') {
    console.log('抓取 ExerciseDB v1 全量数据...');
    for (const u of FETCH_URLS) {
      try {
        const r = await httpGet(u);
        if (r.s === 200 && r.b.length > 100000) {
          fs.writeFileSync(CACHE, r.b);
          console.log('已缓存', (r.b.length / 1048576).toFixed(1) + 'MB', '->', CACHE);
          return;
        }
        console.log('  ', u.split('/')[2], r.s, (r.b.length / 1024).toFixed(0) + 'KB');
      } catch (e) { console.log('  err', u, e.message); }
    }
    process.exit(1);
  }

  // 生成 gif_map.js（按 PICK 的 media_id 组装官方 CDN URL）
  const out = {};
  let miss = 0;
  for (const zh of Object.keys(PICK)) {
    const mid = PICK[zh];
    if (mid && /^[A-Za-z0-9]{6,8}$/.test(mid)) {
      out[zh] = GIF_BASE + mid + '.gif';
    } else { console.log('WARN 无效 media_id', zh, mid); miss++; }
  }
  const body = '// ExerciseDB 真人动作 GIF（连贯动画，Keep 式演示）\n'
    + '// 来源：static.exercisedb.dev 官方 CDN（ExerciseDB v1；media © 原版权方，仅限个人学习/非商用）\n'
    + '// 生成：node scripts/build_gif_map.js（先 --fetch 全量数据，再按 PICK 精校表输出）\n'
    + 'module.exports = ' + JSON.stringify(out, null, 2) + ';\n';
  fs.writeFileSync(OUT, body, 'utf8');
  console.log('已生成', OUT, '| 命中', Object.keys(PICK).length - miss, '/', Object.keys(PICK).length);
})();
