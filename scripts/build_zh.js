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
  '钻石俯卧撑': ['diamond push'],
  // v5 扩充动作库（24 个，全部经 discover_new.py 验证含 GIF + 中文分步）
  '高位下拉': ['lat pulldown', 'pulldown', 'pull down', 'pull-down'],
  '坐姿划船': ['seated row', 'cable row', 'seated cable row'],
  '反向飞鸟': ['reverse fly', 'rear delt fly', 'rear deltoid'],
  '前平举': ['front raise', 'front dumbbell raise'],
  '俯身侧平举': ['bent over lateral raise', 'bent-over lateral raise', 'rear lateral raise'],
  '阿诺德推举': ['arnold press', 'arnold dumbbell press'],
  '弹力带肩推': ['resistance band shoulder press', 'band shoulder press', 'band overhead press'],
  '上斜哑铃卧推': ['incline dumbbell press', 'incline chest press'],
  '双杠臂屈伸': ['dips', 'chest dips', 'bodyweight dips'],
  '哑铃弯举': ['dumbbell curl', 'bicep curl'],
  '集中弯举': ['concentration curl'],
  '哑铃颈后臂屈伸': ['overhead triceps extension', 'dumbbell overhead triceps'],
  '仰卧臂屈伸': ['lying triceps extension', 'skull crusher', 'supine triceps'],
  '弹力带下压': ['resistance band triceps pushdown', 'band triceps pushdown', 'triceps pushdown'],
  '罗马尼亚硬拉': ['romanian deadlift', 'r dl'],
  '臀推': ['hip thrust'],
  '髋外展': ['hip abduction', 'side lying hip abduction', 'seated hip abduction'],
  '相扑深蹲': ['sumo squat', 'sumo deadlift'],
  '俯卧腿弯举': ['lying leg curl', 'prone leg curl', 'leg curl'],
  '平板支撑': ['plank', 'forearm plank'],
  '自行车卷腹': ['bicycle crunch', 'bicycle abdominal'],
  'V字起身': ['v-up', 'v sit up', 'v sit-up'],
  '侧卷腹': ['side crunch', 'oblique crunch'],
  '拳击空击': ['shadow boxing', 'boxing'],
  // v6 第二批扩充（14 个，KW 首位用数据集精确名保证命中，其次通用词兜底）
  '派克俯卧撑': ['exercise ball pike push up', 'pike push up', 'pike press'],
  '单臂俯卧撑': ['single arm push-up', 'one arm push up', 'one-arm pushup'],
  '反向划船': ['inverted row', 'bodyweight row', 'supine row'],
  '俯身臂屈伸': ['dumbbell kickback', 'triceps kickback', 'kickback'],
  '斜托弯举': ['cable preacher curl', 'preacher curl', 'bicep preacher'],
  '单腿硬拉': ['barbell single leg deadlift', 'single leg deadlift', 'single-leg rdl'],
  '过头深蹲': ['barbell overhead squat', 'overhead squat'],
  '坐姿提踵': ['lever seated calf press', 'seated calf raise', 'seated calf'],
  '反向卷腹': ['reverse crunch'],
  '负重卷腹': ['weighted crunch', 'cable crunch'],
  '熊爬': ['bear crawl'],
  '坐姿前屈': ['exercise ball seated hamstring stretch', 'seated forward fold', 'seated hamstring stretch'],
  '颈部拉伸': ['side push neck stretch', 'neck stretch'],
  '举腿卷腹': ['lever seated leg raise crunch', 'leg raise crunch', 'lying leg raise crunch'],
  // v7 第三批扩充（12 个新增动作；5 个已有动作的 KW 已能命中，不再重复）
  '弓箭手俯卧撑': ['archer push up', 'archer push-up'],
  '击掌俯卧撑': ['clap push up', 'clap push-up'],
  '侧弓步': ['barbell lateral lunge', 'lateral lunge'],
  '反向箭步蹲': ['barbell rear lunge', 'rear lunge'],
  '早安式': ['good morning'],
  '哑铃台阶训练': ['dumbbell step-up', 'dumbbell step up', 'step up'],
  '俯卧撑转侧平板': ['push-up to side plank', 'push up to side plank'],
  '腘绳肌拉伸': ['hamstring stretch'],
  '股四头肌拉伸': ['quad stretch', 'quadriceps stretch', 'hip flexor and quad stretch'],
  '髋屈肌拉伸': ['hip flexor stretch', 'hip flexor'],
  '弹力带单臂划船': ['one arm standing low row', 'band low row', 'band row'],
  '单腿提踵': ['single leg calf raise', 'single leg calf raises'],
  // v8 第四批扩充（19 个，首位用数据集精确名，注意部分名带 (male) 后缀）
  '弹力带深蹲划船': ['band squat row'],
  '弹力带坐姿转体划船': ['band one arm twisting seated row'],
  '杠铃俯身划船': ['barbell bent over row'],
  '弹力带耸肩': ['band shrug'],
  '弓箭手引体': ['archer pull up'],
  '跳绳': ['jump rope'],
  '开合跳': ['star jump (male)', 'star jump'],
  '跳蹲': ['jump squat'],
  '剪刀跳': ['scissor jumps (male)', 'scissor jumps'],
  '分腿跳': ['astride jumps (male)', 'astride jumps'],
  '高抬腿弓步': ['walking high knees lunge'],
  '冲刺跑': ['wind sprints'],
  '过顶胸肌拉伸': ['behind head chest stretch'],
  '四足深蹲拉伸': ['all fours squad stretch'],
  '交叉卷腹': ['cross body crunch'],
  '弹力带抗旋转推': ['band horizontal pallof press'],
  '垂悬举腿': ['captains chair straight leg raise'],
  '杠铃硬拉': ['barbell deadlift'],
  '杠铃前蹲': ['barbell front squat'],
  // v9 第五批扩充（18 个，首位用数据集精确名保证命中）
  '坐姿脊柱扭转': ['band seated twist'],
  '青蛙式': ['rocking frog stretch'],
  '站姿小腿拉伸': ['bodyweight standing calf raise'],
  '肱三头肌拉伸': ['overhead triceps stretch'],
  '杠铃耸肩': ['barbell shrug'],
  'T杠划船': ['lever reverse t-bar row'],
  '杠铃上拉': ['barbell pullover'],
  '杠铃肩上推举': ['lever military press'],
  '借力推举': ['kettlebell double push press'],
  '地板卧推': ['barbell one arm floor press'],
  '箱跳': ['box jump down with one leg stabilization'],
  '悬垂屈膝举腿': ['assisted hanging knee raise'],
  '绳索转体': ['cable twist'],
  '壶铃风车': ['kettlebell windmill'],
  '腿举': ['lever alternate leg press'],
  '哈克深蹲': ['barbell hack squat'],
  '腿伸展': ['lever leg extension'],
  '手枪蹲': ['single leg squat (pistol) male'],
  // v10 第六批(新动作 10 个)：首位用数据集精确名保证命中
  '坐姿绳索划船': ['cable low seated row'],
  '绳索三头下压': ['cable one arm tricep pushdown'],
  '腿弯举': ['lever kneeling leg curl'],
  '杠铃臀桥': ['barbell glute bridge'],
  '侧平板': ['side plank hip adduction'],
  '滑雪步': ['ski step'],
  '杰克波比': ['jack burpee'],
  '靠墙小腿拉伸': ['calf stretch with hands against wall'],
  '胸肌拉伸': ['chest stretch with exercise ball'],
  '下背拉伸': ['seated lower back stretch']
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
