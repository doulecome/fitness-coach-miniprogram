// 生成 plan_preview.html：把 v4 AI 计划的样例（多个目标×水平）渲染成浏览器可看的静态预览
const fs = require('fs');
const path = require('path');
const { generatePlan } = require('../utils/plan.js');

const MOCK_HIST = {
  '卷腹': { best: 24, last: 24 }, '标准俯卧撑': { best: 20, last: 20 }, '深蹲': { best: 30, last: 28 },
  '仰卧举腿': { best: 16, last: 14 }, '开合跳': { best: 50, last: 46 }, '臀桥': { best: 24, last: 22 }
};
const CASES = [
  { goal: '减脂', days: 4, length: 30, level: '新手' },
  { goal: '增肌', days: 5, length: 30, level: '进阶' },
  { goal: '塑形', days: 4, length: 45, level: '老手' },
  { goal: '拉伸放松', days: 4, length: 15, level: '新手' }
];

const tagOf = a => a.fin ? '<span class="t fin">收尾</span>' : a.cool ? '<span class="t cool">冷身</span>' : '<span class="t main">主项</span>';
const actLine = a => `${tagOf(a)} ${a.name} ${a.round > 1 ? `<b>×${a.round}</b>` : ''} <em>${a.target}${a.unit}</em>`;
const weekCard = (w, wk) => `
  <div class="wk">
    <div class="wk-h"><b>第${wk + 1}周</b> · ${w.label} · ${w.days}天 · ${w.totalMin}分钟 · ${w.totalKcal}千卡</div>
    <div class="days">${w.week.map(d => d.rest
      ? `<div class="day rest">${d.wd}<div class="r">💤</div></div>`
      : `<div class="day"><div class="dn">${d.wd} ${d.icon} ${d.typeName}</div><div class="dm">${d.muscle} · 约${d.duration}′${d.custom ? ' · 🧠' + d.custom : ''}</div>
         <div class="acts">${d.acts.map(actLine).join('')}</div>
         <div class="warm">🔥 ${d.warm || '低强度放松'}</div>
         <div class="coach">💬 ${d.coach}</div></div>`).join('')}</div>
  </div>`;

const html = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI 计划 v4 样例预览</title>
<style>
body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:#f4f6f8;color:#222;margin:0;padding:24px}
h1{font-size:22px;margin:4px 0 2px}h2{font-size:16px;margin:30px 0 6px;color:#0e7d5f}
.sub{color:#888;font-size:12px;margin-bottom:14px}
.case{background:#fff;border-radius:12px;padding:18px;margin-bottom:20px;box-shadow:0 4px 14px rgba(0,0,0,.05)}
.wk{border-top:1px solid #eee;margin-top:14px;padding-top:10px}
.wk-h{font-size:13px;color:#444;margin-bottom:8px}
.days{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.day{background:#fbfcfd;border:1px solid #eef0f2;border-radius:10px;padding:10px}
.day.rest{background:#f2f3f5;text-align:center;color:#999}
.dn{font-weight:700;font-size:13px}
.dm{font-size:11px;color:#888;margin:3px 0 8px}
.acts{display:flex;flex-direction:column;gap:3px;font-size:12px}
.acts b{color:#14B085}
.acts em{font-style:normal;color:#444;font-weight:700}
.t{font-size:10px;border-radius:4px;padding:1px 6px;margin-right:5px;color:#fff}
.t.main{background:#8a2be2}.t.fin{background:#0e7d5f}.t.cool{background:#2b6bb0}
.warm{font-size:11px;color:#a05a00;background:#fff6e8;border-radius:8px;padding:6px 8px;margin-top:8px}
.coach{font-size:11px;color:#0e7d5f;background:#eef9f5;border-radius:8px;padding:6px 8px;margin-top:5px}
.note{font-size:12px;color:#666;background:#fff8e6;border-radius:8px;padding:8px 10px;margin-top:8px}
</style></head><body>
<h1>AI 动态训练计划 · v4 样例</h1>
<div class="sub">模拟成绩历史注入：卷腹24 / 标准俯卧撑20 / 深蹲30 / 开合跳50 …（真实使用中来自你的跟练记录，练得越多越贴你）</div>
${CASES.map(c => {
  const p = generatePlan({ goal: c.goal, days: c.days, length: c.length, level: c.level }, MOCK_HIST);
  return `<div class="case"><h2>${c.goal} · ${c.days}天/周 · ${c.length}分钟 · ${c.level}</h2>
  <div class="sub">🧠 本计划 ${p.customTotal} 个动作按你成绩定制 · 每周肌群结构循环编排（胸/臀腿不连续、燃脂核心穿插、恢复日兜底）</div>
  ${p.weeks.map(weekCard).join('')}
  <div class="note">🧑‍🏫 教练总述：${p.intro}</div></div>`;
}).join('')}
</body></html>`;

const out = path.join(__dirname, '..', 'preview', 'plan_preview.html');
fs.writeFileSync(out, html, 'utf8');
console.log('written', out, html.length + 'B');
