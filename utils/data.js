// 训练课程与动作数据
// action.type: 'time' 计时(秒) | 'reps' 计数(次)
// action.anim: 'dynamic' 动态发力 | 'hold' 静态保持 | 'cardio' 有氧心肺
// course.cat: 减脂 / 增肌 / 核心 / 拉伸
// v2（对标 Keep）：每个动作都必须有 ExerciseDB 真人连贯 GIF，无 GIF 动作已全部移除/替换

const courses = [
  {
    id: 'abs',
    name: '腹肌撕裂者',
    level: '初级',
    duration: 12,
    kcal: 140,
    cat: '核心',
    muscle: '腹部',
    icon: '🔥',
    color: '#FF7A59',
    desc: '上腹→下腹→侧腹→深层稳定，12 分钟雕刻马甲线',
    actions: [
      { name: '卷腹', icon: '🧎', type: 'reps', value: 20 },
      { name: '仰卧举腿', icon: '🦵', type: 'reps', value: 16 },
      { name: '俄罗斯转体', icon: '🔄', type: 'reps', value: 24 },
      { name: '登山者', icon: '⛰️', type: 'time', value: 40 },
      { name: '仰卧交替抬腿', icon: '🦵', type: 'reps', value: 30 },
      { name: '左侧平板', icon: '🤸', type: 'time', value: 30 },
      { name: '右侧平板', icon: '🤸', type: 'time', value: 30 },
      { name: '死虫式', icon: '🐛', type: 'time', value: 40 },
      { name: '平板支撑', icon: '🧘', type: 'time', value: 45 },
      { name: '自行车卷腹', icon: '🚴', type: 'reps', value: 24 },
      { name: 'V字起身', icon: '🔺', type: 'reps', value: 16 },
      { name: '侧卷腹', icon: '🔄', type: 'reps', value: 20 },
      { name: '反向卷腹', icon: '↩️', type: 'reps', value: 18 },
      { name: '负重卷腹', icon: '🎯', type: 'reps', value: 16 },
      { name: '举腿卷腹', icon: '⬆️', type: 'reps', value: 16 },
      { name: '熊爬', icon: '🐻', type: 'time', value: 30 },
      { name: '俯卧撑转侧平板', icon: '🔄', type: 'reps', value: 10 },
      { name: '交叉卷腹', icon: '🔄', type: 'reps', value: 20 },
      { name: '弹力带抗旋转推', icon: '🎯', type: 'reps', value: 14 },
      { name: '垂悬举腿', icon: '🪝', type: 'reps', value: 12 },
      { name: '悬垂屈膝举腿', icon: '🪝', type: 'reps', value: 12 },
      { name: '绳索转体', icon: '🎯', type: 'reps', value: 16 },
      { name: '壶铃风车', icon: '🔔', type: 'reps', value: 10 },
      { name: '侧平板', icon: '🧘', type: 'time', value: 30 },

    ]
  },
  {
    id: 'hiit',
    name: '全身 HIIT 燃脂',
    level: '中级',
    duration: 18,
    kcal: 220,
    cat: '减脂',
    muscle: '全身',
    icon: '💥',
    color: '#FF5C77',
    desc: '高强度间歇：冲刺-爆发-核心交替，18 分钟榨干每一滴汗',
    actions: [
      { name: '开合跳', icon: '⭐', type: 'reps', value: 40 },
      { name: '高抬腿', icon: '🏃', type: 'time', value: 30 },
      { name: '波比跳', icon: '💥', type: 'reps', value: 12 },
      { name: '弓步跳', icon: '🚀', type: 'reps', value: 16 },
      { name: '深蹲跳', icon: '🍑', type: 'reps', value: 20 },
      { name: '登山者', icon: '⛰️', type: 'time', value: 40 },
      { name: '仰卧起坐', icon: '🧎', type: 'reps', value: 25 },
      { name: '弓步蹲', icon: '🦵', type: 'reps', value: 24 },
      { name: '拳击空击', icon: '🥊', type: 'time', value: 40 },
      { name: '跳绳', icon: '🪢', type: 'reps', value: 60 },
      { name: '跳蹲', icon: '🦘', type: 'reps', value: 16 },
      { name: '剪刀跳', icon: '✂️', type: 'reps', value: 20 },
      { name: '分腿跳', icon: '🔀', type: 'reps', value: 20 },
      { name: '高抬腿弓步', icon: '🚶', type: 'reps', value: 24 },
      { name: '冲刺跑', icon: '🏃', type: 'time', value: 30 },
      { name: '杰克波比', icon: '🔥', type: 'reps', value: 10 },

    ]
  },
  {
    id: 'yoga',
    name: '睡前舒缓拉伸',
    level: '初级',
    duration: 20,
    kcal: 80,
    cat: '拉伸',
    muscle: '全身',
    icon: '🌿',
    color: '#5BC8A0',
    desc: '深度放松髋、腿、肩背，缓解久坐僵硬，放松助眠',
    actions: [
      { name: '仰卧臀腿拉伸', icon: '🧘', type: 'time', value: 40 },
      { name: '仰卧梨状肌拉伸', icon: '🧘', type: 'time', value: 40 },
      { name: '蝴蝶式', icon: '🦋', type: 'time', value: 40 },
      { name: '俯卧大腿前侧拉伸', icon: '🧘', type: 'time', value: 40 },
      { name: '俯卧腿后侧拉伸', icon: '🧘', type: 'time', value: 40 },
      { name: '侧卧大腿内侧拉伸', icon: '🧘', type: 'time', value: 40 },
      { name: '坐姿前屈', icon: '🧘', type: 'time', value: 40 },
      { name: '颈部拉伸', icon: '💆', type: 'time', value: 30 },
      { name: '腘绳肌拉伸', icon: '🧘', type: 'time', value: 40 },
      { name: '股四头肌拉伸', icon: '🧘', type: 'time', value: 40 },
      { name: '髋屈肌拉伸', icon: '🧘', type: 'time', value: 40 },
      { name: '过顶胸肌拉伸', icon: '🙆', type: 'time', value: 30 },
      { name: '四足深蹲拉伸', icon: '🐾', type: 'time', value: 30 },
      { name: '坐姿脊柱扭转', icon: '🧘', type: 'time', value: 40 },
      { name: '青蛙式', icon: '🐸', type: 'time', value: 40 },
      { name: '站姿小腿拉伸', icon: '🦵', type: 'time', value: 40 },
      { name: '肱三头肌拉伸', icon: '💪', type: 'time', value: 30 },
      { name: '靠墙小腿拉伸', icon: '🧱', type: 'time', value: 30 },
      { name: '胸肌拉伸', icon: '💪', type: 'time', value: 30 },
      { name: '下背拉伸', icon: '🧘', type: 'time', value: 30 },

    ]
  },
  {
    id: 'chest',
    name: '胸肌轰炸',
    level: '中级',
    duration: 20,
    kcal: 160,
    cat: '增肌',
    muscle: '胸部',
    icon: '💪',
    color: '#4A90E2',
    desc: '角度递进多姿态俯卧撑，把胸练厚练饱满',
    actions: [
      { name: '标准俯卧撑', icon: '💪', type: 'reps', value: 15 },
      { name: '上斜俯卧撑', icon: '📐', type: 'reps', value: 15 },
      { name: '下斜俯卧撑', icon: '⛰️', type: 'reps', value: 12 },
      { name: '窄距俯卧撑', icon: '💪', type: 'reps', value: 12 },
      { name: '钻石俯卧撑', icon: '💎', type: 'reps', value: 10 },
      { name: '等长收缩', icon: '⏱️', type: 'time', value: 30 },
      { name: '哑铃飞鸟', icon: '🏋️', type: 'reps', value: 16 },
      { name: '派克俯卧撑', icon: '🏔️', type: 'reps', value: 10 },
      { name: '单臂俯卧撑', icon: '🦾', type: 'reps', value: 6 },
      { name: '弓箭手俯卧撑', icon: '🏹', type: 'reps', value: 8 },
      { name: '击掌俯卧撑', icon: '👏', type: 'reps', value: 10 },
      { name: '地板卧推', icon: '🏋️', type: 'reps', value: 12 }
    ]
  },
  {
    id: 'glute',
    name: '零器械臀腿',
    level: '初级',
    duration: 16,
    kcal: 150,
    cat: '增肌',
    muscle: '臀腿',
    icon: '🍑',
    color: '#9B6DFF',
    desc: '髋主导发力：蹲-桥-跨步-跳跃，居家练出臀腿线条',
    actions: [
      { name: '深蹲', icon: '🦵', type: 'reps', value: 20 },
      { name: '屈膝礼蹲', icon: '🎩', type: 'reps', value: 16 },
      { name: '臀桥', icon: '🌉', type: 'reps', value: 20 },
      { name: '臀桥踏步', icon: '🚶', type: 'reps', value: 20 },
      { name: '箭步蹲', icon: '🚶', type: 'reps', value: 16 },
      { name: '深蹲跳', icon: '🍑', type: 'reps', value: 15 },
      { name: '站姿提踵', icon: '🦶', type: 'reps', value: 25 },
      { name: '罗马尼亚硬拉', icon: '🏋️', type: 'reps', value: 12 },
      { name: '臀推', icon: '🌉', type: 'reps', value: 15 },
      { name: '髋外展', icon: '🦵', type: 'reps', value: 18 },
      { name: '相扑深蹲', icon: '🦵', type: 'reps', value: 16 },
      { name: '俯卧腿弯举', icon: '🦵', type: 'reps', value: 16 },
      { name: '单腿硬拉', icon: '⚖️', type: 'reps', value: 10 },
      { name: '过头深蹲', icon: '🕴️', type: 'reps', value: 10 },
      { name: '坐姿提踵', icon: '👣', type: 'reps', value: 20 },
      { name: '侧弓步', icon: '↔️', type: 'reps', value: 14 },
      { name: '反向箭步蹲', icon: '🔙', type: 'reps', value: 14 },
      { name: '早安式', icon: '🌅', type: 'reps', value: 14 },
      { name: '哑铃台阶训练', icon: '🪜', type: 'reps', value: 14 },
      { name: '单腿提踵', icon: '🦶', type: 'reps', value: 20 },
      { name: '杠铃硬拉', icon: '🏋️', type: 'reps', value: 12 },
      { name: '杠铃前蹲', icon: '🏋️', type: 'reps', value: 12 },
      { name: '腿举', icon: '🦵', type: 'reps', value: 15 },
      { name: '哈克深蹲', icon: '🏋️', type: 'reps', value: 12 },
      { name: '腿伸展', icon: '🦵', type: 'reps', value: 16 },
      { name: '手枪蹲', icon: '🦵', type: 'reps', value: 8 },
      { name: '腿弯举', icon: '🦵', type: 'reps', value: 15 },
      { name: '杠铃臀桥', icon: '🍑', type: 'reps', value: 12 },

    ]
  },
  {
    id: 'cardio',
    name: '晨间唤醒有氧',
    level: '初级',
    duration: 10,
    kcal: 100,
    cat: '减脂',
    muscle: '有氧',
    icon: '☀️',
    color: '#FFB020',
    desc: '10 分钟低冲击唤醒：从心率渐进到舒展，唤醒沉睡身体',
    actions: [
      { name: '开合跳', icon: '⭐', type: 'reps', value: 40 },
      { name: '高抬腿', icon: '🏃', type: 'time', value: 30 },
      { name: '深蹲', icon: '🦵', type: 'reps', value: 20 },
      { name: '登山者', icon: '⛰️', type: 'time', value: 30 },
      { name: '速滑跳', icon: '⛸️', type: 'time', value: 30 },
      { name: '肩胸拉伸', icon: '🙆', type: 'time', value: 30 },
      { name: '跳绳', icon: '🪢', type: 'reps', value: 50 },
      { name: '跳蹲', icon: '🦘', type: 'reps', value: 14 },
      { name: '箱跳', icon: '📦', type: 'reps', value: 16 },
      { name: '滑雪步', icon: '⛷️', type: 'reps', value: 20 },

    ]
  },
  {
    id: 'equip',
    name: '哑铃器械入门',
    level: '初级',
    duration: 18,
    kcal: 180,
    cat: '增肌',
    muscle: '全身·器械',
    icon: '🏋️',
    color: '#6C5CE7',
    desc: '哑铃/弹力带/壶铃居家练遍全身：推、拉、蹲、铰链，器械让动作更精准可控',
    actions: [
      { name: '哑铃卧推', icon: '🏋️', type: 'reps', value: 12 },
      { name: '哑铃肩推', icon: '🏋️', type: 'reps', value: 12 },
      { name: '哑铃飞鸟', icon: '🏋️', type: 'reps', value: 14 },
      { name: '哑铃划船', icon: '🏋️', type: 'reps', value: 12 },
      { name: '弹力带下拉', icon: '🎯', type: 'reps', value: 15 },
      { name: '引体向上', icon: '🧗', type: 'reps', value: 6 },
      { name: '哑铃侧平举', icon: '🏋️', type: 'reps', value: 14 },
      { name: '高脚杯深蹲', icon: '🦵', type: 'reps', value: 15 },
      { name: '哑铃硬拉', icon: '🏋️', type: 'reps', value: 12 },
      { name: '壶铃摇摆', icon: '🔔', type: 'reps', value: 15 },
      { name: '保加利亚分腿蹲', icon: '🦵', type: 'reps', value: 12 },
      { name: '锤式弯举', icon: '💪', type: 'reps', value: 14 },
      { name: '弹力带面拉', icon: '🎯', type: 'reps', value: 15 },
      { name: '杠铃耸肩', icon: '🤷', type: 'reps', value: 16 },
      { name: 'T杠划船', icon: '🏋️', type: 'reps', value: 12 },
      { name: '杠铃上拉', icon: '🏋️', type: 'reps', value: 12 },
      { name: '杠铃肩上推举', icon: '🏋️', type: 'reps', value: 10 },
      { name: '借力推举', icon: '🏋️', type: 'reps', value: 10 },
      { name: '地板卧推', icon: '🏋️', type: 'reps', value: 12 },
      { name: '腿举', icon: '🦵', type: 'reps', value: 15 },
      { name: '哈克深蹲', icon: '🏋️', type: 'reps', value: 12 },
      { name: '腿伸展', icon: '🦵', type: 'reps', value: 16 }
    ]
  },
  {
    id: 'arms',
    name: '手臂塑形',
    level: '初级',
    duration: 14,
    kcal: 130,
    cat: '增肌',
    muscle: '手臂',
    icon: '💪',
    color: '#E8893B',
    desc: '二头弯举 + 三头臂屈伸组合，哑铃/弹力带在家雕出手臂线条',
    actions: [
      { name: '哑铃弯举', icon: '💪', type: 'reps', value: 14 },
      { name: '集中弯举', icon: '💪', type: 'reps', value: 12 },
      { name: '哑铃颈后臂屈伸', icon: '💪', type: 'reps', value: 12 },
      { name: '仰卧臂屈伸', icon: '💪', type: 'reps', value: 12 },
      { name: '弹力带下压', icon: '🎯', type: 'reps', value: 15 },
      { name: '双杠臂屈伸', icon: '🤸', type: 'reps', value: 10 },
      { name: '俯身臂屈伸', icon: '🔨', type: 'reps', value: 14 },
      { name: '斜托弯举', icon: '🤜', type: 'reps', value: 12 },
      { name: '绳索三头下压', icon: '🔥', type: 'reps', value: 15 },

    ]
  },
  {
    id: 'upupper',
    name: '肩背雕刻',
    level: '中级',
    duration: 18,
    kcal: 170,
    cat: '增肌',
    muscle: '肩背',
    icon: '🏔️',
    color: '#3D7EAA',
    desc: '垂直拉 + 水平拉 + 推举，把肩练宽、背练厚',
    actions: [
      { name: '高位下拉', icon: '🎯', type: 'reps', value: 12 },
      { name: '坐姿划船', icon: '🏋️', type: 'reps', value: 12 },
      { name: '反向飞鸟', icon: '🏋️', type: 'reps', value: 15 },
      { name: '前平举', icon: '🏋️', type: 'reps', value: 14 },
      { name: '俯身侧平举', icon: '🏋️', type: 'reps', value: 14 },
      { name: '阿诺德推举', icon: '🏋️', type: 'reps', value: 12 },
      { name: '弹力带肩推', icon: '🎯', type: 'reps', value: 14 },
      { name: '上斜哑铃卧推', icon: '🏋️', type: 'reps', value: 12 },
      { name: '反向划船', icon: '🚣', type: 'reps', value: 12 },
      { name: '弹力带单臂划船', icon: '🎯', type: 'reps', value: 14 },
      { name: '弹力带深蹲划船', icon: '💪', type: 'reps', value: 14 },
      { name: '弹力带坐姿转体划船', icon: '🚣', type: 'reps', value: 14 },
      { name: '杠铃俯身划船', icon: '🏋️', type: 'reps', value: 12 },
      { name: '弹力带耸肩', icon: '🤷', type: 'reps', value: 16 },
      { name: '弓箭手引体', icon: '🏹', type: 'reps', value: 6 },
      { name: '杠铃耸肩', icon: '🤷', type: 'reps', value: 16 },
      { name: 'T杠划船', icon: '🏋️', type: 'reps', value: 12 },
      { name: '杠铃上拉', icon: '🏋️', type: 'reps', value: 12 },
      { name: '杠铃肩上推举', icon: '🏋️', type: 'reps', value: 10 },
      { name: '借力推举', icon: '🏋️', type: 'reps', value: 10 },
      { name: '坐姿绳索划船', icon: '🪢', type: 'reps', value: 15 },

    ]
  }
];

// 依据动作名/类型推断演示动画类型，省去逐条标注
function inferAnim(a) {
  const n = a.name;
  if (/平板|等长|拉伸|式|婴儿|摊尸|前屈|放松|冥想|死虫|蝴蝶/.test(n)) return 'hold';
  if (/慢跑|高抬腿|开合跳|登山|踏步|后踢|有氧|跑|波比|跳|速滑/.test(n)) return 'cardio';
  return 'dynamic';
}
courses.forEach(c => c.actions.forEach(a => { if (!a.anim) a.anim = inferAnim(a); }));

// 接入免费动作素材库（WGER，LGPL）：按动作名挂载演示图，缺图时运行时回退到 CSS 动画
// src = 本地图片路径(小程序内离线/真机直接显示, 像 Keep)；url = WGER 原链(供本地 HTML 预览)
const mediaMap = require('./media_map.js');
const mediaLocal = require('./media_local.js');
courses.forEach(c => c.actions.forEach(a => {
  if (!a.media && mediaLocal[a.name]) {
    a.media = { type: 'image', src: mediaLocal[a.name], url: mediaMap[a.name] };
  }
}));

// 接入 ExerciseDB 真人动作 GIF（连贯动画，Keep 式）：优先用 GIF 播放，无 GIF 的动作回退到本地图
const gifMap = require('./gif_map.js');
// 开练示范覆盖通道：build_site.js 在打包时会把 docs/media/kailian/<动作名>.gif(或 .mp4/.webm)
// 注入为 window.__KAILIAN；存在则优先使用，覆盖 ExerciseDB 的图。素材所有权在用户、零版权风险。
(function () {
  var KL = (typeof window !== 'undefined' && window.__KAILIAN) || (typeof globalThis !== 'undefined' ? globalThis.__KAILIAN : null) || null;
  courses.forEach(c => c.actions.forEach(a => {
    if (KL && KL[a.name]) { a.gif = KL[a.name]; return; }
    if (!a.gif && gifMap[a.name]) a.gif = gifMap[a.name];
  }));
})();

const ANIM_TIP = {
  dynamic: '发力阶段肌肉收缩，还原时控制速度，感受目标肌群酸胀',
  hold: '保持身体稳定与呼吸匀速，核心收紧，不要憋气',
  cardio: '节奏连贯、心率拉满，落地轻、呼吸深，坚持就是燃脂'
};

// 每个动作一句教练要点（Keep 式动作讲解），跟练页/详情页展示
const ACTION_CUE = {
  '卷腹': '下背贴地，用腹肌卷起肩胛，别用脖子借力',
  '平板支撑': '手肘在肩正下方，身体一条直线，收核心夹臀不塌腰',
  '俄罗斯转体': '躯干后倾约 45°，左右转体带胸，腹肌始终收紧',
  '仰卧抬腿': '下背压实地面，双腿伸直慢放慢抬，下腹发力',
  '登山者': '手撑肩下方，膝盖快速交替提向胸口，臀部压低',
  '仰卧交替抬腿': '下背贴地，双腿交替上下摆，越低越考验下腹',
  '左侧平板': '侧身肘撑，肩肘垂直，髋部上顶让身体成直线',
  '右侧平板': '侧身肘撑，肩肘垂直，髋部上顶让身体成直线',
  '开合跳': '落地屈膝缓冲，双臂画圆过头，呼吸别乱',
  '高抬腿': '膝盖抬到髋高，前脚掌快速点地，摆臂配合',
  '波比跳': '俯身撑地→收腿→向上跳起，连贯不塌腰',
  '深蹲跳': '下蹲至大腿平行再爆发跳起，落地屈膝缓冲',
  '仰卧起坐': '屈膝固定脚，卷起上身，别用手猛拽后颈',
  '弓步蹲': '前膝对准脚尖，后膝下沉近地，躯干保持直立',
  '婴儿式': '臀部坐向脚跟，额头贴地，手臂前伸放松肩背',
  '猫牛式': '吸气塌腰抬头，呼气拱背低头，跟呼吸流动',
  '下犬式': '手推地臀部上提，脚跟下压，背部延展成倒 V',
  '鸽子式': '前腿屈膝外旋，髋摆正下沉，拉伸臀部外侧',
  '坐姿前屈': '吸气延展脊柱，呼气从髋折叠前屈，背不弓',
  '摊尸式': '全身完全放松，掌心朝上，闭眼调息彻底放松',
  '标准俯卧撑': '身体一条直线，胸部贴近地面再推起，肘约 45°',
  '钻石俯卧撑': '拇指食指成菱形置于胸下，主练肱三头肌',
  '宽距俯卧撑': '双手宽于肩，肘向两侧打开，胸部主导发力',
  '上斜俯卧撑': '手撑高台身体倾斜，降难度练胸与推力基础',
  '窄距俯卧撑': '双手窄于肩，肘贴身体，强化肱三头肌',
  '等长收缩': '动作中段静止保持，持续挤压目标肌群不放松',
  '哑铃飞鸟': '微屈肘握哑铃沉肩挺胸，像展翅感受胸中缝',
  '深蹲': '脚与肩同宽，屈髋下蹲至大腿平行，重心在脚掌',
  '臀桥': '仰卧屈膝，臀部发力顶起至肩膝一线，顶端夹臀',
  '侧卧抬腿': '侧卧固定骨盆，上腿伸直上抬，下落不触地',
  '蚌式开合': '侧卧屈膝双脚并拢，上膝像蚌壳开合，臀侧发力',
  '箭步蹲': '大步向前下蹲，后膝轻触地，前腿蹬回原位',
  '跪姿后抬腿': '四足跪姿，大腿向后上踢至与背平，核心稳住',
  '原地慢跑': '前脚掌着地，膝盖自然上抬，摆臂放松有节奏',
  '后踢腿': '脚跟交替踢向臀部，腰背挺直，保持高频',
  '原地踏步': '自然摆臂抬膝踏步，配合呼吸逐步热身',
  '全身拉伸': '动作放慢配合呼吸，拉到酸胀即可，不勉强',

  // v2 新增动作要点
  '仰卧举腿': '下背压实地面，直腿慢放不触地，下腹全程绷紧',
  '死虫式': '腰背贴地，对侧手脚慢速伸展，核心稳住不拱腰',
  '弓步跳': '空中换腿保持躯干直立，落地屈膝缓冲、膝盖对脚尖',
  '下斜俯卧撑': '脚垫高躯干倾斜，身体直线，重点刺激上胸与前束',
  '屈膝礼蹲': '后腿绕到斜后方下蹲，收紧臀中肌，前腿主导发力',
  '臀桥踏步': '臀桥顶端交替抬脚点地，骨盆保持水平、不要塌',
  '站姿提踵': '前脚掌踩地慢起慢落，顶峰停顿 1 秒，练小腿线条',
  '速滑跳': '左右横跳像滑冰，屈髋重心低，手臂自然摆动找节奏',
  '肩胸拉伸': '双手背后交握挺胸，肩胛后收，感受胸肩前侧拉开',
  '仰卧臀腿拉伸': '仰卧抱单膝拉向胸口，臀部有牵拉感，腰不离地',
  '仰卧梨状肌拉伸': '仰卧脚踝架对侧膝上，双手抱腿拉近，臀深部拉伸',
  '蝴蝶式': '脚掌相对坐直，膝向两侧下沉，可前倾加深腹股沟拉伸',
  '俯卧大腿前侧拉伸': '俯卧单手拉同侧脚踝贴臀，大腿前侧有拉伸即可',
  '俯卧腿后侧拉伸': '俯卧腿伸直，另侧手抓脚踝上拉，腿后侧放松',
  '侧卧大腿内侧拉伸': '侧卧上腿屈膝外展，下腿伸直，拉伸大腿内侧',
  // v3 器械/拉力动作要点
  '哑铃卧推': '仰卧（凳或地），握哑铃推起至胸上方，下放至胸侧肘约 45°',
  '哑铃肩推': '坐姿握哑铃举至肩高，垂直推过头顶，核心收紧不耸肩',
  '哑铃侧平举': '微屈肘向两侧平举至肩高，感受中束，顶峰停顿 1 秒',
  '哑铃飞鸟': '微屈肘握哑铃沉肩挺胸，像展翅感受胸中缝',
  '哑铃划船': '俯身髋后坐，握哑铃向腰侧提拉，肩胛后收挤压背阔',
  '弹力带下拉': '弹力带固定高处，双手下拉至胸前，沉肩夹背',
  '引体向上': '握杠悬垂，沉肩收背把胸口拉向横杠，慢放不甩',
  '弹力带面拉': '弹力带拉向面部，肘外展后拉，练后束与肩外旋',
  '锤式弯举': '拳眼相对握哑铃，弯举至肩前，主练肱肌与前臂',
  '高脚杯深蹲': '双手抱哑铃于胸前，屈髋下蹲至大腿平行，重心脚掌',
  '哑铃硬拉': '哑铃贴腿下放至小腿中，臀推发力站起，背挺直不圆',
  '壶铃摇摆': '髋铰链前后摆荡，靠臀部发力甩壶铃至肩高，核心绷紧',
  '保加利亚分腿蹲': '后脚搭高，前腿下蹲至大腿平行，前膝对准脚尖',
  // v5 扩充动作库教练要点（24 个）
  '高位下拉': '握距略宽于肩，沉肩把横杠拉到锁骨，背阔肌主导，慢放不甩',
  '坐姿划船': '挺胸沉肩，把手拉向腹部，肩胛后收挤背阔，控制回放',
  '反向飞鸟': '俯身微屈髋，双臂向两侧后展，练后束，别耸肩',
  '前平举': '双臂前举至肩高，肩前束发力，手腕放松不耸肩',
  '俯身侧平举': '俯身约45°，双臂向侧后展，刺激后束，顶峰停顿',
  '阿诺德推举': '推起时掌心由内旋转朝前，全程肩袖参与，核心收紧',
  '弹力带肩推': '踩住弹力带，双手推过头顶，顶端阻力最强',
  '上斜哑铃卧推': '上斜凳30-45°，推至胸上方，上胸与前束主导',
  '双杠臂屈伸': '身体微前倾练胸、直立练三头，下落至大臂平行',
  '哑铃弯举': '大臂贴身体，二头弯举至肩前，顶峰挤压，慢放',
  '集中弯举': '肘抵大腿内侧，孤立弯举，顶峰强收缩二头',
  '哑铃颈后臂屈伸': '单臂举过头顶向后屈伸，三头长头发力，肘朝前不晃',
  '仰卧臂屈伸': '仰卧双手持铃于胸前，屈肘下放到额头上方，伸臂锁三头',
  '弹力带下压': '弹力带固定高处，双手下压至大腿，三头收紧不耸肩',
  '罗马尼亚硬拉': '微屈膝，髋铰链前倾，哑铃沿腿下放至小腿中，臀推站起',
  '臀推': '上背靠凳，负重置髋，顶髋至肩膝一线，顶端夹臀停顿',
  '髋外展': '侧卧或站姿，上腿外展打开，臀侧（臀中肌）发力',
  '相扑深蹲': '双脚外八宽站，持铃于胸，屈髋下蹲，内收肌与臀发力',
  '俯卧腿弯举': '俯卧勾脚向臀，股二头发力，慢放不借惯性',
  '平板支撑': '前臂撑地，身体成直线，收核心夹臀，不塌腰不撅臀',
  '自行车卷腹': '交替肘碰对侧膝，扭转腹斜肌，节奏稳不甩头',
  'V字起身': '同时抬上身与腿成V，下腹与上腹齐发力，控制下落',
  '侧卷腹': '侧躺卷向同侧膝，练腹斜肌，别用脖子借力',
  '拳击空击': '站架护脸，左右直拳快出快收，步法轻快，心率拉满',
  // v6 第二批扩充教练要点（14 个）
  '派克俯卧撑': '臀部上顶成倒 V，头自然下垂，屈肘让头顶向地面，肩前束主导发力',
  '单臂俯卧撑': '核心收紧身体不旋转，单手撑地另手背后，离心慢放保护肩关节',
  '反向划船': '杠/桌下握稳身体绷直脚跟着地，胸口拉向支点，背阔肌主导',
  '俯身臂屈伸': '俯身大臂贴身体固定，小臂向后上方伸展到直，三头长头发力',
  '斜托弯举': '大臂贴斜板固定，二头弯举顶峰强收缩，慢放不借惯性',
  '单腿硬拉': '微屈膝重心腿髋铰链前倾，哑铃沿腿下放，臀推站起练臀腿后侧',
  '过头深蹲': '杠/物举过头顶，屈髋下蹲至大腿平行，核心收紧背挺直',
  '坐姿提踵': '坐姿前脚掌踩实，慢起慢落练小腿，顶端停顿 1 秒',
  '反向卷腹': '仰卧举腿屈膝，用下腹把骨盆卷向胸腔，腰不离地',
  '负重卷腹': '抱负重物于胸前，卷起上身上腹发力，慢放不甩',
  '熊爬': '四足支撑同侧手脚交替移动，核心稳住背平直，别塌腰',
  '举腿卷腹': '仰卧双腿伸直上抬再下放，下腹主导，脚不触地',
  '坐姿前屈': '坐姿腿伸直，吸气延展脊柱，呼气从髋折叠前屈，背不弓',
  '颈部拉伸': '缓慢左右侧倾与前后屈伸，到微酸即可，不猛甩头',
  // v7 第三批扩充教练要点（12 个新增；5 个已有动作要点已存在，不重复）
  '弓箭手俯卧撑': '单臂承重身体侧倾，对侧手前伸指地，胸与肩前束主导发力',
  '击掌俯卧撑': '推起离地时快速击掌，落地缓冲、核心绷紧不塌腰',
  '侧弓步': '向侧大步跨出，屈膝重心落外侧腿，内侧腿伸直臀腿发力',
  '反向箭步蹲': '后腿大步后撤下蹲，前膝对准脚尖，后膝轻触地再蹬回',
  '早安式': '微屈膝髋部后推折叠，背挺直，腘绳肌与臀有拉伸感',
  '哑铃台阶训练': '踩稳台阶，后跟发力蹬起，膝对脚尖不内扣',
  '俯卧撑转侧平板': '推起时转身成侧支撑，肩髋成线，核心全程收紧',
  '腘绳肌拉伸': '一腿伸直一腿屈曲，体前屈够脚尖，腿后侧有牵拉感',
  '股四头肌拉伸': '单手拉同侧脚踝贴臀，大腿前侧有拉伸，骨盆中立',
  '髋屈肌拉伸': '弓步前跪，骨盆前推下沉，髋前侧有牵拉感',
  '弹力带单臂划船': '踩住弹力带，单臂向腰侧提拉，肩胛后收挤背阔',
  '单腿提踵': '单脚前掌踩高，慢起慢落，顶峰夹停顿练小腿',
  // v8 第四批扩充（18 个新动作的教练要点）
  '弹力带深蹲划船': '踩带下蹲，起身同时后拉弹力带至腹前，腿臀推+背阔收紧',
  '弹力带坐姿转体划船': '坐姿踩带，单臂后拉同时转体，背阔与核心协同发力',
  '杠铃俯身划船': '屈髋俯身约45°，杠铃沿腿拉向肚脐，背阔主导、腰椎中立',
  '弹力带耸肩': '双臂垂带，耸肩向耳后夹，顶端停顿练斜方肌',
  '弓箭手引体': '引体顶点向一侧拉满，单臂主导，强化单侧背阔',
  '跳绳': '前脚掌轻跳，手腕摇绳，节奏稳住呼吸',
  '跳蹲': '下蹲即起跳，落地屈膝缓冲，爆发臀腿',
  '剪刀跳': '左右交替前弓步跳，重心稳、膝盖不内扣',
  '分腿跳': '并腿跳开成深蹲，再跳回并拢，连贯不顿',
  '高抬腿弓步': '弓步行走中交替高抬膝，活络髋屈+拉心率',
  '冲刺跑': '原地高强摆臂提膝，模拟冲刺，全力短促',
  '过顶胸肌拉伸': '双手交扣举过头顶，挺胸展肩，微感拉伸即停',
  '四足深蹲拉伸': '四足支撑塌腰顶髋，动态开髋放松下背',
  '交叉卷腹': '卷腹时肘膝对角相触，腹斜肌主导',
  '弹力带抗旋转推': '侧对锚点，双手推带于胸前抗旋转，核心稳如磐石',
  '垂悬举腿': '悬垂或椅边，双腿伸直上抬慢控下，下腹主导',
  '杠铃硬拉': '屈髋握杠，臀推发力站直，全程背挺、杠贴腿',
  '杠铃前蹲': '杠铃置锁骨前，高脚杯前蹲，躯干直立、膝朝脚尖',
  // v9 第五批扩充（18 个新动作的教练要点）
  '坐姿脊柱扭转': '坐姿双腿伸直，一手撑后，另手抱膝转体，脊柱逐节扭转，感受背部舒展',
  '青蛙式': '四足跪姿，双膝外展脚掌相对，臀部后坐下沉，髋部有拉伸即可',
  '站姿小腿拉伸': '前脚掌踩台阶边缘，后跟缓慢下压，小腿后侧有牵拉感，不弹震',
  '肱三头肌拉伸': '单臂过头屈肘，另手轻压肘向后，大臂贴近耳侧，三头有拉伸',
  '杠铃耸肩': '双手握杠垂于体前，肩发力向上耸至耳侧，顶端停顿夹斜方，慢放',
  'T杠划船': '俯身握T杠，背阔发力把杠拉向胸口，肩胛后收，腰椎中立',
  '杠铃上拉': '仰卧（或上斜）握杠置头顶，沿弧线拉向胸口再回放，胸背协同',
  '杠铃肩上推举': '杠铃置锁骨，垂直推过头顶，核心收紧不耸肩，顶端锁肩',
  '借力推举': '半蹲蓄力借下肢弹起，顺势将壶铃/杠推过头顶，全身协调爆发',
  '地板卧推': '仰卧地面握铃，推起至胸上方，下放至胸侧，三头与胸协同',
  '箱跳': '微蹲蓄力跳上箱/台阶，脚掌踩实缓冲，落下轻退，保护膝盖',
  '悬垂屈膝举腿': '悬垂或椅边，屈膝抬向胸口，下腹主导，慢放不甩',
  '绳索转体': '站姿侧对滑轮机，双手握绳于胸前，转体拉向对侧，腹斜肌发力',
  '壶铃风车': '单手持壶铃过头，对侧腿微屈，躯干侧倾摸脚，肩髋稳定转髋回正',
  '腿举': '坐姿蹬腿，膝对准脚尖，腿近伸直不锁死，股四头与臀协同发力',
  '哈克深蹲': '肩扛杠铃，双脚与肩同宽下蹲至大腿平行，膝朝脚尖，臀腿主导',
  '腿伸展': '坐姿勾脚，股四头发力把小腿伸直上抬，顶端停顿夹腿',
  '手枪蹲': '单腿下蹲至臀触踝，另腿前伸，站起时臀腿发力，核心稳住',
  // v10 第六批(新动作 10 个)教练要点
  '坐姿绳索划船': '坐稳沉肩，双手前伸握绳，向腹前拉拢肩胛后收，慢放不耸肩',
  '绳索三头下压': '站姿握绳，大臂夹耳侧不动，小臂下压至伸直，三头收紧停顿',
  '腿弯举': '俯卧勾踝，腘绳肌发力把小腿弯向臀，顶峰停顿慢放',
  '杠铃臀桥': '上背撑地，杠置髋上，臀发力顶髋到肩髋膝一线，夹臀不塌腰',
  '侧平板': '侧卧单肘撑地，身体成直线，髋向上顶，核心侧链收紧',
  '滑雪步': '微蹲向一侧快速踏出再收回，左右交替如滑雪，膝随脚尖',
  '杰克波比': '开合跳接下蹲撑地后跳成俯卧，再收回跳起，连贯爆发',
  '靠墙小腿拉伸': '前脚掌踩墙根，后跟下压贴地，小腿后侧有牵拉，不弹震',
  '胸肌拉伸': '背靠球或门框，双臂打开贴墙，胸向前送，胸大肌有拉伸',
  '下背拉伸': '坐姿抱膝贴近胸口，缓慢前后滚动或静态保持，放松下背'
};
courses.forEach(c => c.actions.forEach(a => {
  if (!a.cue && ACTION_CUE[a.name]) a.cue = ACTION_CUE[a.name];
}));

// 接入 exercises-dataset 中文分步说明（来源 hasaneyldrm/exercises-dataset，MIT 结构 / 媒体 © Gym visual）
// 仅取文本层，不拉 GIF（与现有 ExerciseDB 真人 GIF 同源）
const ZH = require('./zh_steps.js');
// 器材分类（用于"只练我有的器材"筛选）：哑铃 / 弹力带 / 壶铃 / 徒手
function equipOf(name) {
  if (/哑铃/.test(name)) return '哑铃';
  if (/弹力带/.test(name)) return '弹力带';
  if (/壶铃/.test(name)) return '壶铃';
  return '徒手';
}
courses.forEach(c => c.actions.forEach(a => {
  if (ZH[a.name]) { a.zhSteps = ZH[a.name].steps; a.zhDesc = ZH[a.name].desc; }
  if (!a.equip) a.equip = equipOf(a.name);
}));

// —— v4 动作编排元数据：供 AI 计划按肌群/难度动态组装每日训练 ——
// g: 动作归属(编排池) push=胸肩推力 | legs=臀腿 | core=核心 | cardio=燃脂心肺 | stretch=拉伸放松
// d: 动作难度 1基础 → 3进阶（同一池内由易到难）
const ACT_LIB = {
  // 推力
  '上斜俯卧撑': { g: 'push', d: 1, adv: '标准俯卧撑' },
  '等长收缩': { g: 'push', d: 1 },
  '标准俯卧撑': { g: 'push', d: 2, reg: '上斜俯卧撑', adv: '下斜俯卧撑' },
  '哑铃飞鸟': { g: 'push', d: 2, reg: '上斜俯卧撑', adv: '哑铃卧推' },
  '窄距俯卧撑': { g: 'push', d: 2, reg: '标准俯卧撑', adv: '钻石俯卧撑' },
  '下斜俯卧撑': { g: 'push', d: 3, reg: '标准俯卧撑' },
  '钻石俯卧撑': { g: 'push', d: 3, reg: '窄距俯卧撑' },
  // 臀腿
  '臀桥': { g: 'legs', d: 1, adv: '臀桥踏步' },
  '站姿提踵': { g: 'legs', d: 1 },
  '深蹲': { g: 'legs', d: 1, adv: '高脚杯深蹲' },
  '臀桥踏步': { g: 'legs', d: 2, reg: '臀桥' },
  '屈膝礼蹲': { g: 'legs', d: 2 },
  '箭步蹲': { g: 'legs', d: 2 },
  '弓步蹲': { g: 'legs', d: 2, dup: '箭步蹲' }, // 「弓步蹲」= 箭步蹲同动作两名，编排时跳过避免同日重复
  // 核心
  '死虫式': { g: 'core', d: 1 },
  '卷腹': { g: 'core', d: 1, adv: '仰卧举腿' },
  '仰卧起坐': { g: 'core', d: 1 },
  '仰卧交替抬腿': { g: 'core', d: 2 },
  '俄罗斯转体': { g: 'core', d: 2 },
  '仰卧举腿': { g: 'core', d: 2 },
  '左侧平板': { g: 'core', d: 2 },
  '右侧平板': { g: 'core', d: 2 },
  // 燃脂心肺
  '开合跳': { g: 'cardio', d: 1 },
  '高抬腿': { g: 'cardio', d: 2 },
  '登山者': { g: 'cardio', d: 2 },
  '速滑跳': { g: 'cardio', d: 2 },
  '弓步跳': { g: 'cardio', d: 3 },
  '深蹲跳': { g: 'cardio', d: 3 },
  '波比跳': { g: 'cardio', d: 3 },
  // 拉伸放松
  '肩胸拉伸': { g: 'stretch', d: 1 },
  '仰卧臀腿拉伸': { g: 'stretch', d: 1 },
  '仰卧梨状肌拉伸': { g: 'stretch', d: 1 },
  '蝴蝶式': { g: 'stretch', d: 1 },
  '俯卧大腿前侧拉伸': { g: 'stretch', d: 1 },
  '俯卧腿后侧拉伸': { g: 'stretch', d: 1 },
  '侧卧大腿内侧拉伸': { g: 'stretch', d: 1 },
  // v3 拉力维度（背·臂）
  '哑铃划船': { g: 'pull', d: 2, reg: '弹力带下拉', adv: '引体向上' },
  '弹力带下拉': { g: 'pull', d: 1, adv: '哑铃划船' },
  '引体向上': { g: 'pull', d: 3, reg: '哑铃划船' },
  '弹力带面拉': { g: 'pull', d: 2 },
  '锤式弯举': { g: 'pull', d: 2, reg: '弹力带面拉' },
  // v3 器械推力补充（胸·肩）
  '哑铃卧推': { g: 'push', d: 2, reg: '哑铃飞鸟', adv: '下斜俯卧撑' },
  '哑铃肩推': { g: 'push', d: 2, reg: '哑铃侧平举' },
  '哑铃侧平举': { g: 'push', d: 1, adv: '哑铃肩推' },
  // v3 器械臀腿补充
  '高脚杯深蹲': { g: 'legs', d: 2, reg: '深蹲', adv: '保加利亚分腿蹲' },
  '哑铃硬拉': { g: 'legs', d: 2, reg: '臀桥' },
  '壶铃摇摆': { g: 'legs', d: 2, adv: '哑铃硬拉' },
  '保加利亚分腿蹲': { g: 'legs', d: 3, reg: '高脚杯深蹲' },
  // v5 扩充动作库（编排池，分组仅限 push/pull/legs/core/cardio/stretch）
  '高位下拉': { g: 'pull', d: 2, reg: '弹力带下拉', adv: '引体向上' },
  '坐姿划船': { g: 'pull', d: 2, reg: '哑铃划船' },
  '反向飞鸟': { g: 'pull', d: 1 },
  '前平举': { g: 'push', d: 1, reg: '哑铃侧平举' },
  '俯身侧平举': { g: 'push', d: 2, reg: '反向飞鸟' },
  '阿诺德推举': { g: 'push', d: 3, reg: '哑铃肩推' },
  '弹力带肩推': { g: 'push', d: 1, reg: '哑铃肩推' },
  '上斜哑铃卧推': { g: 'push', d: 2, reg: '哑铃卧推', adv: '双杠臂屈伸' },
  '双杠臂屈伸': { g: 'push', d: 3, reg: '下斜俯卧撑' },
  '哑铃弯举': { g: 'pull', d: 1, adv: '集中弯举' },
  '集中弯举': { g: 'pull', d: 2, reg: '哑铃弯举' },
  '哑铃颈后臂屈伸': { g: 'push', d: 2 },
  '仰卧臂屈伸': { g: 'push', d: 2, reg: '哑铃颈后臂屈伸' },
  '弹力带下压': { g: 'push', d: 2, reg: '哑铃颈后臂屈伸' },
  '罗马尼亚硬拉': { g: 'legs', d: 2, reg: '哑铃硬拉' },
  '臀推': { g: 'legs', d: 2, reg: '臀桥', adv: '保加利亚分腿蹲' },
  '髋外展': { g: 'legs', d: 1 },
  '相扑深蹲': { g: 'legs', d: 1, reg: '深蹲' },
  '俯卧腿弯举': { g: 'legs', d: 2 },
  '平板支撑': { g: 'core', d: 1, adv: '左侧平板' },
  '自行车卷腹': { g: 'core', d: 2, reg: '卷腹' },
  'V字起身': { g: 'core', d: 2, reg: '仰卧举腿' },
  '侧卷腹': { g: 'core', d: 2, reg: '俄罗斯转体' },
  '拳击空击': { g: 'cardio', d: 2, reg: '高抬腿' },
  // v6 第二批扩充（编排池，分组仅限 push/pull/legs/core/cardio/stretch）
  '派克俯卧撑': { g: 'push', d: 2, reg: '标准俯卧撑', adv: '单臂俯卧撑' },
  '单臂俯卧撑': { g: 'push', d: 3, reg: '派克俯卧撑' },
  '反向划船': { g: 'pull', d: 2, reg: '弹力带下拉', adv: '引体向上' },
  '俯身臂屈伸': { g: 'push', d: 1, adv: '哑铃颈后臂屈伸' },
  '斜托弯举': { g: 'pull', d: 2, reg: '哑铃弯举', adv: '集中弯举' },
  '单腿硬拉': { g: 'legs', d: 2, reg: '哑铃硬拉', adv: '罗马尼亚硬拉' },
  '过头深蹲': { g: 'legs', d: 3, reg: '深蹲' },
  '坐姿提踵': { g: 'legs', d: 1, reg: '站姿提踵' },
  '反向卷腹': { g: 'core', d: 1, reg: '卷腹', adv: '举腿卷腹' },
  '负重卷腹': { g: 'core', d: 2, reg: '反向卷腹', adv: 'V字起身' },
  '熊爬': { g: 'core', d: 2 },
  '举腿卷腹': { g: 'core', d: 2, reg: '反向卷腹' },
  '坐姿前屈': { g: 'stretch', d: 1 },
  '颈部拉伸': { g: 'stretch', d: 1 },
  // v7 第三批扩充（12 个新增；编排池分组仅限 push/pull/legs/core/cardio/stretch）
  '弓箭手俯卧撑': { g: 'push', d: 2, reg: '标准俯卧撑', adv: '单臂俯卧撑' },
  '击掌俯卧撑': { g: 'push', d: 3, reg: '派克俯卧撑' },
  '侧弓步': { g: 'legs', d: 2, reg: '深蹲' },
  '反向箭步蹲': { g: 'legs', d: 2, reg: '箭步蹲' },
  '早安式': { g: 'legs', d: 2, reg: '罗马尼亚硬拉' },
  '哑铃台阶训练': { g: 'legs', d: 2, reg: '深蹲' },
  '俯卧撑转侧平板': { g: 'core', d: 2, reg: '平板支撑' },
  '腘绳肌拉伸': { g: 'stretch', d: 1 },
  '股四头肌拉伸': { g: 'stretch', d: 1 },
  '髋屈肌拉伸': { g: 'stretch', d: 1 },
  '弹力带单臂划船': { g: 'pull', d: 2, reg: '哑铃划船', adv: '反向划船' },
  '单腿提踵': { g: 'legs', d: 1, reg: '站姿提踵' },
  // v8 第四批扩充（18 个新动作，分组限 6 类）
  '弹力带深蹲划船': { g: 'pull', d: 2, reg: '弹力带单臂划船' },
  '弹力带坐姿转体划船': { g: 'pull', d: 2, reg: '弹力带单臂划船' },
  '杠铃俯身划船': { g: 'pull', d: 3, reg: '哑铃划船' },
  '弹力带耸肩': { g: 'pull', d: 1, reg: '反向划船' },
  '弓箭手引体': { g: 'pull', d: 4, reg: '引体向上' },
  '跳绳': { g: 'cardio', d: 1, reg: '开合跳' },
  '跳蹲': { g: 'cardio', d: 2, reg: '深蹲' },
  '剪刀跳': { g: 'cardio', d: 2, reg: '深蹲' },
  '分腿跳': { g: 'cardio', d: 2, reg: '深蹲' },
  '高抬腿弓步': { g: 'cardio', d: 2, reg: '箭步蹲' },
  '冲刺跑': { g: 'cardio', d: 3, reg: '波比跳' },
  '过顶胸肌拉伸': { g: 'stretch', d: 1, reg: '颈部拉伸' },
  '四足深蹲拉伸': { g: 'stretch', d: 1, reg: '颈部拉伸' },
  '交叉卷腹': { g: 'core', d: 1, reg: '卷腹' },
  '弹力带抗旋转推': { g: 'core', d: 2, reg: '平板支撑' },
  '垂悬举腿': { g: 'core', d: 3, reg: '举腿卷腹' },
  '杠铃硬拉': { g: 'legs', d: 3, reg: '罗马尼亚硬拉' },
  '杠铃前蹲': { g: 'legs', d: 3, reg: '高脚杯深蹲' },
  // v9 第五批扩充（18 个新动作，分组限 6 类）
  '坐姿脊柱扭转': { g: 'stretch', d: 1, reg: '颈部拉伸' },
  '青蛙式': { g: 'stretch', d: 1, reg: '颈部拉伸' },
  '站姿小腿拉伸': { g: 'stretch', d: 1, reg: '颈部拉伸' },
  '肱三头肌拉伸': { g: 'stretch', d: 1, reg: '颈部拉伸' },
  '杠铃耸肩': { g: 'pull', d: 2, reg: '弹力带耸肩', adv: 'T杠划船' },
  'T杠划船': { g: 'pull', d: 3, reg: '杠铃俯身划船' },
  '杠铃上拉': { g: 'pull', d: 2, reg: '哑铃划船' },
  '杠铃肩上推举': { g: 'push', d: 3, reg: '哑铃肩推', adv: '阿诺德推举' },
  '借力推举': { g: 'push', d: 3, reg: '杠铃肩上推举' },
  '地板卧推': { g: 'push', d: 2, reg: '哑铃卧推', adv: '上斜哑铃卧推' },
  '箱跳': { g: 'cardio', d: 2, reg: '深蹲', adv: '深蹲跳' },
  '悬垂屈膝举腿': { g: 'core', d: 3, reg: '举腿卷腹', adv: '垂悬举腿' },
  '绳索转体': { g: 'core', d: 2, reg: '俄罗斯转体', adv: '交叉卷腹' },
  '壶铃风车': { g: 'core', d: 3, reg: '俄罗斯转体' },
  '腿举': { g: 'legs', d: 2, reg: '深蹲', adv: '哈克深蹲' },
  '哈克深蹲': { g: 'legs', d: 3, reg: '腿举' },
  '腿伸展': { g: 'legs', d: 2, reg: '深蹲', adv: '保加利亚分腿蹲' },
  '手枪蹲': { g: 'legs', d: 4, reg: '箭步蹲', adv: '保加利亚分腿蹲' },
  // v10 第六批(新动作 10 个)，分组限 6 类
  '坐姿绳索划船': { g: 'pull', d: 2, reg: '哑铃划船', adv: 'T杠划船' },
  '绳索三头下压': { g: 'push', d: 2, reg: '双杠臂屈伸' },
  '腿弯举': { g: 'legs', d: 2, reg: '深蹲', adv: '腿举' },
  '杠铃臀桥': { g: 'legs', d: 2, reg: '深蹲', adv: '罗马尼亚硬拉' },
  '侧平板': { g: 'core', d: 2, reg: '平板支撑', adv: '俄罗斯转体' },
  '滑雪步': { g: 'cardio', d: 2, reg: '深蹲', adv: '跳蹲' },
  '杰克波比': { g: 'cardio', d: 3, reg: '波比跳' },
  '靠墙小腿拉伸': { g: 'stretch', d: 1, reg: '颈部拉伸' },
  '胸肌拉伸': { g: 'stretch', d: 1, reg: '颈部拉伸' },
  '下背拉伸': { g: 'stretch', d: 1, reg: '颈部拉伸' }
};

// 全部动作必须在 ACT_LIB 中有标注（脚本校验），未标注动作会被编排器视为不可用
const actionByName = {};
courses.forEach(c => c.actions.forEach(a => { if (!actionByName[a.name]) actionByName[a.name] = a; }));

module.exports = { courses, ANIM_TIP, ACTION_CUE, ACT_LIB, actionByName };