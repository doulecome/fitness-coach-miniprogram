/* v29 冒烟：常备食材归一化 + 调味料豁免 + 份量自适应 + 换一批有变化
   跑法：NODE_PATH=<node workspace>/node_modules node scripts/test_pantry.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'site_app.html'), 'utf8');
let pass = 0, fail = 0;
function ck(name, cond) { if (cond) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name); } }

function mk(ls) {
  return new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/',
    beforeParse(w) { Object.keys(ls || {}).forEach(function (k) { w.localStorage.setItem(k, JSON.stringify(ls[k])); }); }
  });
}

/* ---------- 1) 勾选清单：归一化 + 调味料豁免 ---------- */
console.log('[1] 常备食材勾选清单');
{
  const dom = mk({});
  const d = dom.window.document;
  d.querySelector('#tabbar .tab[data-v="diet"]').click();
  const chips = [...d.querySelectorAll('.chip[data-a="pantryTgl"]')].map(function (e) { return e.dataset.n; });
  ck('勾选清单已收敛（< 45 项，原 51 个碎别名）', chips.length > 0 && chips.length < 45);
  ck('别名已合并：「水煮蛋」不再单独出现', chips.indexOf('水煮蛋') < 0 && chips.indexOf('鸡蛋') >= 0);
  ck('别名已合并：鸡胸肉/鸡丁/去皮鸡腿 → 只剩「鸡肉」', chips.indexOf('鸡肉') >= 0 && chips.indexOf('鸡胸肉') < 0 && chips.indexOf('鸡丁') < 0 && chips.indexOf('去皮鸡腿') < 0);
  ck('别名已合并：「麦片」并入「燕麦」', chips.indexOf('麦片') < 0 && chips.indexOf('燕麦') >= 0);
  ck('调味料豁免：勾选清单里没有「橄榄油」', chips.indexOf('橄榄油') < 0);
  ck('调味料豁免：勾选清单里没有「照烧汁」「番茄酱」', chips.indexOf('照烧汁') < 0 && chips.indexOf('番茄酱') < 0);
  ck('泛指蔬菜已合并为一个「蔬菜」项', chips.filter(function (c) { return ['时蔬', '青菜', '混合蔬菜', '生菜番茄'].indexOf(c) >= 0; }).length === 0);
}

/* ---------- 2) 只勾「鸡肉」：含水煮蛋/鸡胸/鸡丁的菜不应因「鸡肉」被判缺料 ---------- */
console.log('[2] 归一化后缺料判断');
{
  const dom = mk({ fit_pantry: ['鸡肉'], fit_diet: { gender: '男', age: 28, height: 175, weight: 70, activity: '中度', goal: '增肌', training: false } });
  const d = dom.window.document;
  d.querySelector('#tabbar .tab[data-v="diet"]').click();
  let bad = 0, checked = 0;
  for (let i = 0; i < 25; i++) {
    const rg = d.querySelector('[data-a="dietRegen"]');
    if (rg) rg.click();
    [...d.querySelectorAll('.meal-card')].forEach(function (c) {
      const miss = c.querySelector('.bd.w');
      if (miss && /🧺 缺/.test(miss.textContent)) {
        checked++;
        if (/鸡肉|鸡胸肉|鸡丁|去皮鸡腿/.test(miss.textContent.replace(/🧺 缺[^：]*：/, ''))) bad++;
      }
    });
  }
  ck('25 轮换餐中，已勾的「鸡肉」从未被判为缺料（覆盖鸡胸肉/鸡丁/去皮鸡腿）', bad === 0 && checked > 0);
}

/* ---------- 3) 调味料不计缺料：全选后不应再出现缺料提示 ---------- */
console.log('[3] 全选后零缺料');
{
  const dom = mk({});
  const d = dom.window.document;
  d.querySelector('#tabbar .tab[data-v="diet"]').click();
  const all = d.querySelector('[data-a="pantryAll"]');
  if (all) all.click();
  let missCards = 0;
  for (let i = 0; i < 20; i++) {
    const rg = d.querySelector('[data-a="dietRegen"]');
    if (rg) rg.click();
    missCards += [...d.querySelectorAll('.meal-card')].filter(function (c) { return /🧺 缺/.test(c.textContent); }).length;
  }
  ck('全选食材后 20 轮换餐均无「缺料」标记（调味料不算缺）', missCards === 0);
}

/* ---------- 4) 份量自适应：热量目标高于菜品库上限时按倍数加量 ---------- */
console.log('[4] 份量自适应');
{
  const dom = mk({ fit_diet: { gender: '男', age: 28, height: 178, weight: 88, activity: '中度', goal: '增肌', training: false } });
  const d = dom.window.document;
  d.querySelector('#tabbar .tab[data-v="diet"]').click();
  const txt = d.querySelector('#view').textContent;
  ck('高热量目标下出现「按目标加量 ×N」', /按目标加量 ×\d/.test(txt));
  /* 份量确实被放大：菜品库单项上限约 200g，×2 量后应出现 >300g 的份量 */
  const grams = (txt.match(/(\d{3,})g/g) || []).map(function (s) { return parseInt(s, 10); });
  ck('份量数值被放大（出现 ≥400g 的项）', grams.some(function (g) { return g >= 400; }));
  /* 每餐热量之和应贴近当日目标（±15%） */
  const dayK = parseInt((txt.match(/(\d+)\s*千卡\/天/) || [])[1] || '0', 10);
  const mealKs = [...d.querySelectorAll('.meal-card .mc-k')].map(function (e) { return parseInt(e.textContent, 10) || 0; });
  const sum = mealKs.reduce(function (a, b) { return a + b; }, 0);
  ck('四餐热量之和贴近当日目标（dayK=' + dayK + ' 合计=' + sum + '，±15%）', dayK > 0 && Math.abs(sum - dayK) / dayK <= 0.15);
}

/* ---------- 5) 「换一批」在高热量目标下不再锁死同一道 ---------- */
console.log('[5] 换一批有变化');
{
  const dom = mk({ fit_diet: { gender: '男', age: 28, height: 178, weight: 88, activity: '中度', goal: '增肌', training: false } });
  const d = dom.window.document;
  d.querySelector('#tabbar .tab[data-v="diet"]').click();
  const combos = new Set();
  for (let i = 0; i < 20; i++) {
    const rg = d.querySelector('[data-a="dietRegen"]');
    if (rg) rg.click();
    combos.add([...d.querySelectorAll('.meal-card .mc-t')].map(function (e) { return e.textContent; }).join('+') +
      '|' + [...d.querySelectorAll('.meal-card')].map(function (e) { return (e.querySelector('.mc-p') || { textContent: '' }).textContent.trim(); }).join('+'));
  }
  ck('20 次换一批出现多种组合（旧逻辑锁死 1 种）', combos.size > 1);
  console.log('    实际组合数：' + combos.size);
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
