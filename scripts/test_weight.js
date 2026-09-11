/* v30 冒烟：体重里程碑徽章（按起点→目标动态生成三档，通用不写死具体 kg）
   跑法：NODE_PATH=<node workspace>/node_modules node scripts/test_weight.js */
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
/* 切到记录页（成就墙所在 tab），取其中的体重徽章块文本 */
function weightBadges(dom) {
  const d = dom.window.document;
  const tab = d.querySelector('#tabbar .tab[data-v="record"]');
  if (tab) tab.click();
  return [...d.querySelectorAll('.bdg')].filter(function (e) {
    return /体重第一阶|体重过半|体重达标/.test(e.textContent);
  });
}

/* ---------- 1) 增重场景：起点 54 → 目标 63，档位应为 57 / 60 / 63 ---------- */
console.log('[1] 增重场景（54 → 63）');
{
  const dom = mk({ fit_weight: { '2026-01-01': 54 }, fit_wgoal: 63 });
  const wb = weightBadges(dom);
  const t = wb.map(function (e) { return e.textContent; }).join(' | ');
  ck('成就墙出现 3 个体重里程碑', wb.length === 3);
  ck('第一档 = 起点+(目标-起点)/3 = 57 kg', t.includes('体重达到 57 kg'));
  ck('第二档 = 60 kg', t.includes('体重达到 60 kg'));
  ck('第三档 = 目标 63 kg', t.includes('体重达到 63 kg'));
  ck('起点即当前值时三档均未达成', wb.every(function (e) { return e.textContent.indexOf('已达成') < 0; }));
}

/* ---------- 2) 越过第一档：记录 57.5 后第一档解锁 ---------- */
console.log('[2] 越过第一档（记录 57.5）');
{
  const dom = mk({ fit_weight: { '2026-01-01': 54, '2026-01-05': 57.5 }, fit_wgoal: 63 });
  const wb = weightBadges(dom);
  ck('第一档已解锁', wb[0] && wb[0].textContent.indexOf('已达成') >= 0);
  ck('第二档仍未解锁', wb[1] && wb[1].textContent.indexOf('已达成') < 0);
  ck('第三档仍未解锁', wb[2] && wb[2].textContent.indexOf('已达成') < 0);
}

/* ---------- 3) 减重场景同构：起点 90 → 目标 72，档位 84/78/72，文案为「降到」 ---------- */
console.log('[3] 减重场景（90 → 72）');
{
  const dom = mk({ fit_weight: { '2026-01-01': 90 }, fit_wgoal: 72 });
  const wb = weightBadges(dom);
  const t = wb.map(function (e) { return e.textContent; }).join(' | ');
  ck('减重档位 = 84 / 78 / 72 kg', t.includes('体重降到 84 kg') && t.includes('体重降到 78 kg') && t.includes('体重降到 72 kg'));
  ck('减重场景不出现「达到」方向文案', t.indexOf('体重达到') < 0);
}

/* ---------- 4) 无体重数据：占位文案，不崩 ---------- */
console.log('[4] 无数据兜底');
{
  const dom = mk({});
  const wb = weightBadges(dom);
  ck('无体重记录时仍渲染 3 个占位徽章', wb.length === 3);
  ck('占位文案提示先记录', wb.every(function (e) { return e.textContent.indexOf('先记录体重并设定目标') >= 0; }));
}

/* ---------- 5) 起点=目标（跨度不足 0.5kg）：不生成无效里程碑 ---------- */
console.log('[5] 跨度不足兜底');
{
  const dom = mk({ fit_weight: { '2026-01-01': 70 }, fit_wgoal: 70.2 });
  const wb = weightBadges(dom);
  const t = wb.map(function (e) { return e.textContent; }).join(' | ');
  ck('跨度 < 0.5kg 时不生成具体档位（走占位）', t.indexOf('先记录体重并设定目标') >= 0);
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
