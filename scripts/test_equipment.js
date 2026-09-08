// 无头冒烟：6 项新增能力（器械动作库 / 拉力维度 / 进退阶链 / 肌群覆盖雷达 / 训练量 / 计划可编辑）
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'site_app.html'), 'utf8');

// 种子数据：6 大肌群各覆盖一个动作（best>0），覆盖雷达走 weak-ok 分支；records 带 reps 明细供训练量统计
const best = {
  '标准俯卧撑': { best: 20, last: 20, hist: [20], lastDate: '2026-09-08' },
  '哑铃划船':   { best: 15, last: 15, hist: [15], lastDate: '2026-09-08' },
  '深蹲':       { best: 30, last: 30, hist: [30], lastDate: '2026-09-08' },
  '卷腹':       { best: 25, last: 25, hist: [25], lastDate: '2026-09-08' },
  '开合跳':     { best: 40, last: 40, hist: [40], lastDate: '2026-09-08' },
  '肩胸拉伸':   { best: 30, last: 30, hist: [30], lastDate: '2026-09-08' }
};
const records = [
  { date: '2026-09-08', ts: 3, name: '测试', icon: '🏋️', min: 25, kcal: 150, done: 3, total: 3,
    detail: [{ name: '哑铃划船', type: 'reps', target: 12, actual: 15 }, { name: '标准俯卧撑', type: 'reps', target: 10, actual: 20 }],
    bg: '#eef4f1', tag: 'fit_course_x' }
];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost/',
  beforeParse(window) {
    try {
      window.localStorage.setItem('fit_best', JSON.stringify(best));
      window.localStorage.setItem('fit_records', JSON.stringify(records));
    } catch (e) {}
  }
});
const { window } = dom;
const { document } = window;
const NS = window.__NS;

let pass = 0, fail = 0;
function ck(name, cond) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name); } }
function q(s) { return document.querySelector(s); }
function qa(s) { return document.querySelectorAll(s); }
function click(sel) { const e = q(sel); if (!e) throw new Error('no element: ' + sel); e.click(); }
function clickOne(sel) { const e = qa(sel); if (!e.length) throw new Error('no match: ' + sel); e[0].click(); }

/* ===== A. 数据层（直接读 __NS） ===== */
try {
  ck('NS exposed', !!NS && !!NS.ACT_LIB && !!NS.actionByName && !!NS.generatePlan);

  // 1) 飞鸟改名：哑铃飞鸟存在，水瓶飞鸟已删除
  ck('哑铃飞鸟 in actionByName', !!NS.actionByName['哑铃飞鸟']);
  ck('水瓶飞鸟 removed', !NS.actionByName['水瓶飞鸟']);

  // 2) 13 个器械动作全部入库
  const equip = ['哑铃卧推', '哑铃肩推', '哑铃飞鸟', '哑铃划船', '弹力带下拉', '引体向上',
    '哑铃侧平举', '高脚杯深蹲', '哑铃硬拉', '壶铃摇摆', '保加利亚分腿蹲', '锤式弯举', '弹力带面拉'];
  ck('13 equipment actions in ACT_LIB', equip.every(n => !!NS.ACT_LIB[n] && !!NS.actionByName[n]));

  // 3) 拉力维度：pull 池 ≥5
  const pullNames = Object.keys(NS.ACT_LIB).filter(n => NS.ACT_LIB[n].g === 'pull');
  ck('pull pool >= 5 (g=拉力维度)', pullNames.length >= 5);

  // 4) 进退阶链
  ck('哑铃划船 reg=弹力带下拉', NS.ACT_LIB['哑铃划船'].reg === '弹力带下拉');
  ck('哑铃划船 adv=引体向上', NS.ACT_LIB['哑铃划船'].adv === '引体向上');
  ck('标准俯卧撑 reg=上斜俯卧撑', NS.ACT_LIB['标准俯卧撑'].reg === '上斜俯卧撑');
  ck('标准俯卧撑 adv=下斜俯卧撑', NS.ACT_LIB['标准俯卧撑'].adv === '下斜俯卧撑');

  // 5) 计划引擎产出拉力日（增肌 4 天）
  const plan = NS.generatePlan({ goal: '增肌', days: 4, length: 30, level: '进阶' }, {});
  ck('plan has 4 weeks', plan.weeks.length === 4);
  let pullDay = null;
  plan.weeks[0].week.forEach(d => { if (d.type === 'pull') pullDay = d; });
  ck('增肌 plan contains pull day', !!pullDay);
  ck('pull day has acts+seq', pullDay && pullDay.acts.length > 0 && pullDay.seq.length > 0);
  ck('pull day muscle=背·臂', pullDay && pullDay.muscle.indexOf('背') >= 0);
} catch (e) {
  fail++; console.log('FAIL data-layer exception: ' + e.message + '\n' + e.stack);
}

/* ===== B. UI 流程 ===== */
try {
  // 记录页：雷达 + 训练量
  click('[data-a="tab"][data-v="record"]');
  ck('radar card rendered', !!q('.radar-card svg'));
  ck('coverage weak-ok (6 groups)', !!q('.weak-ok'));
  ck('volume row rendered', !!q('.vol-row'));
  ck('volume shows total reps', (q('.vol-row') ? q('.vol-row').textContent : '').indexOf('累计次数') >= 0);

  // 训练库：动作库 + 拉力维度 + 进退阶 chips
  click('[data-a="tab"][data-v="train"]');
  click('[data-a="seg"][data-v="acts"]');
  ck('pull muscle chip 背·臂 present', !!q('[data-a="mus"][data-v="背·臂"]'));
  ck('哑铃飞鸟 in action list', document.body.textContent.indexOf('哑铃飞鸟') >= 0);
  // 打开带退阶/进阶的动作 → 变式链
  const row = q('[data-a="actInfo"][data-name="哑铃划船"]');
  ck('哑铃划船 row in library', !!row);
  if (row) { row.click(); ck('variant chips shown', !!q('.var-chips')); }
  if (q('.var-chips')) {
    const vt = q('.var-chips').textContent;
    ck('退阶 chip (弹力带下拉)', vt.indexOf('弹力带下拉') >= 0);
    ck('进阶 chip (引体向上)', vt.indexOf('引体向上') >= 0);
  }
  // 关掉 sheet
  if (q('[data-a="xSheet"]')) click('[data-a="xSheet"]');

  // 计划：生成 → 打开某训练日 → 编辑 → 替换动作 → 标记已编辑
  click('[data-a="tab"][data-v="plan"]');
  click('[data-a="form"][data-k="goal"][data-v="增肌"]');
  click('[data-a="genPlan"]');
  ck('plan result rendered', !!q('.day-card'));
  // 打开第一个训练日
  clickOne('[data-a="openDay"]');
  ck('day sheet has edit button', !!q('[data-a="editDay"]'));
  click('[data-a="editDay"]');
  ck('edit sheet has swap button', !!q('[data-a="swapAct"]'));
  clickOne('[data-a="swapAct"]');
  ck('swap grid shown', !!q('[data-a="doSwap"]'));
  clickOne('[data-a="doSwap"]');
  // doSwap 重开编辑 sheet 并置 edited=true；回计划页验证提示
  if (q('[data-a="xSheet"]')) click('[data-a="xSheet"]');
  click('[data-a="tab"][data-v="plan"]');
  ck('plan shows edited tip', document.body.textContent.indexOf('你已手动调整') >= 0);

  ck('no fatal error', !window.__err);
} catch (e) {
  fail++; console.log('FAIL ui exception: ' + e.message + '\n' + e.stack);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
