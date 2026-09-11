// 无头冒烟：身体数据分析器 ↔ 训练计划联动（v27）
// 覆盖：粘贴报告提取 → 锻炼建议块展示 → healthSave 联动计划重生成 → 血压红线降级强度 → 持久化恢复
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

try {
  // ---- 1) 记录页打开分析器，粘贴报告自动提取 ----
  tab('record');
  ck('记录页有分析器入口', bodyText().includes('开始分析我的数据'));
  click('[data-a="healthOpen"]');
  ck('表单打开', !!q('.ha-form'));

  const report = '体检报告\n身高 172.3 cm\n体重 61.5 kg\n收缩压 118 mmHg\n舒张压 74 mmHg\n脉搏 72 次/分\n尿酸 350 μmol/L\n空腹血糖 5.1 mmol/L\n2026-06-04';
  q('#reportPaste').value = report;
  q('#reportPaste').dispatchEvent(new window.Event('input', { bubbles: true }));
  click('[data-a="healthParse"]');
  ck('提取提示出现', toastText().includes('提取到'));

  // ---- 2) 保存：锻炼建议块出现 + 计划目标同步（尚无计划 → 不重生成） ----
  click('[data-a="healthSave"]');
  const t1 = toastText();
  ck('保存成功 toast', t1.includes('分析完成'));
  ck('无计划时不误报重生成', !t1.includes('训练计划已重新生成'));
  const recTxt = bodyText();
  ck('锻炼建议块出现', recTxt.includes('💪 锻炼建议'));
  ck('饮食建议标题分栏', recTxt.includes('🥗 饮食与恢复建议'));
  ck('有每周训练安排条目', recTxt.includes('每周') && recTxt.includes('力量'));
  ck('有去计划页入口', !!q('[data-a="tab"][data-v="plan"]'));

  // ---- 3) 生成一个计划 → 回来改数据（血压红线）→ 保存应重生成计划并降级强度 ----
  tab('plan');
  click('[data-a="genPlan"]');
  ck('计划已生成', bodyText().includes('第1周') || bodyText().includes('我的'));
  const planGoalBefore = bodyText().includes('增肌'); // 默认体重 65/172.3 BMI 正常，draft goal 沿用减脂 → 不应出现增肌
  tab('record');
  click('[data-a="healthOpen"]');
  // 改成明显超重 + 血压偏高 + 心率快
  setNum('weight', '88');
  setNum('sys', '155');
  setNum('dia', '95');
  setNum('hr', '96');
  click('[data-a="healthSave"]');
  const t2 = toastText();
  ck('血压红线 → toast 提示重生成', t2.includes('训练计划已重新生成'));
  ck('血压红线 → toast 提示强度降级', t2.includes('新手'));
  ck('出现强度红线建议', bodyText().includes('强度红线：血压偏高'));
  ck('BMI 超重 → 方向变减脂', bodyText().includes('方向：减脂'));

  // ---- 4) 计划页可正常渲染重生成后的计划 ----
  tab('plan');
  ck('重生成计划正常渲染', !!q('.phase-tabs') && bodyText().includes('第1周'));

  // ---- 5) 餐单选品按体检指标筛选（低嘌呤硬排除 / 低GI软优先）----
  // 说明：餐池热量上限约 470 千卡，若目标热量远高于它，选品会退化为"取最接近的一个"，
  //      随机性消失。故本段用 57kg + 久坐 + 减脂（目标≈1414，落在菜池窗口内）来保证真随机。
  tab('record');
  click('[data-a="healthOpen"]');
  setNum('weight', '57');
  setNum('ua', '396');
  const chipSe = document.querySelector('.ha-form .chip[data-k="activity"][data-v="久坐"]');
  if (chipSe) chipSe.click();
  const chipGoal = document.querySelector('.ha-form .chip[data-k="goal"][data-v="减脂"]');
  if (chipGoal) chipGoal.click(); /* 显式定方向：否则 BMI 正常时落到"维持"，热量偏高会让选品退化为固定值 */
  click('[data-a="healthSave"]');
  tab('diet');
  ck('饮食页有筛选提示卡', bodyText().includes('餐单已按你的体检指标筛选'));
  ck('提示低嘌呤优先', bodyText().includes('低嘌呤优先：已避开虾蟹贝'));
  let shrimpSeen = 0, riceWarn = false;
  const cardsText = () => Array.from(document.querySelectorAll('.meal-card')).map(e => e.textContent).join(' | ');
  for (let i = 0; i < 30; i++) {
    const rg = q('[data-a="dietRegen"]');
    if (rg) rg.click();
    const t = cardsText();
    if (/虾/.test(t)) shrimpSeen++;
    if (!/米饭|糙米|杂粮|藜麦|荞麦|红薯|燕麦|全麦/.test(t)) riceWarn = true;
  }
  ck('30 次换一批餐卡均未出现虾类菜品', shrimpSeen === 0);
  ck('仍能正常配出主食（未掏空池子）', !riceWarn);

  // 低GI：血糖偏高时主食应为粗粮优先（白米饭类退后）
  tab('record');
  click('[data-a="healthOpen"]');
  setNum('glu', '6.5');
  click('[data-a="healthSave"]');
  tab('diet');
  ck('低GI 提示出现', bodyText().includes('低 GI 优先'));
  ck('主食已是粗粮/全麦类（白米饭退后）', /糙米|杂粮|藜麦|荞麦|全麦|红薯/.test(bodyText()));

  // 清除数据 → 筛选关闭、餐单回到默认选品
  const savedBefore = JSON.parse(window.localStorage.getItem('fit_health') || 'null');
  ck('清除前 fit_health 已存本机（57/155/96/396）', !!savedBefore && savedBefore.weight === 57 && savedBefore.sys === 155 && savedBefore.hr === 96 && savedBefore.ua === 396);
  tab('record');
  click('[data-a="healthClear"]');
  ck('清除后提示消失', !bodyText().includes('餐单已按你的体检指标筛选'));
  tab('diet');
  ck('清除后筛选提示也消失', !bodyText().includes('餐单已按你的体检指标筛选'));
  let shrimpAfter = 0;
  for (let i = 0; i < 30; i++) {
    const rg = q('[data-a="dietRegen"]');
    if (rg) rg.click();
    if (/虾/.test(cardsText())) shrimpAfter++;
  }
  ck('对照组：无体检数据时虾类可正常出现（筛选确有作用）', shrimpAfter > 0);

  // ---- 6) 持久化：fit_health 写入本机，重开页面锻炼建议与筛选直接生效 ----
  const saved = JSON.parse(window.localStorage.getItem('fit_health') || 'null');
  ck('清除后 fit_health 已置空', saved === null);

  const dom2 = new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/',
    beforeParse(w) {
      try {
        w.localStorage.setItem('fit_health', JSON.stringify({ gender: '男', age: 28, height: 172.3, weight: 61.5, sys: 118, dia: 74, hr: 72, ua: 396, glu: 5.1, examDate: '2026-06-04' }));
      } catch (e) {}
    }
  });
  const d2 = dom2.window.document;
  const tab2 = d2.querySelector('#tabbar .tab[data-v="record"]');
  if (tab2) tab2.click();
  const txt2 = d2.querySelector('#view') ? d2.querySelector('#view').textContent : d2.body.textContent;
  ck('重开页面锻炼建议直接可用', txt2.includes('💪 锻炼建议'));
  const tabD = d2.querySelector('#tabbar .tab[data-v="diet"]');
  if (tabD) tabD.click();
  const txtD = d2.querySelector('#view').textContent;
  ck('重开页面饮食筛选生效（尿酸396→低嘌呤）', txtD.includes('低嘌呤优先'));
} catch (e) {
  console.log('FATAL ' + e.message);
  console.log(e.stack);
  process.exitCode = 1;
}
