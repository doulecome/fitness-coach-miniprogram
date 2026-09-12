// 无头冒烟：填完身体数据 → 自动生成训练计划 + 饮食计划（v32）
// 覆盖：保存即出计划（无需去计划页点生成）/ 计划页直接渲染结果 / 饮食页直接出餐单 /
//       血压红线降级 / 参数未变时不重生成（保留进度）/ 健康卡双入口
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'site_app.html'), 'utf8');

const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
const { window } = dom;
const { document } = window;

function ck(name, cond) { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) process.exitCode = 1; }
function q(s) { return document.querySelector(s); }
function click(sel) { const e = q(sel); if (!e) throw new Error('no element: ' + sel); e.click(); }
function tab(k) { click('#tabbar .tab[data-v="' + k + '"]'); }
function setNum(k, v) {
  const e = q('.ha-form input[data-k="' + k + '"]');
  if (!e) throw new Error('no input data-k=' + k);
  e.value = v;
  e.dispatchEvent(new window.Event('input', { bubbles: true }));
}
function toastText() { const t = q('#toast'); return t ? t.textContent : ''; }
function bodyText() { return q('#view') ? q('#view').textContent : document.body.textContent; }
function mealCards() { return document.querySelectorAll('.meal-card').length; }

try {
  // ---- A) 全新用户：只填身高体重 → 保存后计划与餐单都应已生成 ----
  tab('record');
  click('[data-a="healthOpen"]');
  setNum('height', '172');
  setNum('weight', '54'); // 偏瘦 → 方向增肌 → 每周 4 练
  click('[data-a="healthSave"]');

  const planRaw = window.localStorage.getItem('fit_plan');
  ck('A1 保存后 fit_plan 已自动生成', !!planRaw);
  const plan = JSON.parse(planRaw || '{}');
  ck('A2 BMI 偏瘦 → 计划方向=增肌', plan.goal === '增肌');
  ck('A3 增肌 → 每周 4 练', plan.days === 4);
  ck('A4 toast 说明已生成计划', toastText().includes('已按你的数据生成训练计划与饮食方案') && toastText().includes('每周 4 练'));

  tab('plan');
  ck('A5 计划页直接渲染结果（非填写表单）', document.body.textContent.includes('我的 4 周计划') && !bodyText().includes('生成我的 4 周计划'));
  ck('A6 计划页展示训练场景与周计划', bodyText().includes('训练天') && bodyText().includes('第4周恢复期'));

  tab('diet');
  ck('A7 饮食页直接出餐单（4 餐卡）', mealCards() === 4);
  ck('A8 餐单方向=增肌', bodyText().includes('增肌'));

  tab('record');
  ck('A9 健康卡有双入口（训练/饮食）', bodyText().includes('查看训练计划') && bodyText().includes('查看饮食计划'));

  // ---- B) 血压红线：改数据再保存 → 参数变化自动重生成 + 强度降级 ----
  click('[data-a="healthOpen"]');
  setNum('weight', '88');
  setNum('sys', '155');
  setNum('dia', '95');
  click('[data-a="healthSave"]');
  const p2 = JSON.parse(window.localStorage.getItem('fit_plan') || '{}');
  ck('B1 超重 → 方向改减脂', p2.goal === '减脂');
  ck('B2 血压红线 → 周频次封顶 3', p2.days <= 3);
  ck('B3 血压红线 → 水平降为新手', p2.level === '新手');
  ck('B4 toast 提示强度调至新手档', toastText().includes('新手档'));

  // ---- C) 参数未变再保存 → 不重生成，保留浏览进度 ----
  tab('plan');
  click('[data-a="week"][data-i="2"]'); // 切到第 3 周
  ck('C1 已切到第 3 周', q('[data-a="week"][data-i="2"]').className.includes('on'));
  tab('record');
  click('[data-a="healthOpen"]');
  click('[data-a="healthSave"]'); // 数据没改
  ck('C2 参数未变 → toast 提示保留原进度', toastText().includes('保留原进度'));
  tab('plan');
  ck('C3 浏览进度未被重置（仍在第 3 周）', q('[data-a="week"][data-i="2"]').className.includes('on'));

  // ---- D) 清除数据 → 计划保留（训练历史不陪葬）但身体数据清空 ----
  tab('record');
  click('[data-a="healthClear"]');
  ck('D1 清除后健康卡回到入口态', bodyText().includes('开始分析我的数据'));
} catch (e) {
  console.log('FAIL 异常中断: ' + e.message);
  process.exitCode = 1;
}

// ---- E/F/G) v33 启动自愈：用 beforeParse 预置 localStorage，验证开机补齐逻辑 ----
function bootWith(store) {
  const d2 = new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/',
    beforeParse(w) { Object.keys(store).forEach(k => w.localStorage.setItem(k, JSON.stringify(store[k]))); }
  });
  return d2.window;
}
try {
  // E) 有身体档案、无计划（v32 前存的档）→ 开机即自动生成，无需任何点击
  const wE = bootWith({ fit_health: { gender: '男', age: 30, height: 172, weight: 54, activity: '中度', goal: '增肌' } });
  const planE = JSON.parse(wE.localStorage.getItem('fit_plan') || 'null');
  ck('E1 开机自愈：fit_health 在、fit_plan 无 → 自动生成', !!planE && !!planE.weeks);
  ck('E2 自愈计划方向=增肌（BMI 18.2 偏瘦）', planE && planE.goal === '增肌');
  ck('E3 自愈计划带 fromHealth 标记（此后不再反复重生成）', planE && planE.fromHealth === true);
  wE.document.querySelector('#tabbar .tab[data-v="plan"]').click();
  const txtE = wE.document.body.textContent;
  const viewE = wE.document.querySelector('#view').textContent;
  ck('E4 自愈后计划页直接是结果页（非填写表单）', txtE.includes('我的 4 周计划') && !viewE.includes('生成我的 4 周计划') && viewE.includes('训练天'));

  // F) 旧版本遗留的通用计划（无 fromHealth/manual/edited、无打卡记录）→ 按档案重定向
  const fakeWeeks = [{ label: '第1周', tip: '', days: 1, totalMin: 0, totalKcal: 0, week: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(wd => ({ wd, rest: true })) }];
  const wF = bootWith({
    fit_health: { gender: '男', age: 30, height: 172, weight: 54, activity: '中度', goal: '增肌' },
    fit_plan: { goal: '保持健康', days: 2, length: 30, level: '新手', venue: 'home', weeks: fakeWeeks }
  });
  const planF = JSON.parse(wF.localStorage.getItem('fit_plan') || '{}');
  ck('F1 遗留通用计划被按档案重生成', planF.goal === '增肌');

  // G) 用户手动调过的计划（edited）→ 不覆盖
  const wG = bootWith({
    fit_health: { gender: '男', age: 30, height: 172, weight: 54, activity: '中度', goal: '增肌' },
    fit_plan: { goal: '保持健康', days: 2, length: 30, level: '新手', venue: 'home', weeks: fakeWeeks, edited: true }
  });
  const planG = JSON.parse(wG.localStorage.getItem('fit_plan') || '{}');
  ck('G1 手动编辑过的计划不被自愈覆盖', planG.goal === '保持健康');
} catch (e) {
  console.log('FAIL 自愈用例异常中断: ' + e.message);
  process.exitCode = 1;
}
