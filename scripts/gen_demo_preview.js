// 生成「动作演示」的本地浏览器预览：双击 preview/demo_preview.html 即可看效果，
// 无需微信开发者工具。复刻小程序里的 CSS 火柴人 + 三阶段循环 + 有真图则并排显示 WGER 真图。
// 重跑：node scripts/gen_demo_preview.js
const fs = require('fs');
const path = require('path');
const { courses } = require('../utils/data.js');

const actions = [];
courses.forEach(c => c.actions.forEach(a => {
  actions.push({
    name: a.name,
    anim: a.anim || 'dynamic',
    // 预览：ExerciseDB GIF 优先（真人连贯动作）；无则 WGER 原图（浏览器能直拉）；小程序内用本地图/远程 GIF
    media: a.gif || (a.media ? a.media.url : '')
  });
}));

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>动作演示 · 本地预览（仿 Keep 健身小程序）</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #f2f4f6; color: #1a1a1a; padding: 24px;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #8a9099; font-size: 13px; margin-bottom: 18px; }
  .bar { display: flex; gap: 12px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
  select { font-size: 15px; padding: 10px 14px; border-radius: 12px; border: 1px solid #d8dde2; background: #fff; }
  .badge { font-size: 12px; padding: 4px 10px; border-radius: 999px; background: #e8f7f2; color: #14B085; }
  .badge.none { background: #fff1f0; color: #ff5c77; }
  /* 复刻小程序 demo sheet */
  .sheet {
    max-width: 420px; margin: 0 auto; background: linear-gradient(160deg, #1FD6A8 0%, #14B085 100%);
    border-radius: 32px; padding: 44px 40px 56px; color: #fff; box-shadow: 0 20px 50px rgba(20,176,133,.25);
  }
  .demo-title { text-align: center; font-size: 20px; font-weight: 800; }
  .demo-stage { display: flex; justify-content: center; align-items: center; padding: 22px 0 8px; min-height: 400px; }
  .demo-fig { position: relative; width: 200px; height: 320px; filter: drop-shadow(0 10px 18px rgba(0,0,0,.18)); }
  .fig-head { position: absolute; top: 8px; left: 77px; width: 46px; height: 46px; border-radius: 50%; background: #fff; }
  .fig-torso { position: absolute; top: 52px; left: 92px; width: 16px; height: 118px; border-radius: 8px; background: #fff; }
  .fig-arm { position: absolute; top: 60px; left: 92px; width: 12px; height: 92px; border-radius: 6px; background: #fff; transform-origin: top center; }
  .fig-arm-l { transform: rotate(28deg); }
  .fig-arm-r { transform: rotate(-28deg); }
  .fig-leg { position: absolute; top: 168px; left: 92px; width: 14px; height: 124px; border-radius: 7px; background: #fff; transform-origin: top center; }
  .fig-leg-l { transform: rotate(16deg); }
  .fig-leg-r { transform: rotate(-16deg); }
  .demo-img { width: 320px; height: 240px; border-radius: 18px; background: rgba(255,255,255,.14); object-fit: contain; display: block; box-shadow: 0 14px 30px rgba(0,0,0,.18); }
  .anim-dynamic { animation: demo-bob 1s ease-in-out infinite; }
  .anim-hold { animation: demo-breathe 3s ease-in-out infinite; }
  .anim-cardio { animation: demo-run .6s linear infinite; }
  @keyframes demo-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(22px); } }
  @keyframes demo-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
  @keyframes demo-run { 0% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-12px) rotate(4deg); } 100% { transform: translateY(0) rotate(-4deg); } }
  .demo-phases { display: flex; justify-content: center; gap: 12px; margin: 8px 0 18px; }
  .dp { font-size: 14px; opacity: .5; padding: 8px 18px; border-radius: 999px; background: rgba(255,255,255,.16); }
  .dp.on { opacity: 1; background: #fff; color: #14B085; font-weight: 700; }
  .demo-tip { text-align: center; font-size: 14px; opacity: .92; margin: 6px 0 0; line-height: 1.5; }
  .demo-src { text-align: center; font-size: 12px; opacity: .75; margin: 10px 0 4px; }
  .legend { max-width: 420px; margin: 22px auto 0; font-size: 12px; color: #8a9099; line-height: 1.7; }
  code { background: #eef0f2; padding: 1px 6px; border-radius: 6px; }
</style>
</head>
<body>
  <h1>动作演示 · 本地预览</h1>
  <div class="sub">这是小程序里「▶ 看演示」的 1:1 复刻：有 ExerciseDB 真人 GIF 就循环播放（Keep 式），没有才用 CSS 火柴人演示。</div>
  <div class="bar">
    <select id="picker"></select>
    <span id="badge" class="badge"></span>
  </div>
  <div class="sheet">
    <div class="demo-title" id="title">动作演示</div>
    <div class="demo-stage" id="stage"></div>
    <div class="demo-phases" id="phases">
      <text class="dp" id="p0">起始</text>
      <text class="dp" id="p1">发力</text>
      <text class="dp" id="p2">还原</text>
    </div>
    <div class="demo-src" id="srctip"></div>
    <div class="demo-tip" id="tip"></div>
  </div>
  <div class="legend">
    操作：选动作 → 有真人 GIF 的动作直接循环播放连贯动作；没有的动作（多为瑜伽/静力）显示火柴人动画。<br>
    GIF 加载不出来（离线/网络不通）会自动回退火柴人，不影响查看。<br>
    在小程序里复现：训练页→动作库→点动作→「看演示」；或跟练页→点动作大图/「看动作演示」。
  </div>

<script>
  const ACTIONS = ${JSON.stringify(actions, null, 0)};
  const TIP = {
    dynamic: '发力阶段肌肉收缩，还原时控制速度，感受目标肌群酸胀',
    hold: '保持身体稳定与呼吸匀速，核心收紧，不要憋气',
    cardio: '节奏连贯、心率拉满，落地轻、呼吸深，坚持就是燃脂'
  };
  const picker = document.getElementById('picker');
  const badge = document.getElementById('badge');
  const stage = document.getElementById('stage');
  const title = document.getElementById('title');
  const tip = document.getElementById('tip');
  const srctip = document.getElementById('srctip');
  const phases = document.getElementById('phases');
  const pEls = [document.getElementById('p0'), document.getElementById('p1'), document.getElementById('p2')];
  let timer = null;

  ACTIONS.forEach((a, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = a.name + (a.media ? ' ▶动图' : '');
    picker.appendChild(o);
  });

  function render(i) {
    const a = ACTIONS[i];
    title.textContent = a.name + ' · 动作演示';
    tip.textContent = TIP[a.anim] || '';
    badge.textContent = a.media ? '真人 GIF 演示' : 'CSS 火柴人演示';
    badge.className = 'badge' + (a.media ? '' : ' none');
    srctip.textContent = a.media ? '真人动作演示 · 来源 ExerciseDB' : '';

    if (a.media) {
      // 有真人 GIF：主舞台直接播放
      stage.innerHTML = '<img class="demo-img" src="' + a.media + '" onerror="window.__imgFail(this)">';
      phases.style.display = 'none';
    } else {
      // 无 GIF：火柴人主舞台 + 三阶段循环
      phases.style.display = '';
      stage.innerHTML = '<div class="demo-fig anim-' + a.anim + '">'
        + '<div class="fig-head"></div><div class="fig-torso"></div>'
        + '<div class="fig-arm fig-arm-l"></div><div class="fig-arm fig-arm-r"></div>'
        + '<div class="fig-leg fig-leg-l"></div><div class="fig-leg fig-leg-r"></div></div>';
    }

    // 三阶段循环（复刻小程序 startDemoTimer）
    if (timer) clearInterval(timer);
    let phase = a.anim === 'hold' ? 1 : 0;
    pEls.forEach((p, k) => p.classList.toggle('on', k === phase));
    if (a.anim !== 'hold') {
      timer = setInterval(() => {
        phase = (phase + 1) % 3;
        pEls.forEach((p, k) => p.classList.toggle('on', k === phase));
      }, 600);
    }
  }

  picker.addEventListener('change', e => render(Number(e.target.value)));
  window.__imgFail = function (el) { el.parentNode.innerHTML = ''; };
  render(0);
</script>
</body>
</html>`;

const outDir = path.join(__dirname, '..', 'preview');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'demo_preview.html');
fs.writeFileSync(outFile, html, 'utf8');
console.log('已生成', outFile, '| 动作数', actions.length, '| 带真图', actions.filter(a => a.media).length);
