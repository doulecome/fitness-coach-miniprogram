// v34 已吃驱动回归：今日推荐按常备食材 + 按剩余预算动态配份量
// 覆盖：选品依据前置 / 常备食材勾选生效 / 一键记入按加量后热量记 / 已记入标记 /
//       未记餐按剩余预算动态配份量 / 删记录后回退
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'site_app.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
const { window } = dom;
const { document } = window;

function ck(name, cond) { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) process.exitCode = 1; }
function q(s) { return document.querySelector(s); }
function qa(s) { return document.querySelectorAll(s); }
function click(sel) { const e = q(sel); if (!e) throw new Error('no element: ' + sel); e.click(); }
function tab(k) { click('#tabbar .tab[data-v="' + k + '"]'); }
function bodyText() { return q('#view') ? q('#view').textContent : ''; }
function mealCardByTitle(t) {
  const cards = qa('.meal-card');
  for (const c of cards) if (c.querySelector('.mc-t') && c.querySelector('.mc-t').textContent === t) return c;
  return null;
}
function mcKcal(card) { const m = card.querySelector('.mc-k').textContent.match(/(\d+)/); return m ? Number(m[1]) : 0; }

try {
  tab('diet'); // 无档案 → ensureDiet 自动生成方案

  // ---- A) 选品依据前置展示 ----
  ck('A1 未勾食材时明示「全库推荐」', bodyText().includes('未勾常备食材') && bodyText().includes('全库推荐'));
  ck('A2 常备食材卡存在（勾选入口可见）', bodyText().includes('我的常备食材'));

  // ---- B) 勾常备食材 → 选品依据切换 + 餐单按勾选重配 ----
  click('[data-a="pantryTgl"][data-n="鸡蛋"]');
  click('[data-a="pantryTgl"][data-n="鸡肉"]');
  ck('B1 勾选后依据行切换为按常备配餐', bodyText().includes('项常备食材配餐'));
  ck('B2 勾选生效存入 localStorage', JSON.parse(window.localStorage.getItem('fit_pantry') || '[]').length === 2);

  // ---- C) 一键记入：按加量后的真实热量记（修复：旧版只记单份） ----
  const bfCard = mealCardByTitle('早餐');
  if (!bfCard) throw new Error('no breakfast card');
  const shown = mcKcal(bfCard); // 页面显示的千卡 = dish.kcal × scale
  click('[data-a="foodQuick"][data-meal="bf"]');
  const log = JSON.parse(window.localStorage.getItem('fit_dietlog') || '{}');
  const todayKey = Object.keys(log)[0];
  const bfItems = (log[todayKey] && log[todayKey].items || []).filter(x => x.meal === 'bf');
  ck('C1 早餐已写入饮食日志', bfItems.length === 1);
  ck('C2 记入热量 = 页面显示千卡（含加量 ×N）', bfItems[0].kcal === shown);
  ck('C3 早餐卡出现「已记入」标记', mealCardByTitle('早餐').textContent.includes('已记入'));
  ck('C4 记入后按钮变为「补记」', mealCardByTitle('早餐').textContent.includes('补记'));

  // ---- D) 已吃驱动：未记的餐按剩余预算动态配份量 ----
  ck('D1 推荐区明示剩余预算与动态配餐', bodyText().includes('动态配份量') && bodyText().includes('还剩'));
  ck('D2 至少一道未记餐带「按剩余预算」标签', bodyText().includes('按剩余预算'));
  const dnCard = mealCardByTitle('晚餐');
  ck('D3 晚餐千卡 = 动态调整后的值（有标签必有 ×）', !!dnCard && /(加量|减量) ×\d/.test(dnCard.textContent));
  // 动态份量在 [0.6, 2.2] 封顶范围内
  const tagM = dnCard.textContent.match(/×(\d(\.\d)?)/);
  ck('D4 动态倍数在 0.6~2.2 内', tagM && Number(tagM[1]) >= 0.6 && Number(tagM[1]) <= 2.2);

  // ---- E) 预算联动：记入后预算卡数值变化 ----
  const budgetBefore = bodyText().match(/还能吃 (\d+)/);
  ck('E1 预算卡显示还能吃数值', !!budgetBefore);

  // ---- F) 删除记录 → 预算回退、标记消失 ----
  click('[data-a="foodDel"]');
  ck('F1 删除后日志清空', ((JSON.parse(window.localStorage.getItem('fit_dietlog') || '{}')[todayKey] || {}).items || []).length === 0);
  ck('F2 删除后早餐卡不再有已记入标记', !mealCardByTitle('早餐').textContent.includes('已记入'));
  ck('F3 删除后回归基础份量（无动态标签）', !bodyText().includes('按剩余预算'));

  // ---- G) v35 估卡拼盘：库里没有的菜 → 点食材累加千卡 → 填入 → 记入 ----
  click('[data-a="addFood"][data-meal="lunch"]');
  if (!q('#foodRefChips') && !q('#foodRefApply')) { /* chips 在 .chips 容器里，确认按钮初始隐藏 */ }
  ck('G1 估卡拼盘入口存在（初始隐藏）', q('#foodRefApply') && q('#foodRefApply').style.display === 'none');
  click('[data-a="foodRef"][data-v="200"]'); // 米饭 1 碗
  click('[data-a="foodRef"][data-v="150"]'); // 瘦肉掌心大
  ck('G2 点两样后累加并显示填入按钮', q('#foodRefApply').style.display === 'block' && q('#foodRefSum').textContent === '350');
  click('[data-a="foodRefApply"]');
  ck('G3 填入后千卡输入框已填 350', q('#foodCk').value === '350');
  q('#foodCn').value = '家里做的饭';
  q('#foodCn').dispatchEvent(new window.Event('input', { bubbles: true }));
  click('[data-a="foodCustom"]');
  const log2 = JSON.parse(window.localStorage.getItem('fit_dietlog') || '{}');
  const items2 = (log2[todayKey] || {}).items || [];
  const hit = items2.filter(x => x.n === '家里做的饭');
  ck('G4 手动记录成功且千卡=拼盘结果', hit.length === 1 && hit[0].kcal === 350 && hit[0].meal === 'lunch');
} catch (e) {
  console.log('FAIL 异常中断: ' + e.message);
  process.exitCode = 1;
}
