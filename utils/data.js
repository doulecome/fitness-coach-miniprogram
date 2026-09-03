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
      { name: '死虫式', icon: '🐛', type: 'time', value: 40 }
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
      { name: '弓步蹲', icon: '🦵', type: 'reps', value: 24 }
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
      { name: '侧卧大腿内侧拉伸', icon: '🧘', type: 'time', value: 40 }
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
      { name: '水瓶飞鸟', icon: '🍼', type: 'reps', value: 16 }
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
      { name: '站姿提踵', icon: '🦶', type: 'reps', value: 25 }
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
      { name: '肩胸拉伸', icon: '🙆', type: 'time', value: 30 }
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
courses.forEach(c => c.actions.forEach(a => {
  if (!a.gif && gifMap[a.name]) a.gif = gifMap[a.name];
}));

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
  '水瓶飞鸟': '微屈肘握水瓶沉肩挺胸，像展翅感受胸中缝',
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
  '侧卧大腿内侧拉伸': '侧卧上腿屈膝外展，下腿伸直，拉伸大腿内侧'
};
courses.forEach(c => c.actions.forEach(a => {
  if (!a.cue && ACTION_CUE[a.name]) a.cue = ACTION_CUE[a.name];
}));

// —— v4 动作编排元数据：供 AI 计划按肌群/难度动态组装每日训练 ——
// g: 动作归属(编排池) push=胸肩推力 | legs=臀腿 | core=核心 | cardio=燃脂心肺 | stretch=拉伸放松
// d: 动作难度 1基础 → 3进阶（同一池内由易到难）
const ACT_LIB = {
  // 推力
  '上斜俯卧撑': { g: 'push', d: 1 },
  '等长收缩': { g: 'push', d: 1 },
  '标准俯卧撑': { g: 'push', d: 2 },
  '水瓶飞鸟': { g: 'push', d: 2 },
  '窄距俯卧撑': { g: 'push', d: 2 },
  '下斜俯卧撑': { g: 'push', d: 3 },
  '钻石俯卧撑': { g: 'push', d: 3 },
  // 臀腿
  '臀桥': { g: 'legs', d: 1 },
  '站姿提踵': { g: 'legs', d: 1 },
  '深蹲': { g: 'legs', d: 1 },
  '臀桥踏步': { g: 'legs', d: 2 },
  '屈膝礼蹲': { g: 'legs', d: 2 },
  '箭步蹲': { g: 'legs', d: 2 },
  '弓步蹲': { g: 'legs', d: 2, dup: '箭步蹲' }, // 「弓步蹲」= 箭步蹲同动作两名，编排时跳过避免同日重复
  // 核心
  '死虫式': { g: 'core', d: 1 },
  '卷腹': { g: 'core', d: 1 },
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
  '侧卧大腿内侧拉伸': { g: 'stretch', d: 1 }
};

// 全部 36 个去重动作必须在 ACT_LIB 中有标注（脚本校验），未标注动作会被编排器视为不可用
const actionByName = {};
courses.forEach(c => c.actions.forEach(a => { if (!actionByName[a.name]) actionByName[a.name] = a; }));

module.exports = { courses, ANIM_TIP, ACTION_CUE, ACT_LIB, actionByName };