// 无头冒烟：v37 习惯联动——早晨一问/睡眠→训练联动/喝水计数/7天滚动校准/练后补给
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'site_app.html'), 'utf8');

function ck(name, cond) { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) process.exitCode = 1; }

/* 与 app 内 todayStr 同格式 */
function dkey(offset) {
  const d = new Date(); d.setDate(d.getDate() - (offset || 0));
  const m = '0' + (d.getMonth() + 1), dd = '0' + d.getDate();
  return d.getFullYear() + '-' + m.slice(-2) + '-' + dd.slice(-2);
}
/* 7 天全是训练日的假计划（fromHealth 防自愈重生成）——保证"今天是训练日" determinable */
function allTrainPlan() {
  const wds = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return {
    goal: '增肌', days: 7, length: 30, level: '进阶', venue: 'home', fromHealth: true,
    weeks: [{ label: '第1周', tip: '', days: 7, totalMin: 210, totalKcal: 1200, week: wds.map(wd => ({ wd, rest: false, type: 'push', typeName: '推力训练', icon: '💪', muscle: '胸·肩', duration: 30, acts: [], seq: [], custom: 0 })) }]
  };
}
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
const HEALTH = { gender: '男', age: 30, height: 172, weight: 54, activity: '中度', goal: '增肌' };

try {
  // ---- A) 早晨一问：上午打开 + 没答过 → 出三按钮；喝水条目标按体重自动算 ----
  const wA = bootWith({ fit_health: HEALTH, fit_plan: allTrainPlan() }, 9);
  const $A = s => wA.document.querySelector(s);
  const txtA = () => wA.document.querySelector('#view').textContent;
  ck('A1 上午打开且未答 → 早晨一问出现', txtA().includes('昨晚几点睡的'));
  ck('A2 三个选项齐', $A('[data-a="sleepAns"][data-v="0"]') && $A('[data-a="sleepAns"][data-v="1"]') && $A('[data-a="sleepAns"][data-v="2"]'));
  ck('A3 喝水目标按体重 54kg 自动算（1.9L）', txtA().includes('1.9 L'));
  ck('A4 未答过 → 无睡眠联动卡', !txtA().includes('换成舒缓恢复日'));

  // ---- B) 答"1 点后" → 记录 + toast 说明用途 + 出换恢复日卡 ----
  $A('[data-a="sleepAns"][data-v="2"]').click();
  const hb = JSON.parse(wA.localStorage.getItem('fit_habits'));
  ck('B1 答案已存（sleep[today]=2）', hb.sleep[dkey(0)] === 2);
  ck('B2 toast 说明答案的用途', wA.document.querySelector('#toast').textContent.includes('舒缓恢复'));
  ck('B3 睡眠联动卡出现（今天训练日 + 1 点后睡）', txtA().includes('换成舒缓恢复日') && txtA().includes('仍按计划练'));
  ck('B4 一问已答 → 早晨问句消失', !txtA().includes('昨晚几点睡的'));

  // ---- C) 点"换成舒缓恢复日" → 今天真的变恢复日，卡消失 ----
  $A('[data-a="sleepRest"]').click();
  const planC = JSON.parse(wA.localStorage.getItem('fit_plan'));
  const jdC = new Date().getDay(), slotC = jdC === 0 ? 6 : jdC - 1;
  ck('C1 今日训练槽位已换成舒缓恢复日', planC.weeks[0].week[slotC].typeName === '舒缓恢复日' && planC.weeks[0].week[slotC].recovered === true);
  ck('C2 换完后联动卡消失', !txtA().includes('换成舒缓恢复日'));

  // ---- D) 喝水：首页 +250 → 饮食页 +250/-250 实时变 ----
  $A('[data-a="waterAdd"][data-v="250"]').click();
  ck('D1 首页点一下 +250 → 0.25L', txtA().includes('0.25'));
  wA.document.querySelector('#tabbar .tab[data-v="diet"]').click();
  const dtA = () => wA.document.querySelector('#view').textContent;
  ck('D2 饮食页喝水卡存在', dtA().includes('喝水') && wA.document.querySelector('[data-a="waterAdd"][data-v="-250"]'));
  wA.document.querySelector('[data-a="waterAdd"][data-v="250"]').click();
  ck('D3 再 +250 → 0.50L', dtA().includes('0.50'));
  wA.document.querySelector('[data-a="waterAdd"][data-v="-250"]').click();
  ck('D4 减 250 → 回 0.25L', dtA().includes('0.25'));

  // ---- E) 7 天滚动校准：前 3 天都吃超 → 今日目标自动 -5% ----
  const overLog = {};
  [1, 2, 3].forEach(i => { overLog[dkey(i)] = { items: [{ id: 'x' + i, meal: 'dinner', n: '大餐', kcal: 5000 }] }; });
  const wE = bootWith({ fit_health: HEALTH, fit_dietlog: overLog }, 20);
  const txtE = () => wE.document.querySelector('#view').textContent;
  wE.document.querySelector('#tabbar .tab[data-v="diet"]').click();
  ck('E1 连续 3 天吃超 → 出自动下调横幅', txtE().includes('连续 3 天吃超预算') && txtE().includes('自动下调 5%'));
  ck('E2 横幅带具体减掉的千卡数', /下调 5%（-\d+ 千卡）/.test(txtE()));

  // E-control：只超 2 天 → 不触发
  const overLog2 = {};
  [1, 2].forEach(i => { overLog2[dkey(i)] = { items: [{ id: 'y' + i, meal: 'dinner', n: '大餐', kcal: 5000 }] }; });
  const wE2 = bootWith({ fit_health: HEALTH, fit_dietlog: overLog2 }, 20);
  wE2.document.querySelector('#tabbar .tab[data-v="diet"]').click();
  ck('E3 只超 2 天 → 不触发下调', !wE2.document.querySelector('#view').textContent.includes('连续 3 天吃超预算'));

  // ---- F) 增肌目标 + 连续 3 天没吃够 → 提示横幅（不自动改目标） ----
  const underLog = {};
  [1, 2, 3].forEach(i => { underLog[dkey(i)] = { items: [{ id: 'z' + i, meal: 'bf', n: '一个鸡蛋', kcal: 70 }] }; });
  const wF = bootWith({ fit_health: HEALTH, fit_dietlog: underLog }, 20);
  wF.document.querySelector('#tabbar .tab[data-v="diet"]').click();
  ck('F1 连续 3 天没吃够 → 出提醒横幅', wF.document.querySelector('#view').textContent.includes('连续 3 天没吃够'));

  // ---- G) 运动→饮食结构：今天练过 → 晚餐练后补给；今天没练且休息日 → 清淡 ----
  const recToday = [{ date: dkey(0), name: '训练', min: 30, kcal: 300, icon: '🏋️' }];
  const wG = bootWith({ fit_health: HEALTH, fit_records: recToday }, 20);
  wG.document.querySelector('#tabbar .tab[data-v="diet"]').click();
  const txtG = wG.document.querySelector('#view').textContent;
  ck('G1 今天已练 → 晚餐练后补给说明', txtG.includes('练后补给') && txtG.includes('300 千卡'));
  const wG2 = bootWith({ fit_health: HEALTH }, 20);
  wG2.document.querySelector('#tabbar .tab[data-v="diet"]').click();
  ck('G2 没练且休息日 → 晚餐清淡说明', wG2.document.querySelector('#view').textContent.includes('休息日 · 晚餐按清淡配'));

  // ---- H) 计划页睡眠提示：答了"23-1 点" → 计划页出温和降强度提示 ----
  const wH = bootWith({ fit_health: HEALTH, fit_plan: allTrainPlan(), fit_habits: { water: {}, sleep: { [dkey(0)]: 1 }, sleepSkip: '' } }, 20);
  wH.document.querySelector('#tabbar .tab[data-v="plan"]').click();
  ck('H1 计划页出现睡眠降强度提示', wH.document.querySelector('#view').textContent.includes('昨晚睡得偏晚'));

  // ---- I) 下午打开（≥15 点）且没答 → 不弹早晨一问（不打扰） ----
  const wI = bootWith({ fit_health: HEALTH, fit_plan: allTrainPlan() }, 20);
  ck('I1 下午且未答 → 不弹一问', !wI.document.querySelector('#view').textContent.includes('昨晚几点睡的'));
  ck('I2 习惯条仍显示"睡眠未记"', wI.document.querySelector('#view').textContent.includes('睡眠未记'));
} catch (e) {
  console.log('FAIL 异常中断: ' + e.message);
  process.exitCode = 1;
}
