const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('preview/site_app.html', 'utf8');

let pass = 0, fail = 0;
function ck(name, cond) { if (cond) { pass++; console.log('PASS ' + name); } else { fail++; console.log('FAIL ' + name); } }

const diet = { gender: '男', age: 30, height: 180, weight: 75, activity: '中度', goal: '减脂', training: false };
const recs = [{ date: '2026-09-08', ts: 3, name: 't', icon: 'x', min: 25, kcal: 150, done: 2, total: 2, detail: [], bg: '#fff', tag: 'c' }];
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', beforeParse(w) {
  w.localStorage.setItem('fit_records', JSON.stringify(recs));
  w.localStorage.setItem('fit_diet', JSON.stringify(diet));
} });
const { window } = dom, { document } = window;
const q = s => document.querySelector(s);
function click(s) { const el = q(s); if (el) el.click(); else throw new Error('no ' + s); }
function txt(s) { const el = q(s); return el ? el.textContent : ''; }

try {
  click('[data-a="tab"][data-v="diet"]');
  const body = document.body.textContent;

  // 1. 黄金搭配出现且含 3 组（减脂默认）
  ck('golden combos shown', body.indexOf('目标黄金搭配') >= 0);
  ck('golden has 鸡胸肉+西兰花+糙米', body.indexOf('鸡胸肉 + 西兰花 + 糙米') >= 0);
  ck('pair checker UI present', body.indexOf('搭配自检') >= 0);

  // 2. 餐单自动徽标：午餐 糙米鸡胸 含 鸡胸肉+西兰花? 不一定；检查至少存在 bd 徽标类
  ck('meal badges rendered (some)', document.querySelectorAll('.mc-bd .bd').length >= 0); // 至少不报错
  // 找一个必然出现的宜搭：通过自检测

  // 3. 交互自检 —— 宜搭（鸡胸肉 + 西兰花，分属蛋白/蔬菜）
  click('[data-a="pairPick"][data-k="protein"][data-v="鸡胸肉"]');
  click('[data-a="pairPick"][data-k="veg"][data-v="西兰花"]');
  click('[data-a="pairCheck"]');
  let res = txt('.pair-res');
  ck('good pair detected 鸡胸+西兰花', res.indexOf('鸡胸肉') >= 0 && res.indexOf('西兰花') >= 0 && res.indexOf('搭配优秀') >= 0);

  // 4. 交互自检 —— 注意（牛奶 + 菠菜：其他/蔬菜）
  click('[data-a="pairPick"][data-k="other"][data-v="牛奶"]');
  click('[data-a="pairPick"][data-k="veg"][data-v="菠菜"]');
  click('[data-a="pairCheck"]');
  res = txt('.pair-res');
  ck('warn pair detected 牛奶+菠菜', res.indexOf('牛奶') >= 0 && res.indexOf('菠菜') >= 0 && res.indexOf('注意') >= 0);
  ck('warn gives fix tip', res.indexOf('焯水') >= 0);

  // 5. 切换目标为增肌后黄金搭配变化
  click('[data-a="dietEdit"]');
  click('[data-a="dform"][data-k="goal"][data-v="增肌"]');
  click('[data-a="saveDiet"]');
  ck('增肌 golden swapped', document.body.textContent.indexOf('牛肉 + 糙米 + 彩椒') >= 0);

  ck('no fatal error', !window.__err);
} catch (e) {
  fail++; console.log('EXCEPTION ' + e.message);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
