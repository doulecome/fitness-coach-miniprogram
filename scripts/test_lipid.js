// 无头冒烟：可选体检指标接口（v31）——血脂四项 / 体脂率 / 骨密度 T 值
// 核心契约：识别到就读取并分析；识别不到就整段跳过（无空条目、无报错、不影响其他指标）
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'site_app.html'), 'utf8');

function ck(name, cond) { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) process.exitCode = 1; }

/* ============ A 段：粘贴报告的文字提取 ============ */
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
const { window } = dom;
const { document } = window;
const q = s => document.querySelector(s);
const click = sel => { const e = q(sel); if (!e) throw new Error('no element: ' + sel); e.click(); };
const tab = k => click('#tabbar .tab[data-v="' + k + '"]');
const valOf = k => { const e = q('.ha-form input[data-k="' + k + '"]'); return e ? e.value : '(缺失)'; };
const paste = txt => {
  const ta = q('#reportPaste');
  ta.value = txt; ta.dispatchEvent(new window.Event('input', { bubbles: true }));
  click('[data-a="healthParse"]');
};
const bodyText = () => q('#view') ? q('#view').textContent : document.body.textContent;

try {
  // ---- A1) 报告里没有这三类指标 → 必须一项都不提取（不能瞎猜） ----
  tab('record');
  click('[data-a="healthOpen"]');
  paste('体检报告\n身高 172.3 cm\n体重 61.5 kg\n收缩压 118 mmHg\n舒张压 74 mmHg\n脉搏 72 次/分\n尿酸 350 μmol/L\n空腹血糖 5.1 mmol/L\n谷氨酰转肽酶 25\n2026-06-04');
  ck('A1 常规报告：血脂四项未被误提', valOf('tc') === '' && valOf('tg') === '' && valOf('hdl') === '' && valOf('ldl') === '');
  ck('A1 常规报告：体脂率未被误提', valOf('bfp') === '');
  ck('A1 常规报告：骨密度未被误提', valOf('bmd') === '');
  ck('A1 常规报告：原有指标仍正常提取', valOf('height') === '172.3' && valOf('ua') === '350' && valOf('glu') === '5.1');

  // ---- A2) 报告里有这三类指标 → 全部读出来 ----
  click('[data-a="healthCancel"]');
  click('[data-a="healthOpen"]');
  paste('体检报告\n身高 175 cm\n体重 70 kg\n总胆固醇 5.6 mmol/L\n甘油三酯 1.9 mmol/L\n高密度脂蛋白胆固醇 0.9 mmol/L\n低密度脂蛋白胆固醇 3.6 mmol/L\n体脂率 26.5 %\n骨密度 T 值 -1.5\n2026-06-04');
  ck('A2 总胆固醇读出', valOf('tc') === '5.6');
  ck('A2 甘油三酯读出', valOf('tg') === '1.9');
  ck('A2 HDL 读出', valOf('hdl') === '0.9');
  ck('A2 LDL 读出', valOf('ldl') === '3.6');
  ck('A2 体脂率读出', valOf('bfp') === '26.5');
  ck('A2 骨密度 T 值读出（负数）', valOf('bmd') === '-1.5');

  // ---- A3) 只有 HDL/LDL 没有「总胆固醇」→ 兜底逻辑不能把 HDL 的值当成总胆固醇 ----
  click('[data-a="healthCancel"]');
  click('[data-a="healthOpen"]');
  paste('高密度脂蛋白胆固醇 0.9\n低密度脂蛋白胆固醇 3.6');
  ck('A3 无「总胆固醇」时不被 HDL/LDL 误填', valOf('tc') === '');
  ck('A3 HDL 仍正确读出', valOf('hdl') === '0.9');

  // ---- A4) 骨密度 T 值 = 0 是合法值，不能被当成「没识别到」 ----
  click('[data-a="healthCancel"]');
  click('[data-a="healthOpen"]');
  paste('身高 175\n体重 70\n骨密度 T 值 0');
  ck('A4 T 值 0 被识别（非空）', valOf('bmd') === '0');
} catch (e) {
  console.log('FAIL A 段异常: ' + e.message);
  process.exitCode = 1;
}

/* ============ B 段：判定 / 展示 / 联动（注入不同指标组合重开页面） ============ */
function boot(health) {
  const d = new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/',
    beforeParse(w) { if (health) w.localStorage.setItem('fit_health', JSON.stringify(health)); }
  });
  const doc = d.window.document;
  const t = doc.querySelector('#tabbar .tab[data-v="record"]');
  if (t) t.click();
  return {
    dom: d, doc,
    txt: () => doc.querySelector('#view') ? doc.querySelector('#view').textContent : doc.body.textContent,
    goDiet: () => { const e = doc.querySelector('#tabbar .tab[data-v="diet"]'); if (e) e.click(); }
  };
}
const BASE = { gender: '男', age: 28, height: 175, weight: 70, activity: '中度' };

try {
  // ---- B1) 老档案（无新增字段）→ 整块不出现，且不报错 ----
  const b1 = boot(Object.assign({}, BASE, { examDate: '2026-06-04' }));
  const t1 = b1.txt();
  ck('B1 无指标时不显示「体检指标」块', !t1.includes('📋 体检指标'));
  ck('B1 无指标时无血脂文案', !t1.includes('血脂'));
  ck('B1 无指标时无体脂率文案', !t1.includes('体脂率'));
  ck('B1 无指标时无骨密度指标与判定', !t1.includes('骨密度 T 值') && !t1.includes('骨量减少') && !t1.includes('骨质疏松'));
  ck('B1 无指标时不出现血脂有氧补充', !t1.includes('有氧补充：血脂偏高'));
  ck('B1 无指标时不出现骨密度训练条', !t1.includes('负重抗阻') && !t1.includes('强度红线：骨质疏松'));
  ck('B1 基础分析仍正常（锻炼建议 + 饮食建议）', t1.includes('💪 锻炼建议') && t1.includes('🥗 饮食与恢复建议'));

  // ---- B2) 血脂四项全异常 → 判定 + 指标块 + 训练有氧补充 + 餐单低GI联动 ----
  const b2 = boot(Object.assign({}, BASE, { tc: 6.5, tg: 2.5, hdl: 0.8, ldl: 4.3 }));
  const t2 = b2.txt();
  ck('B2 判定为「血脂异常」', t2.includes('血脂异常'));
  ck('B2 列出异常项', t2.includes('总胆固醇 6.5') && t2.includes('甘油三酯 2.5') && t2.includes('HDL 0.8') && t2.includes('LDL 4.3'));
  ck('B2 给出 LDL/TC 方向（少饱和脂肪）', t2.includes('饱和脂肪与反式脂肪'));
  ck('B2 给出 HDL 偏低方向', t2.includes('好胆固醇不足'));
  ck('B2 显示「体检指标」块且 4 个标签齐全', t2.includes('📋 体检指标') && t2.includes('总胆固醇 6.5 ↑ 偏高') && t2.includes('HDL 0.8 ↓ 偏低'));
  ck('B2 训练建议追加有氧补充', t2.includes('有氧补充：血脂偏高'));
  b2.goDiet();
  const d2 = b2.txt();
  ck('B2 餐单按低GI 联动筛选', d2.includes('餐单已按你的体检指标筛选') && d2.includes('低 GI 优先'));
  ck('B2 餐单未误开低嘌呤（无尿酸数据）', !d2.includes('低嘌呤优先'));

  // ---- B3) 仅单项边缘（TG 1.9）→ 也能判定，标为「边缘偏高」 ----
  const b3 = boot(Object.assign({}, BASE, { tg: 1.9 }));
  const t3 = b3.txt();
  ck('B3 单项边缘也能判定', t3.includes('血脂边缘偏高') && t3.includes('甘油三酯 1.9'));
  ck('B3 单项边缘仍标为边缘（非偏高）', t3.includes('甘油三酯 1.9 ↑ 边缘'));
  ck('B3 只有一项时不出现未填项', !t3.includes('总胆固醇') && !t3.includes('HDL') && !t3.includes('体脂率'));

  // ---- B4) 血脂正常 → 不进建议列表，但指标块显示「正常」 ----
  const b4 = boot(Object.assign({}, BASE, { tc: 4.2, tg: 1.1, hdl: 1.4, ldl: 2.5 }));
  const t4 = b4.txt();
  ck('B4 血脂正常时不进建议列表', !t4.includes('血脂异常') && !t4.includes('血脂边缘偏高'));
  ck('B4 血脂正常时指标块显示正常', t4.includes('总胆固醇 4.2 ✓ 正常') && t4.includes('LDL 2.5 ✓ 正常'));
  ck('B4 血脂正常时不追加有氧补充', !t4.includes('有氧补充：血脂偏高'));

  // ---- B5) 体脂率偏高 + BMI 正常 + 未指定目标 → 方向改判减脂 ----
  const b5 = boot(Object.assign({}, BASE, { bfp: 26.5 }));
  const t5 = b5.txt();
  ck('B5 体脂偏高给隐性肥胖提示', t5.includes('体脂率偏高（26.5%）') && t5.includes('隐性肥胖'));
  ck('B5 方向自动改判为减脂', t5.includes('方向：减脂'));
  ck('B5 指标块显示体脂率', t5.includes('体脂率 26.5% ↑ 偏高'));

  // ---- B6) 体脂率正常 → 提示不出现，但指标块显示正常 ----
  const b6 = boot(Object.assign({}, BASE, { bfp: 15 }));
  const t6 = b6.txt();
  ck('B6 体脂正常时无偏高提示', !t6.includes('体脂率偏高'));
  ck('B6 体脂正常时指标块显示正常', t6.includes('体脂率 15% ✓ 正常'));

  // ---- B7) 骨量减少（T -1.5）→ 提示 + 训练重点 ----
  const b7 = boot(Object.assign({}, BASE, { bmd: -1.5 }));
  const t7 = b7.txt();
  ck('B7 判定骨量减少', t7.includes('骨量减少') && t7.includes('T 值 -1.5'));
  ck('B7 训练追加负重抗阻重点', t7.includes('训练重点：负重抗阻'));
  ck('B7 未误报骨质疏松红线', !t7.includes('强度红线：骨质疏松'));
  ck('B7 指标块显示骨密度为边缘', t7.includes('骨密度 T 值 -1.5 ↑ 边缘'));

  // ---- B8) 骨质疏松（T -3）→ 红线提示 ----
  const b8 = boot(Object.assign({}, BASE, { bmd: -3 }));
  const t8 = b8.txt();
  ck('B8 判定骨质疏松范围', t8.includes('骨质疏松范围'));
  ck('B8 训练出现骨质疏松红线', t8.includes('强度红线：骨质疏松'));
  ck('B8 未再叠加负重抗阻条（红线优先）', !t8.includes('训练重点：负重抗阻'));

  // ---- B9) T 值 0（正常）→ 只展示不提示 ----
  const b9 = boot(Object.assign({}, BASE, { bmd: 0 }));
  const t9 = b9.txt();
  ck('B9 T 值 0 被识别并显示正常', t9.includes('骨密度 T 值 0 ✓ 正常'));
  ck('B9 T 值 0 不产生骨密度建议条目', !t9.includes('骨量减少') && !t9.includes('骨质疏松'));

  // ---- B10) 与既有指标叠加：血压红线 + 血脂异常 + 低嘌呤，互不干扰 ----
  const b10 = boot(Object.assign({}, BASE, { sys: 155, dia: 95, ua: 420, tg: 2.6, ldl: 4.5 }));
  const t10 = b10.txt();
  ck('B10 血压红线仍在', t10.includes('强度红线：血压偏高'));
  ck('B10 血脂判定仍在', t10.includes('血脂异常'));
  b10.goDiet();
  const d10 = b10.txt();
  ck('B10 低嘌呤与低GI 同时生效', d10.includes('低嘌呤优先') && d10.includes('低 GI 优先'));

  // ---- B11) 清除数据 → 可选指标一起清掉，回到无指标状态 ----
  const b11 = boot(Object.assign({}, BASE, { tc: 5.9, bfp: 27 }));
  b11.doc.querySelector('[data-a="healthClear"]').click();
  const t11 = b11.txt();
  ck('B11 清除后指标块消失', !t11.includes('📋 体检指标'));
  ck('B11 清除后无残留血脂文案', !t11.includes('血脂'));
  ck('B11 清除后回到入口卡', t11.includes('开始分析我的数据'));
} catch (e) {
  console.log('FAIL B 段异常: ' + e.message);
  process.exitCode = 1;
}
