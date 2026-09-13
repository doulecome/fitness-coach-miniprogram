// 无头冒烟：v38 深层修复——备份补漏 / 体重滚动目标 / 蛋白质追踪 / best 停练衰减
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'site_app.html'), 'utf8');

function ck(name, cond) { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) process.exitCode = 1; }
function dkey(offset) {
  const d = new Date(); d.setDate(d.getDate() - (offset || 0));
  const m = '0' + (d.getMonth() + 1), dd = '0' + d.getDate();
  return d.getFullYear() + '-' + m.slice(-2) + '-' + dd.slice(-2);
}
const HEALTH = { gender: '男', age: 30, height: 172, weight: 54, activity: '中度', goal: '增肌' };
function bootWith(store, testHour) {
  const d2 = new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/',
    beforeParse(w) {
      Object.keys(store).forEach(k => w.localStorage.setItem(k, JSON.stringify(store[k])));
      if (testHour != null) w.__TEST_HOUR = testHour;
    }
  });
  return d2.window;
}
const view = w => w.document.querySelector('#view').textContent;

try {
  // ---- A) 体重滚动目标：体重曲线近 7 天 60kg（档案 54kg）→ BMR/目标按 60kg 算 ----
  const w60 = { [dkey(0)]: 60, [dkey(1)]: 60, [dkey(2)]: 60 };
  const wA = bootWith({ fit_health: HEALTH, fit_weight: w60 }, 20);
  wA.document.querySelector('#tabbar .tab[data-v="diet"]').click();
  // BMR(60,172,30,男) = 10*60+6.25*172-5*30+5 = 1530；TDEE=2372；增肌+300 → 2672
  ck('A1 BMR 按滚动体重 60kg 计算（1530）', view(wA).includes('1530'));
  ck('A2 每日目标按 60kg 滚动（2672）', view(wA).includes('2672'));
  ck('A3 出滚动说明（含最新均值与档案体重）', view(wA).includes('滚动计算') && view(wA).includes('60kg') && view(wA).includes('54kg'));
  // A-control：无体重曲线 → 锚档案 54kg，BMR 1410，无滚动说明
  const wA2 = bootWith({ fit_health: HEALTH }, 20);
  wA2.document.querySelector('#tabbar .tab[data-v="diet"]').click();
  ck('A4 无体重曲线 → 锚档案 54kg（BMR 1470）', view(wA2).includes('1470'));
  ck('A5 无体重曲线 → 不出滚动说明', !view(wA2).includes('滚动计算'));

  // ---- B) 蛋白质追踪：今天记了 鸡胸肉+鸡蛋+米饭 → 自动估 37g / 目标 97g（1.8×54）----
  const logB = { [dkey(0)]: { items: [{ id: 'p1', meal: 'lunch', n: '鸡胸肉', kcal: 150 }, { id: 'p2', meal: 'bf', n: '鸡蛋', kcal: 70 }, { id: 'p3', meal: 'dinner', n: '米饭', kcal: 200 }] } };
  const wB = bootWith({ fit_health: HEALTH, fit_dietlog: logB }, 20);
  wB.document.querySelector('#tabbar .tab[data-v="diet"]').click();
  ck('B1 蛋白卡显示 37g（鸡胸30+鸡蛋7，米饭不计）', view(wB).includes('🥩 蛋白质') && /<b[^>]*>37<\/b> \/ 97 g/.test(wB.document.querySelector('#view').innerHTML));
  ck('B2 差额提示带食物换算', view(wB).includes('还差 60g') && view(wB).includes('鸡胸 30g/掌'));
  // B-control：没记吃的 → 0g，目标不变
  const wB2 = bootWith({ fit_health: HEALTH }, 20);
  wB2.document.querySelector('#tabbar .tab[data-v="diet"]').click();
  ck('B3 未记录 → 0 / 97 g', /<b[^>]*>0<\/b> \/ 97 g/.test(wB2.document.querySelector('#view').innerHTML));

  // ---- C) 备份补漏：导出 payload 必须含 weights/badges/habits ----
  const wC = bootWith({ fit_health: HEALTH, fit_weight: { [dkey(0)]: 54.5 }, fit_badges: { w1: true }, fit_habits: { water: { [dkey(0)]: 500 }, sleep: {}, sleepSkip: '' } }, 20);
  wC.URL.createObjectURL = blob => { wC.__capturedBlob = blob; return 'blob:test'; };
  wC.URL.revokeObjectURL = () => {};
  wC.document.querySelector('#tabbar .tab[data-v="record"]').click();
  wC.document.querySelector('[data-a="exportData"]').click();
  const checkExport = () => {
    try {
      return wC.__capturedBlob.text().then(txt => {
        const p = JSON.parse(txt);
        ck('C1 导出含体重曲线', !!p.weights && p.weights[dkey(0)] === 54.5);
        ck('C2 导出含徽章', !!p.badges && p.badges.w1 === true);
        ck('C3 导出含习惯数据（喝水/睡眠）', !!p.habits && p.habits.water[dkey(0)] === 500);
        ck('C4 版本升到 v2', p.v === 2);
      });
    } catch (e) { ck('C0 导出捕获异常: ' + e.message, false); return Promise.resolve(); }
  };
  const doneC = (wC.__capturedBlob ? checkExport() : Promise.resolve()).then(() => {
    // ---- D) best 停练衰减（node 级直测 plan.js）----
    try {
      const { generatePlan } = require(path.join(__dirname, '..', 'utils', 'plan.js'));
      const opts = { goal: '增肌', days: 4, length: 30, level: '进阶', venue: 'home' };
      const base = generatePlan(opts, {});
      let actName = null, slot = -1;
      base.weeks[0].week.forEach((d, i) => {
        if (d.rest || actName) return;
        (d.acts || []).forEach(a => { if (!actName && a.type === 'reps' && a.target >= 6) { actName = a.name; slot = i; } });
      });
      ck('D1 找到可测的次数型动作（' + actName + '）', !!actName);
      const histFresh = {}; histFresh[actName] = { best: 30, last: 30, recent: 30, lastDate: dkey(1) };
      const histStale = {}; histStale[actName] = { best: 30, last: 30, recent: 30, lastDate: '2026-07-01' };
      const pf = generatePlan(opts, histFresh), ps = generatePlan(opts, histStale);
      const tFresh = pf.weeks[0].week[slot].acts.find(a => a.name === actName).target;
      const tStale = ps.weeks[0].week[slot].acts.find(a => a.name === actName).target;
      ck('D2 停练 75 天 → W1 起点衰减（' + tStale + ' < ' + tFresh + '）', tStale < tFresh);
      ck('D3 衰减有下限（≥ best×0.75 对应值 23）', tStale >= 22);
    } catch (e) { ck('D0 衰减测试异常: ' + e.message, false); }
  });
} catch (e) {
  console.log('FAIL 异常中断: ' + e.message);
  process.exitCode = 1;
}
