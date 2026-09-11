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

  // ---- 5) 持久化：fit_health 写入本机，重开页面锻炼建议直接可用 ----
  const saved = JSON.parse(window.localStorage.getItem('fit_health') || 'null');
  ck('fit_health 已存本机', !!saved && saved.weight === 88 && saved.sys === 155);

  const dom2 = new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/',
    beforeParse(w) { try { w.localStorage.setItem('fit_health', JSON.stringify(saved)); } catch (e) {} }
  });
  const d2 = dom2.window.document;
  const tab2 = d2.querySelector('#tabbar .tab[data-v="record"]');
  if (tab2) tab2.click();
  const txt2 = d2.querySelector('#view') ? d2.querySelector('#view').textContent : d2.body.textContent;
  ck('重开页面锻炼建议直接可用', txt2.includes('💪 锻炼建议') && txt2.includes('强度红线：血压偏高'));
} catch (e) {
  console.log('FATAL ' + e.message);
  console.log(e.stack);
  process.exitCode = 1;
}
