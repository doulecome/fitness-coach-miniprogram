// AI 智能训练计划 v4 —— 逐日动态编排引擎
// 相比 v3（固定课程排期 + 目标覆盖）的本质升级：
//  1) 计划不再从 6 门内置课程里挑——而是按「目标 → 每周肌群结构 → 每日组装」从动作库
//     动态编排每一个训练日：主项(带组数轮次) + 核心收尾 + 拉伸冷身，练的就是"你的计划"
//  2) 训练水平真正作用于课程：新手只上低难度变式 + 少组数，老手自动上更难变式 + 加量
//  3) 单次时长真正作用于课程：15/30/45 分钟决定主项数量与轮次，而不是随便挑一门课
//  4) 肌群恢复科学编排：胸/臀腿/核心/燃脂/恢复 均匀散布，不连续练同一部位；无背拉类
//     器械动作时如实说明（居家无器械以推/蹲为主）
//  5) 读成绩历史：单轮目标 = 历史最佳 × 阶段比例（W1 重建 → W2 +8% → W3 +15% → W4 70%）
//  6) 每个训练日附教练按语：为什么这么练、注意什么
//
// 周期：W1 适应 → W2 进阶 → W3 强化（渐进超负荷） → W4 恢复(Deload)，W4 后回到 W1 循环
// 动作编排依赖 data.js 的 ACT_LIB（g=训练池 / d=难度 1~3），全部动作带 ExerciseDB 真人 GIF
const { ACT_LIB, actionByName } = require('./data.js');

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// —— 训练日模板 ——
const TEMPLATES = {
  push: {
    name: '胸肩推力日', icon: '💪', muscle: '胸肌 · 三头',
    pool: 'push',
    warm: '肩绕环 30 秒 + 开合跳 40 秒，把肩胸激活后再推',
    coach: (names, rounds, phase) =>
      `推力复合为主：${names.join('、')}，每动作 ${rounds} 组。${phase}`
  },
  legs: {
    name: '臀腿力量日', icon: '🍑', muscle: '臀 · 大腿 · 小腿',
    pool: 'legs',
    warm: '原地深蹲 8 次慢速找髋折叠 + 提踵 20 次激活小腿',
    coach: (names, rounds, phase) =>
      `下肢为王：${names.join('、')}，每动作 ${rounds} 组。蹲/桥动作膝盖对准脚尖，不内扣。${phase}`
  },
  core: {
    name: '核心雕刻日', icon: '🔥', muscle: '腹直肌 · 腹斜肌 · 深层核心',
    pool: 'core',
    warm: '猫式伸展 6 次 + 骨盆卷动 8 次，先把腰腹和呼吸激活',
    coach: (names, rounds, phase) =>
      `今天练腹：${names.join('、')}，每动作 ${rounds} 组。所有卷/举动作下背贴地，宁慢勿用腰代偿。${phase}`
  },
  fat: {
    name: '燃脂间歇日', icon: '💥', muscle: '全身 · 心肺',
    pool: 'cardio',
    warm: '开合跳 40 秒低强度 + 高抬腿 20 秒，把心率慢慢拉起来',
    coach: (names, rounds, phase) =>
      `间歇燃脂：${names.join('、')}，每轮 ${rounds} 次循环。动作间休息压到最短，全程保持呼吸节奏。${phase}`
  },
  recover: {
    name: '舒缓恢复日', icon: '🌿', muscle: '全身 · 深度放松',
    pool: 'stretch',
    warm: '',
    coach: () => '今天不练力量：用缓慢的拉伸放松髋、腿、肩背，每个动作配合呼吸做到有牵拉感即可，帮助身体恢复、改善久坐僵硬。'
  }
};

// 目标 → 每周训练日主题循环（按序切前 N 个即为该周训练日类型序列）
// 设计约束（保证任何截取都不出现相邻同类型——除 recover 可连续）：
//  theme 内部相邻类型不同 且 首尾类型不同；大肌群（push/legs）间隔 ≥1 个训练日
const GOAL_CFG = {
  '减脂': {
    theme: ['fat', 'legs', 'fat', 'core'],
    note: '中高强度间歇为主、穿插臀腿大肌群力量与核心——大肌群参与越多，单次燃脂效率越高',
    intro: '减脂期我做三件事：① 用燃脂间歇日把单次消耗拉满；② 保留臀腿大肌群训练保护肌肉与基础代谢（纯有氧会掉肌肉掉代谢）；③ 每周动作目标按你成绩渐进 +10%~20%。饮食缺口才是减脂主力，训练负责守住肌肉。'
  },
  '增肌': {
    theme: ['push', 'legs', 'core', 'push', 'legs', 'recover'],
    note: '推力(胸/三头)与下肢(臀/腿)隔天交替，核心收尾，给每块肌群 48h 恢复再刺激',
    intro: '居家无器械能练的大肌群以「推」和「蹲/桥」为主（缺背部拉类，建议后续加弹力带补划船/拉）。编排逻辑：推力日与臀腿日严格隔开，同一肌群两次之间至少隔一天恢复——肌肉在恢复期生长。目标逐周 +2~4 次渐进超负荷，W4 主动减量让身体超量恢复。'
  },
  '塑形': {
    theme: ['push', 'legs', 'fat', 'core', 'push', 'legs', 'recover'],
    note: '力量(胸/臀腿)打底保线条，间歇燃脂削脂，核心收尾——先力量后有氧最利线条',
    intro: '塑形 = 增肌 + 减脂的结合：力量训练把胸/臀腿练出形态，间歇把体脂压下去，核心让腰腹紧致。编排把力量日与燃脂日交替，避免连续两天高强度。组次按你历史成绩渐进，W4 减量恢复。'
  },
  '拉伸放松': {
    theme: ['recover', 'core', 'recover', 'recover'],
    note: '以舒缓拉伸为主（髋/腿/肩背），穿插轻量核心，缓解久坐僵硬、改善体态',
    intro: '放松计划的核心是「低强度 + 够时长」：拉伸不追求力竭，追求在张力下放松。穿插的轻量核心日帮久坐族找回骨盆稳定。如果某天精力好，可以换成力量或燃脂课自行加码。'
  },
  '保持健康': {
    theme: ['push', 'legs', 'fat', 'core', 'recover'],
    note: '推力 / 臀腿 / 燃脂 / 核心 / 恢复 五种训练均衡轮转，维持体能又不易受伤',
    intro: '健康维持 = 全面不偏科：一周内力量(胸/臀腿)保证肌肉量，间歇保住心肺，恢复日给关节和神经系统喘息。五种训练日循环排布，强度跟随你最近一次成绩，练完只会有"舒服的疲劳"而不是累垮。'
  }
};

// 每周训练天数 → 训练日下标（避免连续多天，保证恢复），仅当用户未自定义休息日时使用
const SCHEDULE = {
  3: [0, 2, 4],
  4: [0, 2, 4, 6],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 3, 4, 6]
};

const LEVEL_NOTE = {
  '新手': '新手模式：自动选用低难度动作变式、组数减量，先把动作做标准再谈加量',
  '进阶': '进阶模式：中等难度变式 + 完整组数，目标按 100% 执行，关注动作质量',
  '老手': '老手模式：自动上高难度变式并加组数，若有余力可组间缩短 5 秒，逼近力竭'
};

const LEVEL_K = { '新手': 0.85, '进阶': 1.0, '老手': 1.15 };

// 4 周周期阶段
const PHASES = [
  { key: 'adapt', label: '适应期', tip: '第 1 周重建基线：主项目标 = 你的历史最佳（没练过的按水平起步），先标准后速度' },
  { key: 'prog', label: '进阶期', tip: '第 2 周渐进超负荷：计数目标 ≈ 你成绩的 +8%（保底 +1 次），计时 +5%，轮数不变' },
  { key: 'peak', label: '强化期', tip: '第 3 周冲击峰值：计数目标 ≈ 你成绩的 +15%（保底 +2 次），计时 +10%，主项各加 1 组' },
  { key: 'deload', label: '恢复期', tip: '第 4 周主动减量：目标降至历史最佳约 70%，训练换低冲击恢复，等超量恢复' }
];

// 训练日下标计算（与 v3 一致）
function computeTrainIdx(days, restDays) {
  if (restDays && restDays.length) {
    const restSet = new Set(restDays);
    const available = [];
    for (let i = 0; i < 7; i++) if (!restSet.has(i)) available.push(i);
    return { trainIdx: available, effectiveDays: available.length, adjusted: available.length !== days };
  }
  return { trainIdx: SCHEDULE[days], effectiveDays: days, adjusted: false };
}

// —— 主项选择：按水平取难度窗口，同一池多次出现时滑动窗口避免每天练同款 ——
function poolActs(poolKey) {
  return Object.keys(ACT_LIB)
    .filter(n => ACT_LIB[n].g === poolKey && !ACT_LIB[n].dup)
    .sort((a, b) => ACT_LIB[a].d - ACT_LIB[b].d); // 池内由易到难
}

function windowStart(len, n, level, rot) {
  let base;
  if (level === '新手') base = 0;
  else if (level === '老手') base = len - n;
  else base = Math.max(0, Math.floor((len - n) / 2));
  const maxStart = Math.max(0, len - n);
  return (base + rot) % (maxStart + 1); // 滑窗：同一天(槽)跨周稳定，不同训练日换变式
}

function pickMains(poolKey, level, n, rot) {
  const arr = poolActs(poolKey);
  if (!arr.length) return [];
  const start = windowStart(arr.length, n, level, rot);
  const picked = [];
  for (let k = 0; k < n; k++) {
    const name = arr[(start + k) % arr.length];
    if (!picked.includes(name)) picked.push(name);
  }
  // 池太小导致不足 n 时用已选动作补位（不同训练日补位顺序不同）
  let i = 0;
  while (picked.length < n) {
    const name = arr[(start + i++) % arr.length];
    if (!picked.includes(name)) picked.push(name);
  }
  return picked;
}

function pickOne(poolKey, rot) {
  const arr = poolActs(poolKey);
  return arr.length ? arr[rot % arr.length] : null;
}

// —— 训练量参数：由「单次时长 × 水平」预算执行位数量，再反推主项组数 ——
// 位 = 一个动作的一次执行（含组间休息）。基础位预算按水平打折：新手 75% / 进阶 100% / 老手 115%
const BIT_BUDGET = { 15: 9, 30: 16, 45: 22 };
const BIT_LEVEL_K = { 新手: 0.75, 进阶: 1, 老手: 1.15 };

function layout(length, level, type, phaseKey) {
  let nMain;
  if (length <= 15) nMain = 2;
  else if (length <= 30) nMain = level === '新手' ? 2 : 3;
  else nMain = level === '新手' ? 3 : 4;
  // 主项之外的固定位：力量日有核心收尾 + 冷身；燃脂/核心只有冷身
  const extra = (type === 'push' || type === 'legs') ? 2 : 1;
  const bits = Math.max(5, Math.round((BIT_BUDGET[length] || 16) * (BIT_LEVEL_K[level] || 1)));
  let r = Math.max(1, Math.floor((bits - extra) / nMain));
  if (phaseKey === 'peak') r += 1; // W3 强化期主项各加 1 组
  r = Math.min(6, Math.max(1, r));
  return { nMain, rMain: r };
}

// —— 动作级个性化目标（v3 规则保留）——
// reps 无历史 -> base × LEVEL_K；有历史 -> W1 max(base,best) / W2 best+2 / W3 best+4 / W4 ≈best×70%
// time         -> base × LEVEL_K，W2/W3 +5%/+10%，W4 ×70%
function computeGoal(act, phaseKey, level, hist) {
  const k = LEVEL_K[level] || 1;
  const base = act.value;
  if (act.type === 'time') {
    let raw;
    if (phaseKey === 'deload') raw = base * 0.7;
    else if (phaseKey === 'prog') raw = base * Math.min(1.2, k + 0.05);
    else if (phaseKey === 'peak') raw = base * Math.min(1.3, k + 0.1);
    else raw = base * k;
    const target = Math.max(15, Math.round(raw / 5) * 5);
    return { target, unit: '秒' };
  }
  const rec = hist ? hist[act.name] : null;
  const best = rec && rec.best ? rec.best : 0;
  if (!best) {
    const t = phaseKey === 'deload' ? Math.max(3, Math.round(base * k * 0.7)) : Math.max(1, Math.round(base * k));
    return { target: t, unit: '次' };
  }
  // 渐进超负荷：按「比例」递增，基数越大每次加得越多；小基数靠保底增量兜底，避免固定 +2/+4 失真
  const start = Math.max(base, best); // W1 起点 = 课程量或历史最佳的地板
  if (phaseKey === 'deload') return { target: Math.max(3, Math.round(best * 0.7)), unit: '次' };
  if (phaseKey === 'prog') {
    const t = Math.max(start + 1, Math.round(start * 1.08)); // ≈ +8%，保底 +1
    return { target: t, unit: '次' };
  }
  if (phaseKey === 'peak') {
    const t = Math.max(start + 2, Math.round(start * 1.15)); // ≈ +15%，保底 +2
    return { target: t, unit: '次' };
  }
  return { target: start, unit: '次' };
}

const CORE_FIN_POOL = ['卷腹', '死虫式', '仰卧起坐']; // 力量日收尾（轮换）
const phaseCoach = {
  adapt: '首周求标准不求多，留 2 次余力（RPE 8/10）。',
  prog: '上周的动作这周每组加一点量，组间休息保持充足。',
  peak: '冲击峰值周：尽量逼近力竭但动作不变形，做不动就减次不减质量。',
  deload: '减量恢复周：降低强度，让身体超量恢复，为下一轮蓄力。'
};

// 时长估算：warm + 每位(执行+过渡) + 收尾
function estMin(seqActs, warmText) {
  let sec = (warmText ? 150 : 0);
  seqActs.forEach((a, i) => {
    const exec = a.type === 'time' ? a.value : Math.round(a.value * 1.2) + 12;
    sec += exec + (i < seqActs.length - 1 ? 18 : 8);
  });
  sec += 90;
  return Math.max(5, Math.round(sec / 60));
}
const KCAL_PER_MIN = { push: 7.5, legs: 8, core: 6, fat: 10, recover: 3.5 };

// 组装一个动作的"跟练位"（从库动作复制演示字段，只改执行量）
function seqItem(name, value) {
  const src = actionByName[name] || { name, icon: '🏋️', type: 'reps' };
  return {
    name: src.name,
    icon: src.icon || '🏋️',
    type: src.type,
    value,
    cue: src.cue || '',
    anim: src.anim || 'dynamic',
    gif: src.gif || '',
    media: src.media || null
  };
}

// —— 生成单个训练日 ——
// type: push/legs/core/fat/recover；t: 该日在本周第几个训练日(0-based)；week: 周期周序(0-3)
function buildDay(type, t, week, phaseKey, level, length, hist, deloadTier) {
  const tmpl = TEMPLATES[type];
  const isRecover = type === 'recover';
  const acts = [];       // 唯一动作清单(展示用，带 round)
  const seq = [];        // 线性执行清单(跟练用，按轮次展开)
  const histAdjusted = { count: 0, names: [] };

  const push = (name, round) => {
    const base = actionByName[name];
    const g = computeGoal(base, phaseKey, level, hist);
    if (g.target <= 0) return;
    acts.push({ name, icon: base.icon, type: base.type, unit: g.unit, target: g.target, round, fromHist: false, cue: base.cue || '' });
    for (let r = 0; r < round; r++) seq.push(seqItem(name, g.target));
  };

  if (isRecover) {
    // 恢复日：舒缓拉伸为主，动作数随时长
    const n = length <= 15 ? 4 : (length <= 30 ? 6 : 8);
    for (let i = 0; i < n; i++) push(pickOne('stretch', (t * 3 + week + i) % 7), 1);
  } else {
    // W3 强化期 +1 组已内含在 layout()；减量日(W4)主项与 W1 相同集合、只做 1 轮低目标，保证可对比
    const lay = deloadTier
      ? { nMain: layout(length, level, type, 'adapt').nMain, rMain: 1 }
      : layout(length, level, type, phaseKey);
    const rMain = lay.rMain;
    const nMain = Math.max(1, lay.nMain);
    const mains = pickMains(tmpl.pool, level, nMain, t * 2); // 变式只随槽位，跨周稳定
    mains.forEach(name => {
      const base = actionByName[name];
      const g = computeGoal(base, phaseKey, level, hist);
      acts.push({ name, icon: base.icon, type: base.type, unit: g.unit, target: g.target, round: rMain, fromHist: false, cue: base.cue || '' });
      for (let r = 0; r < rMain; r++) seq.push(seqItem(name, g.target));
    });
    // 力量日收尾：1 个核心动作 1 轮（刺激深层稳定）；减量日去掉收尾保留冷身
    if (!deloadTier && (type === 'push' || type === 'legs')) {
      const finName = CORE_FIN_POOL[(t + week) % CORE_FIN_POOL.length];
      const fin = actionByName[finName];
      const g = computeGoal(fin, phaseKey, level, hist);
      if (g.target > 0) {
        acts.push({ name: finName, icon: fin.icon, type: fin.type, unit: g.unit, target: g.target, round: 1, fromHist: false, fin: true, cue: fin.cue || '' });
        seq.push(seqItem(finName, g.target));
      }
    }
    // 冷身：1 个拉伸动作
    const coolName = pickOne('stretch', (t * 5 + week) % 7);
    const cool = actionByName[coolName];
    if (cool) {
      const g = computeGoal(cool, phaseKey, level, hist);
      if (g.target > 0) {
        acts.push({ name: coolName, icon: cool.icon, type: cool.type, unit: g.unit, target: g.target, round: 1, fromHist: false, cool: true, cue: cool.cue || '' });
        seq.push(seqItem(coolName, g.target));
      }
    }
  }

  // 计算该日"按历史定制"动作数（去重轮次）
  const customSet = new Set();
  acts.forEach(a => {
    const rec = hist ? hist[a.name] : null;
    if (rec && rec.best) customSet.add(a.name);
  });
  const duration = estMin(seq, tmpl.warm);
  const kcal = Math.max(20, Math.round(duration * (KCAL_PER_MIN[type] || 6)));

  const names = acts.filter(a => !a.fin && !a.cool).map(a => a.name);
  const mainActs = acts.filter(a => !a.fin && !a.cool);
  const roundInfo = mainActs.length ? mainActs[0].round : 1; // 教练按语用主项组数
  return {
    type,
    typeName: tmpl.name,
    icon: tmpl.icon,
    muscle: tmpl.muscle,
    duration,
    kcal,
    nActs: seq.length,        // 线性跟练位数量（动作×轮次）
    nUnique: acts.length,     // 不同动作数
    warm: isRecover ? '' : tmpl.warm,
    coach: isRecover ? tmpl.coach() : tmpl.coach(names, roundInfo, phaseCoach[phaseKey]),
    custom: customSet.size,
    acts,                      // 唯一动作 + round（处方详情展示）
    seq                       // 跟练执行序列
  };
}

// 单周训练日的类型序列（顺序 = 第几个训练日）；theme 循环前缀已保证无相邻同类型
function themeSeq(goal, n) {
  const theme = GOAL_CFG[goal].theme;
  const out = [];
  for (let i = 0; i < n; i++) out.push(theme[i % theme.length]);
  return out;
}

// 主入口：生成 4 周周期计划
function generatePlan(opts, hist) {
  const goal = opts.goal || '减脂';
  const length = [15, 30, 45].includes(opts.length) ? opts.length : 30;
  const level = opts.level || '新手';
  const restDays = Array.isArray(opts.restDays) ? opts.restDays.slice() : [];
  hist = hist || null;

  const cfg = GOAL_CFG[goal] || GOAL_CFG['减脂'];
  const { trainIdx, effectiveDays, adjusted } = computeTrainIdx(Number(opts.days) || 3, restDays);

  const themes = themeSeq(goal, effectiveDays); // themes[t] = 第 t 个训练日的类型
  const weekDays = []; // 7 个槽: {wd, rest:false, type, t}
  WEEKDAYS.forEach((wd, i) => {
    const t = trainIdx.indexOf(i);
    if (t >= 0 && t < effectiveDays) weekDays.push({ wd, rest: false, type: themes[t], t });
    else weekDays.push({ wd, rest: true });
  });

  const w4count = Math.max(2, Math.round(effectiveDays * 2 / 3));

  const weeks = PHASES.map((ph, wi) => {
    const isW4 = wi === 3;
    const activeCount = isW4 ? w4count : effectiveDays;
    const week = WEEKDAYS.map((wd, i) => {
      const slot = weekDays.find(d => d.wd === wd);
      if (!slot || slot.rest) return { wd, rest: true };
      const t = slot.t;
      if (isW4 && t >= w4count) return { wd, rest: true }; // 减量周只保留前 w4count 个训练日
      if (!isW4 || t === 0) {
        // 第 1~3 周正常编排；W4 首日保留同主题低刺激（deload：同主项 1 轮 + 目标 70%）
        const dayType = slot.type;
        const deloadTier = isW4;
        const day = buildDay(dayType, t, wi, ph.key, level, length, hist, deloadTier);
        return { wd, rest: false, ...day };
      }
      // W4 其余训练日 → 舒缓恢复
      const day = buildDay('recover', t, wi, ph.key, level, length, hist, false);
      return { wd, rest: false, ...day };
    });
    const trainDays = week.filter(d => !d.rest);
    const totalMin = trainDays.reduce((s, d) => s + d.duration, 0);
    const totalKcal = trainDays.reduce((s, d) => s + d.kcal, 0);
    const customCount = trainDays.reduce((s, d) => s + d.custom, 0);
    return {
      label: ph.label,
      tip: ph.tip,
      key: ph.key,
      days: activeCount,
      totalMin,
      totalKcal,
      customCount,
      week
    };
  });

  const customTotal = weeks.reduce((s, w) => s + w.customCount, 0);

  return {
    v: 4,
    goal,
    goalNote: cfg.note,
    intro: cfg.intro,
    days: effectiveDays,
    length,
    level,
    levelNote: LEVEL_NOTE[level] || '',
    restDays,
    adjusted,
    customTotal,
    coachIntro: cfg.intro,
    generatedAt: new Date().toISOString(),
    weeks,
    weeksNote: '个性化法则：练过的动作按「历史最佳 × 阶段比例」定单轮目标（W2 +8% / W3 +15% / W4 减至 70%，基数小则保底 +1/+2 次），主项组数随水平与时长自动设定。W4 后回到第 1 周循环。',
    week: weeks[0].week,
    totalMin: weeks[0].totalMin,
    totalKcal: weeks[0].totalKcal
  };
}

// 根据今天是周几，返回指定周(默认第1周)今天对应的训练项
function todayPlan(plan, weekIdx) {
  const w = plan && plan.weeks && plan.weeks[weekIdx || 0] ? plan.weeks[weekIdx || 0] : plan;
  const jsDay = new Date().getDay(); // 0=周日
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return w.week ? w.week[idx] : w[idx];
}

module.exports = { generatePlan, todayPlan, TEMPLATES, WEEKDAYS, PHASES, LEVEL_K, computeGoal };
