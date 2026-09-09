// 诊断脚本：复现"今日餐单"与 AI 姿态两个用户反馈
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'site_app.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
const { window } = dom;
const { document } = window;
const errors = [];
window.addEventListener('error', e => errors.push(e.message));

function click(sel) {
  const e = document.querySelector(sel);
  if (!e) throw new Error('no element: ' + sel);
  e.click();
}
function q(s) { return document.querySelector(s); }

// 场景A：饮食 tab 首次进入（无 fit_diet）→ 是否直接能看到今日餐单？
click('[data-a="tab"][data-v="diet"]');
const hasForm = !!q('[data-a="saveDiet"]');
console.log('A1 首次进入饮食tab显示的是表单? ' + hasForm);
console.log('A2 首次进入能否直接看到"今日餐单"? ' + document.body.innerHTML.includes('今日餐单'));

// 场景B：填表生成方案 → 今日餐单是否出现
['age', 'height', 'weight'].forEach(k => {
  const f = q('.fld[data-k="' + k + '"]');
  f.value = k === 'age' ? '28' : k === 'height' ? '175' : '70';
});
click('.chip[data-a="dform"][data-v="男"]');
click('.chip[data-a="dform"][data-v="减脂"]');
click('[data-a="saveDiet"]');
const hasMeal = document.body.innerHTML.includes('今日餐单');
console.log('B1 生成方案后"今日餐单"出现? ' + hasMeal);
const mealCards = document.querySelectorAll('.meal-card');
console.log('B2 餐卡数量: ' + mealCards.length);

// 场景C：二次渲染（切走再切回）餐单是否稳定
const firstMeal = q('.meal-card .mc-t');
const firstName = firstMeal ? firstMeal.textContent : 'NONE';
click('[data-a="tab"][data-v="home"]');
click('[data-a="tab"][data-v="diet"]');
const secondMeal = q('.meal-card .mc-t');
const secondName = secondMeal ? secondMeal.textContent : 'NONE';
console.log('C1 切走再切回后餐单稳定? ' + (firstName === secondName) + ' (' + firstName + ' vs ' + secondName + ')');

// 场景D：训练 tab 中 AI 姿态入口
click('[data-a="tab"][data-v="train"]');
console.log('D1 训练tab有AI姿态chip? ' + !!q('[data-a="seg"][data-v="pose"]'));

console.log('--- runtime errors ---');
console.log(errors.length ? errors.join('\n') : '(none)');
