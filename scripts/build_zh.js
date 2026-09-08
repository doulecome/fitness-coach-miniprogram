// 从 exercises-dataset（hasaneyldrm/exercises-dataset，MIT 结构 / 媒体 © Gym visual）抽取
// 我们 48 个动作的中文分步说明，生成 utils/zh_steps.js 供 data.js 挂载到动作上。
// 只取文本层（说明 + 分步），不拉 GIF（与现有 ExerciseDB 真人 GIF 同源，重复下载无意义）。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// 每个动作对应的英文关键词（用于模糊匹配数据集条目名），优先用最短/最中性的匹配
const KW = {
  '卷腹': ['crunch'],
  '仰卧举腿': ['reverse crunch', 'lying leg raise', 'leg raise'],
  '俄罗斯转体': ['russian twist'],
  '登山者': ['mountain climber'],
  '仰卧交替抬腿': ['flutter kick', 'alternating leg raise'],
  '左侧平板': ['side plank'],
  '右侧平板': ['side plank'],
  '死虫式': ['dead bug'],
  '开合跳': ['jumping jack', 'star jump'],
  '高抬腿': ['high knee'],
  '波比跳': ['burpee'],
  '弓步跳': ['lunge jump', 'jumping lunge', 'jump lunge'],
  '深蹲跳': ['squat jump'],
  '仰卧起坐': ['sit up', 'sit-up'],
  '弓步蹲': ['lunge'],
  '仰卧臀腿拉伸': ['piriformis', 'glute stretch'],
  '仰卧梨状肌拉伸': ['piriformis'],
  '蝴蝶式': ['butterfly'],
  '俯卧大腿前侧拉伸': ['quadriceps stretch', 'quad stretch'],
  '俯卧腿后侧拉伸': ['hamstring'],
  '侧卧大腿内侧拉伸': ['adductor', 'inner thigh'],
  '肩胸拉伸': ['chest stretch'],
  '速滑跳': ['skater'],
  '哑铃侧平举': ['lateral raise'],
  '哑铃卧推': ['dumbbell bench', 'chest press'],
  '哑铃肩推': ['shoulder press', 'overhead press'],
  '高脚杯深蹲': ['goblet'],
  '哑铃硬拉': ['dumbbell deadlift'],
  '壶铃摇摆': ['kettlebell swing'],
  '保加利亚分腿蹲': ['bulgarian split', 'bulgarian'],
  '哑铃划船': ['dumbbell row', 'bent over row', 'one arm row', 'single arm row'],
  '弹力带下拉': ['pulldown', 'pull-down', 'pull down'],
  '引体向上': ['pull up', 'pull-up', 'chin up'],
  '弹力带面拉': ['face pull', 'rear delt'],
  '锤式弯举': ['hammer curl'],
  '臀桥': ['glute bridge', 'hip thrust'],
  '站姿提踵': ['calf raise'],
  '深蹲': ['squat'],
  '臀桥踏步': ['glute bridge march', 'glute bridge'],
  '屈膝礼蹲': ['curtsy lunge', 'curtsy'],
  '箭步蹲': ['lunge'],
  '等长收缩': ['isometric'],
  '哑铃飞鸟': ['dumbbell fly'],
  '上斜俯卧撑': ['incline push'],
  '标准俯卧撑': ['push up', 'push-up'],
  '窄距俯卧撑': ['close grip push', 'close-grip push'],
  '下斜俯卧撑': ['decline push'],
  '钻石俯卧撑': ['diamond push']
};

const src = path.join(ROOT, 'scripts', 'dset', 'exercises.json');
if (!fs.existsSync(src)) { console.error('缺少 exercises.json，先下载到 scripts/dset/'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(src, 'utf8'));

// 建索引：按名小写 → 条目；同时保留所有候选（便于最短匹配）
const byName = {};
data.forEach(function (e) {
  const key = String(e.name || '').toLowerCase().trim();
  if (key && !byName[key]) byName[key] = e;
});

function findEntry(zh) {
  const kws = KW[zh] || [];
  // 先试精确
  for (let i = 0; i < kws.length; i++) {
    const ex = byName[kws[i].toLowerCase().trim()];
    if (ex) return ex;
  }
  // 模糊：搜集所有含任一关键词的条目，挑最短且有中文内容的
  let cands = [];
  data.forEach(function (e) {
    const n = String(e.name || '').toLowerCase();
    for (let i = 0; i < kws.length; i++) {
      if (n.indexOf(kws[i]) >= 0) { cands.push(e); break; }
    }
  });
  cands.sort(function (a, b) { return a.name.length - b.name.length; });
  for (let i = 0; i < cands.length; i++) {
    const steps = (cands[i].instruction_steps && cands[i].instruction_steps.zh) || [];
    if (steps.length || (cands[i].instructions && cands[i].instructions.zh)) return cands[i];
  }
  return null;
}

let hit = 0, miss = 0;
const out = {};
Object.keys(KW).forEach(function (zh) {
  const entry = findEntry(zh);
  if (!entry) { miss++; return; }
  const steps = (entry.instruction_steps && entry.instruction_steps.zh) || [];
  const desc = (entry.instructions && entry.instructions.zh) || '';
  if (!steps.length && !desc) { miss++; return; }
  out[zh] = { steps: steps, desc: desc };
  hit++;
});

const outPath = path.join(ROOT, 'utils', 'zh_steps.js');
const body = '// 自动生成：scripts/build_zh.js（来源 hasaneyldrm/exercises-dataset，中文分步说明）。请勿手改。\n' +
  'module.exports = ' + JSON.stringify(out, null, 0) + ';\n';
fs.writeFileSync(outPath, body, 'utf8');
console.log('匹配 ' + hit + ' 个动作，未匹配 ' + miss + ' 个 → ' + outPath);
