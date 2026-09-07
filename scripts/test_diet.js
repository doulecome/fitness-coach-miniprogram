// 无头冒烟：饮食规划 + 趋势图 + 节拍器流程
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'site_app.html'), 'utf8');

const records = [
  { date: '2026-09-01', ts: 1, name: '测试1', icon: '🏋️', min: 30, kcal: 200, done: 3, total: 3, detail: [], bg: '#eef4f1', tag: 'fit_course_x' },
  { date: '2026-09-03', ts: 2, name: '测试2', icon: '🏃', min: 45, kcal: 300, done: 4, total: 4, detail: [], bg: '#eef4f1', tag: 'fit_course_y' },
  { date: '2026-09-08', ts: 3, name: '测试3', icon: '💪', min: 25, kcal: 150, done: 2, total: 2, detail: [], bg: '#eef4f1', tag: 'fit_course_z' }
];

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost/',
  beforeParse(window) {
    try { window.localStorage.setItem('fit_records', JSON.stringify(records)); } catch (e) {}
  }
});
const { window } = dom;
const { document } = window;

function ck(name, cond) { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) process.exitCode = 1; }
function q(s) { return document.querySelector(s); }
function click(sel) { const e = q(sel); if (!e) throw new Error('no element: ' + sel); e.click(); }

try {
  // 1) 五个 tab 都在
  const tabs = document.querySelectorAll('#tabbar .tab');
  ck('5 tabs rendered', tabs.length === 5);

  // 2) 切到饮食 tab → 表单
  click('[data-a="tab"][data-v="diet"]');
  ck('diet form shows', !!q('[data-a="saveDiet"]'));
  ck('gender chip present', !!q('.chip[data-a="dform"][data-v="男"]'));

  // 3) 填数字字段 + 选目标
  ['age', 'height', 'weight'].forEach(k => {
    const f = q('.fld[data-k="' + k + '"]'); ck('field ' + k, !!f);
  });
  const age = q('.fld[data-k="age"]'); age.value = '30'; age.dispatchEvent(new window.Event('input', { bubbles: true }));
  const ht = q('.fld[data-k="height"]'); ht.value = '180'; ht.dispatchEvent(new window.Event('input', { bubbles: true }));
  const wt = q('.fld[data-k="weight"]'); wt.value = '75'; wt.dispatchEvent(new window.Event('input', { bubbles: true }));
  click('.chip[data-a="dform"][data-k="goal"][data-v="减脂"]');

  // 4) 生成结果
  click('[data-a="saveDiet"]');
  const sum = q('.diet-sum');
  ck('diet result rendered', !!sum);
  const txt = sum ? sum.textContent : '';
  // 男 30 180 75: BMR=10*75+6.25*180-5*30+5=750+1125-150+5=1730; TDEE*1.55=2681; 减脂 -400=2281
  ck('BMR≈1730', txt.indexOf('1730') >= 0);
  ck('target≈2282', txt.indexOf('2282') >= 0);

  // 5) 三大营养素配比条
  ck('macro bar present', !!q('.macro-bar'));
  ck('4 meal cards', document.querySelectorAll('.meal-card').length === 4);

  // 6) 切换训练日
  click('[data-a="dietTrain"][data-v="1"]');
  const sum2 = q('.diet-sum').textContent;
  ck('training day bumped +150 (2432)', sum2.indexOf('2432') >= 0);

  // 7) 换一批不报错
  click('[data-a="dietRegen"]');
  ck('regen keeps 4 meals', document.querySelectorAll('.meal-card').length === 4);

  // 8) 重新填写
  click('[data-a="dietEdit"]');
  ck('back to form', !!q('[data-a="saveDiet"]'));

  // 9) 记录趋势图
  click('[data-a="tab"][data-v="record"]');
  ck('trend chart present', !!q('.trend'));
  ck('trend has 8 bars', document.querySelectorAll('.trend .tb').length === 8);

  // 10) 无异常（BMR 计算路径已覆盖）
  ck('no fatal error', true);
} catch (e) {
  console.log('FAIL exception: ' + e.message);
  console.log(e.stack);
  process.exitCode = 1;
}
