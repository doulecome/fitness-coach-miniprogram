/* 健身教练 · 网页版交互逻辑（由 build_site.js 注入 window.__NS 后运行） */
(function () {
  'use strict';
  var NS = window.__NS;
  var courses = NS.courses, generatePlan = NS.generatePlan;
  var KB = 'fit_best', KR = 'fit_records', KP = 'fit_plan', KRS = 'fit_rest';

  /* ============ 工具 ============ */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(s, p) { return (p || document).querySelector(s); }
  function todayStr() { var d = new Date(), m = '0' + (d.getMonth() + 1), dd = '0' + d.getDate(); return d.getFullYear() + '-' + m.slice(-2) + '-' + dd.slice(-2); }
  function fmtMin(sec) { return Math.max(1, Math.round(sec / 60)); }
  var WCN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function loadK(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function saveK(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ===== 图片兜底：GIF CDN 加载失败 → 依次切换备用节点，全失败才降级为 emoji =====
     error 不冒泡，须 capture 捕获；容错链按可达性排序：cdn/gcore 直连 200、fastly 301 跟随 */
  var GIF_HOSTS = ['cdn.jsdelivr.net', 'gcore.jsdelivr.net', 'fastly.jsdelivr.net'];
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    var src = t.getAttribute('src') || '';
    var cur = null;
    for (var i = 0; i < GIF_HOSTS.length; i++) { if (src.indexOf(GIF_HOSTS[i]) >= 0) { cur = GIF_HOSTS[i]; break; } }
    if (cur) {
      var ni = GIF_HOSTS.indexOf(cur) + 1;
      if (ni < GIF_HOSTS.length) { t.setAttribute('data-tried', String(ni)); t.src = src.replace(cur, GIF_HOSTS[ni]); return; }
    }
    if (t.parentNode) {
      var s = document.createElement('span');
      s.className = 'img-fb';
      s.textContent = t.getAttribute('data-fb') || '🏋️';
      t.parentNode.replaceChild(s, t);
    }
  }, true);

  /* ===== 屏幕常亮（Wake Lock）：跟练期间手机不锁屏；不支持的环境静默忽略 ===== */
  var wlSent = null;
  function keepAwake(on) {
    if (!on) {
      if (wlSent && wlSent.release) { try { wlSent.release(); } catch (e) {} wlSent = null; }
      return;
    }
    if (!navigator.wakeLock || wlSent) return;
    navigator.wakeLock.request('screen').then(function (s) {
      wlSent = s;
      s.addEventListener('release', function () { if (wlSent === s) wlSent = null; });
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return; // 切后台时浏览器会自动释放，回到前台再补请求
    var wko = $('#wko');
    if (wko && !wko.classList.contains('hide')) keepAwake(true);
  });

  /* ============ 状态 ============ */
  var S = {
    tab: 'home', seg: 'course', actMus: '全部',
    best: loadK(KB, {}), records: loadK(KR, []), plan: loadK(KP, null), weekIdx: 0,
    form: { goal: '减脂', day: 4, length: 30, level: '进阶' }, restSec: loadK(KRS, 10), diff: loadK('fit_diff', 'std'),
    diet: loadK('fit_diet', null), dietDraft: { gender: '男', age: 28, height: 175, weight: 70, activity: '中度', goal: '减脂' },
    builder: { sel: {}, rounds: 3 }
  };
  var app = $('#app');

  /* ============ 存储 ============ */
  function commitBest(name, actual) {
    if (!name || !actual) return false;
    var rec = S.best[name] || { best: 0, last: 0, hist: [], lastDate: '' };
    var isPR = actual > (rec.best || 0);
    rec.hist = (rec.hist || []).concat([actual]).slice(-30);
    if (isPR) rec.best = actual;
    rec.last = actual; rec.lastDate = todayStr();
    S.best[name] = rec; saveK(KB, S.best);
    return isPR;
  }
  function saveRecord(o) { S.records.unshift(o); S.records = S.records.slice(0, 200); saveK(KR, S.records); }

  /* ============ 外壳 ============ */
  var TABS = [{ k: 'home', i: '🏠', l: '首页' }, { k: 'train', i: '🏋️', l: '训练' }, { k: 'plan', i: '🗓️', l: '计划' }, { k: 'diet', i: '🍱', l: '饮食' }, { k: 'record', i: '📈', l: '记录' }];
  function tabTitle() {
    if (S.tab === 'home') return '健身教练';
    if (S.tab === 'train') return '训练';
    if (S.tab === 'plan') return S.plan ? '我的 4 周计划' : 'AI 定制计划';
    if (S.tab === 'diet') return '饮食规划';
    return '我的记录';
  }
  function renderShell() {
    app.innerHTML =
      '<div id="topbar">' + esc(tabTitle()) + '<span class="tb-sub">网页预览 · 同款引擎</span></div>' +
      '<div id="view"></div>' +
      '<div id="tabbar">' + TABS.map(function (t) {
        return '<div class="tab ' + (S.tab === t.k ? 'on' : '') + '" data-a="tab" data-v="' + t.k + '"><div class="t-ic">' + t.i + '</div><div>' + t.l + '</div></div>';
      }).join('') + '</div>' +
      '<div id="sheetMask" style="display:none"><div class="sheet" id="sheetBody"></div></div>' +
      '<div id="wko" class="hide"></div>';
    renderView();
  }
  function renderView() {
    var tb = $('#topbar'); if (tb) tb.firstChild.textContent = tabTitle();
    var v = $('#view');
    if (S.tab === 'home') v.innerHTML = vHome();
    else if (S.tab === 'train') v.innerHTML = vTrain();
    else if (S.tab === 'plan') v.innerHTML = S.plan ? vPlanResult() : vPlanForm();
    else if (S.tab === 'diet') v.innerHTML = vDiet();
    else v.innerHTML = vRecord();
    v.scrollTop = 0;
  }

  /* ============ 首页 ============ */
  function vHome() {
    var d = new Date(), today = todayStr();
    var minToday = S.records.filter(function (r) { return r.date === today; }).reduce(function (a, r) { return a + (r.min || 0); }, 0);
    var mdays = S.records.filter(function (r) { return r.date.indexOf(today.slice(0, 7)) === 0; }).length;
    var recCount = Object.keys(S.best).length;
    var jd = d.getDay(), slot = jd === 0 ? 6 : jd - 1;
    var day = S.plan ? S.plan.weeks[0].week[slot] : null;
    var heroTxt, heroSub, heroBtn;
    if (day && day.rest) { heroTxt = '今天是休息日'; heroSub = '主动恢复也是训练的一部分——拉伸、散步，让身体回血'; heroBtn = '看本周计划'; }
    else if (day) {
      heroTxt = '今日 · ' + day.typeName;
      heroSub = day.muscle + ' · 约 ' + day.duration + ' 分钟 · ' + (day.nActs || day.acts.length) + ' 个动作' + (day.custom ? ' · 🧠 ' + day.custom + ' 按你成绩定制' : '');
      heroBtn = '开始今日训练';
    } else { heroTxt = '开始你的第一练'; heroSub = '先生成一份 4 周 AI 计划，或直接挑一门课开练'; heroBtn = '去定制计划'; }
    var hb = day && !day.rest ? 'runDay' : 'tabplan';
    // hero 背景：训练日取首个跟练动作的真人 GIF 当封面（Keep 式沉浸大卡），否则纯渐变+表情水印
    var heroBg = (day && !day.rest && day.seq && day.seq[0] && day.seq[0].gif) ? day.seq[0].gif : '';
    var heroEmoji = (day && !day.rest && !heroBg) ? (day.icon || '💪') : (!day ? '💪' : '💤');
    var heroHtml =
      '<div class="hero">' +
      (heroBg ? '<img class="hero-bg" loading="lazy" data-fb="' + heroEmoji + '" src="' + heroBg + '"><div class="hero-veil"></div>' : '') +
      '<div class="hero-in">' +
      '<div class="h-top"><span class="h-day">' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · ' + WCN[jd] + '</span>' +
      (S.plan && day && !day.rest ? '<span class="h-week">' + esc(day.typeName) + '</span>' : '') + '</div>' +
      '<div class="h-t">' + esc(heroTxt) + '</div><div class="h-desc">' + esc(heroSub) + '</div>' +
      '<div class="h-cta" data-a="' + hb + '" data-w="0" data-i="' + slot + '">' + heroBtn + ' <span style="font-size:11px">▸</span></div>' +
      '</div>' +
      (!heroBg ? '<span class="h-em">' + heroEmoji + '</span>' : '') +
      '</div>';
    var lastR = S.records[0];
    var lastCard = '';
    if (lastR) {
      var lb = lastR.tag && lastR.tag.indexOf('fit_course_') === 0 ? 'replay' : (lastR.tag && lastR.tag.indexOf('fit_plan_') === 0 ? 'replay' : '');
      lastCard = '<div class="card last-rec"><div class="lr-ic" style="background:' + esc(lastR.bg || '#eef4f1') + '">' + (lastR.icon || '🏋️') + '</div>' +
        '<div><div class="lr-n">' + esc(lastR.name) + '</div><div class="lr-s">' + lastR.date + ' · ' + lastR.min + ' 分钟' + (lastR.done != null ? ' · 完成 ' + lastR.done + '/' + lastR.total : '') + '</div></div>' +
        (lb ? '<div class="btn" data-a="' + lb + '">再练一次</div>' : '') + '</div>';
    }
    // 精选课程：真人 GIF 封面大卡（用每门课第一个动作的演示图），Keep 式推荐流
    var strip = '<div class="course-strip">' + courses.slice(0, 6).map(function (c) {
      var cover = (c.actions[0] && c.actions[0].gif) ? c.actions[0].gif : '';
      var cbg = 'background:linear-gradient(135deg,' + (c.color || '#1FD6A8') + ',#0d8f6f)';
      return '<div class="cs-card" style="' + cbg + '" data-a="openCourse" data-id="' + c.id + '">' +
        (cover ? '<img loading="lazy" data-fb="' + c.icon + '" src="' + cover + '"><div class="cs-veil"></div>' : '<div class="img-fb">' + c.icon + '</div>') +
        '<div class="cs-tag">' + esc(c.level) + ' · ' + esc(c.cat) + '</div>' +
        '<div class="cs-txt"><div class="c-n">' + esc(c.name) + '</div>' +
        '<div class="c-m">' + c.duration + '′ · ' + c.actions.length + ' 动作</div></div>' +
        '</div>';
    }).join('') + '</div>';
    return heroHtml +
      '<div class="stats-row"><div class="stat"><div class="n">' + minToday + '</div><div class="l">今日分钟</div></div>' +
      '<div class="stat"><div class="n">' + mdays + '</div><div class="l">本月练次</div></div>' +
      '<div class="stat"><div class="n">' + recCount + '</div><div class="l">动作有纪录</div></div>' +
      '<div class="stat"><div class="n">' + (streak() || 0) + '</div><div class="l">连续打卡</div></div></div>' +
      '<div class="h-sec">为你精选<span class="more">点卡片看动作清单</span></div>' + strip + lastCard;
  }

  /* ============ 训练库 ============ */
  function musclesOf(a) {
    var lib = NS.ACT_LIB[a.name];
    if (lib) return lib.g === 'push' ? '胸·肩' : lib.g === 'legs' ? '臀·腿' : lib.g === 'core' ? '核心' : lib.g === 'stretch' ? '拉伸' : '全身';
    var t = '';
    courses.forEach(function (c) { c.actions.forEach(function (x) { if (x.name === a.name && c.muscle) t = c.muscle; }); });
    return t || '全身';
  }
  function vTrain() {
    var seg = '<div class="seg"><div class="sg ' + (S.seg === 'course' ? 'on' : '') + '" data-a="seg" data-v="course">课程</div><div class="sg ' + (S.seg === 'acts' ? 'on' : '') + '" data-a="seg" data-v="acts">动作库</div><div class="sg ' + (S.seg === 'custom' ? 'on' : '') + '" data-a="seg" data-v="custom">自定义</div></div>';
    if (S.seg === 'course') {
      return seg + '<div class="course-grid">' + courses.map(function (c) {
        return '<div class="course-card" data-a="openCourse" data-id="' + c.id + '"><div class="cc-ic" style="background:' + esc(c.color || '#1FD6A8') + '22">' + c.icon + '</div>' +
          '<div class="cc-n">' + esc(c.name) + '</div><div class="cc-m">' + c.level + ' · ' + c.duration + ' 分钟 · ' + c.actions.length + ' 动作</div>' +
          '<div class="cc-btn btn">开始 ▸</div></div>';
      }).join('') + '</div>';
    }
    if (S.seg === 'custom') return seg + vBuilder();
    var seen = {}, list = [];
    courses.forEach(function (c) { c.actions.forEach(function (a) { if (!seen[a.name]) { seen[a.name] = 1; list.push(a); } }); });
    var mus = ['全部', '胸·肩', '臀·腿', '核心', '拉伸', '全身'];
    var chips = mus.map(function (m) { return '<span class="chip ' + (S.actMus === m ? 'on' : '') + '" data-a="mus" data-v="' + m + '">' + m + '</span>'; }).join('');
    var rows = list.filter(function (a) { return S.actMus === '全部' || (musclesOf(a) || '').indexOf(S.actMus) >= 0; }).map(function (a) {
      return '<div class="act-row" data-a="actInfo" data-name="' + esc(a.name) + '"><div class="a-ic">' + a.icon + '</div>' +
        '<div><div class="a-n">' + esc(a.name) + '</div><div class="a-s">' + (a.type === 'reps' ? a.value + ' 次' : a.value + ' 秒') + ' · ' + esc(musclesOf(a)) + '</div></div>' +
        (a.gif ? '<div class="a-g"><img loading="lazy" data-fb="' + a.icon + '" src="' + a.gif + '"></div>' : '') + '<div class="a-go">›</div></div>';
    }).join('');
    return seg + '<div class="chips">' + chips + '</div><div style="height:10px"></div>' + (rows || '<div class="empty"><div class="e-ic">🤸</div>该肌群暂无动作</div>');
  }

  /* ============ 自定义训练 builder ============ */
  var BLD_GROUPS = [['胸·肩', 'push'], ['臀·腿', 'legs'], ['核心', 'core'], ['燃脂', 'cardio'], ['拉伸', 'stretch']];
  function vBuilder() {
    var seen = {}, all = [];
    courses.forEach(function (c) { c.actions.forEach(function (a) { if (!seen[a.name]) { seen[a.name] = 1; all.push(a); } }); });
    var html = '<div class="bld-hint">勾选动作，自由组合成你的专属训练</div>';
    BLD_GROUPS.forEach(function (g) {
      var items = all.filter(function (a) { var lib = NS.ACT_LIB[a.name]; return lib && lib.g === g[1]; });
      if (!items.length) return;
      html += '<div class="bld-g">' + g[0] + '</div>' + items.map(function (a) {
        var on = S.builder.sel[a.name] ? ' on' : '';
        return '<div class="bld-it' + on + '" data-a="bldToggle" data-name="' + esc(a.name) + '"><div class="b-ic">' + a.icon + '</div>' +
          '<div class="b-n">' + esc(a.name) + '</div><div class="b-go">' + (on ? '✓' : '＋') + '</div></div>';
      }).join('');
    });
    var n = Object.keys(S.builder.sel).length;
    html += '<div class="bld-foot"><div class="bld-ct">已选 <b>' + n + '</b> 项</div>' +
      '<div class="bld-rd">组数 <span class="r-btn" data-a="bldRound" data-v="-1">−</span> <b>' + S.builder.rounds + '</b> <span class="r-btn" data-a="bldRound" data-v="1">＋</span></div>' +
      '<div class="bld-go btn" data-a="bldStart"' + (n ? '' : ' style="opacity:.45;pointer-events:none"') + '>开始训练 ▸</div></div>';
    return html;
  }
  function bldStart() {
    var names = Object.keys(S.builder.sel);
    if (!names.length) return;
    var raw = names.map(function (nm) {
      var a = NS.actionByName[nm]; if (!a) return null;
      var arr = [];
      for (var r = 0; r < S.builder.rounds; r++) arr.push({ name: a.name, icon: a.icon, type: a.type, value: a.value, phase: 'main', cue: a.cue || '', anim: a.anim || 'dynamic', gif: a.gif || '', media: a.media || null });
      return arr;
    }).filter(Boolean);
    var seq = []; raw.forEach(function (arr) { arr.forEach(function (x) { seq.push(x); }); });
    if (!seq.length) return;
    var cfg = diffCfg(S.diff);
    seq = seq.map(function (s) { return scaleAction(s, cfg); });
    startW(seq, '自定义训练 · ' + names.length + ' 动作', '🎯', 0, '#7C5CFF', 'fit_custom_' + Date.now(), Math.max(3, S.restSec + cfg.restAdd), buildWarmSeq());
  }

  /* ============ 计划 ============ */
  var GOALS = ['减脂', '增肌', '塑形', '保持健康', '拉伸放松'], DAYS = [3, 4, 5, 6], LENS = [15, 30, 45], LEVELS = ['新手', '进阶', '老手'];
  function chipRow(arr, key, fmt) {
    return '<div class="chips">' + arr.map(function (v) {
      return '<span class="chip ' + (S.form[key] === v ? 'on' : '') + '" data-a="form" data-k="' + key + '" data-v="' + v + '">' + fmt(v) + '</span>';
    }).join('') + '</div>';
  }
  function vPlanForm() {
    return '<div class="form-t">🎯 目标</div>' + chipRow(GOALS, 'goal', function (v) { return v; }) +
      '<div class="form-t">📅 每周训练天数</div>' + chipRow(DAYS, 'day', function (v) { return v + ' 天'; }) +
      '<div class="form-t">⏱ 单次时长</div>' + chipRow(LENS, 'length', function (v) { return v + ' 分钟'; }) +
      '<div class="form-t">🏆 训练水平</div>' + chipRow(LEVELS, 'level', function (v) { return v; }) +
      '<div class="gen-btn btn" data-a="genPlan">✨ 生成我的 4 周计划</div>' +
      '<div style="text-align:center;font-size:11px;color:#a0a6ad;margin:14px 6px;line-height:1.7">引擎与微信小程序完全一致：按目标 / 水平 / 时长从动作库动态编排每个训练日（主项×组数 + 热身 + 收尾 + 冷身），读取你的成绩历史逐动作定制目标</div>';
  }
  function histForPlan() {
    var h = {};
    Object.keys(S.best).forEach(function (n) { h[n] = { best: S.best[n].best, count: (S.best[n].hist || []).length }; });
    return h;
  }
  function vPlanResult() {
    var p = S.plan, w = p.weeks[S.weekIdx];
    var tabs = p.weeks.map(function (x, i) {
      return '<div class="pt ' + (S.weekIdx === i ? 'on' : '') + '" data-a="week" data-i="' + i + '"><div class="pt-i">第' + (i + 1) + '周</div><div class="pt-l">' + x.label + '</div></div>';
    }).join('');
    var days = w.week.map(function (d, i) {
      if (d.rest) return '<div class="day-card rest"><span class="rest-em">💤</span><div class="dc-rest">' + d.wd + ' · 休息日，让身体恢复</div></div>';
      var acts = d.acts.slice(0, 5).map(function (a) {
        return '<div class="dc-act">' + (a.fin ? '🧯 收尾 · ' : a.cool ? '🧘 冷身 · ' : '') + esc(a.name) + (a.round > 1 ? ' <b>×' + a.round + '</b>' : '') + ' · ' + a.target + a.unit + '</div>';
      }).join('');
      return '<div class="day-card" data-a="openDay" data-w="' + S.weekIdx + '" data-i="' + i + '">' +
        '<div class="dc-h"><span class="dc-wd">' + d.wd + '</span><span class="dc-t">' + d.icon + ' ' + esc(d.typeName) + '</span></div>' +
        '<div class="dc-m">' + esc(d.muscle) + ' · 约 ' + d.duration + ' 分钟' + (d.custom ? ' · 🧠 ' + d.custom : '') + '</div>' + acts +
        '<div class="dc-foot"><span class="dc-tag">' + (d.nActs || d.acts.length) + ' 个动作</span>' +
        '<span class="dc-run btn" data-a="runDay" data-w="' + S.weekIdx + '" data-i="' + i + '">开练 ▸</span></div></div>';
    }).join('');
    return '<div class="phase-tabs">' + tabs + '</div>' +
      '<div class="phase-tip">📌 ' + esc(p.weeks[S.weekIdx].tip) + '</div>' +
      (p.customTotal ? '<div class="phase-tip" style="background:#e8f7f2">🧠 本计划 ' + p.customTotal + ' 个动作目标已按你的成绩历史自动定制</div>' : '') +
      '<div class="sum-chips"><div class="sc"><div class="n">' + w.days + '</div><div class="l">训练天</div></div>' +
      '<div class="sc"><div class="n">' + w.totalMin + '</div><div class="l">分钟/周</div></div>' +
      '<div class="sc"><div class="n">' + w.totalKcal + '</div><div class="l">千卡/周</div></div></div>' +
      '<div class="card" style="font-size:12px;color:#4a525c;line-height:1.7">💬 ' + esc(p.levelNote) + '<br>🔁 ' + esc(p.weeksNote) + '</div>' + days +
      '<div class="gen-btn btn ghost" data-a="replan">↻ 重新定制</div>';
  }

  /* ============ 记录 ============ */
  function vRecord() {
    var totalMin = S.records.reduce(function (a, r) { return a + (r.min || 0); }, 0);
    var names = Object.keys(S.best).filter(function (n) { return S.best[n].best > 0; });
    var bestCards = names.slice().sort(function (a, b) { return S.best[b].best - S.best[a].best; }).slice(0, 6).map(function (nm) {
      var rec = S.best[nm], hist = (rec.hist || []).slice(-10);
      var mx = Math.max.apply(null, hist.concat([rec.best, 1]));
      var bars = hist.map(function (v) {
        return '<div class="pb-col ' + (v >= rec.best ? 'best' : '') + '" style="height:' + Math.max(8, Math.round(v / mx * 100)) + '%"></div>';
      }).join('');
      return '<div class="card"><div style="display:flex;align-items:baseline"><b style="font-size:14px">' + esc(nm) + '</b>' +
        '<span style="margin-left:auto;font-size:13px;color:#0fb98c;font-weight:800">' + rec.best + ' 次</span></div>' +
        '<div class="pb-row">' + (bars || '<div style="font-size:11px;color:#a0a6ad">练一次开始记录</div>') + '</div>' +
        '<div style="font-size:10px;color:#a0a6ad;margin-top:6px">最佳 ' + rec.best + ' 次 · 最近 ' + (rec.lastDate || '-') + '</div></div>';
    }).join('');
    var list = S.records.map(function (r, i) {
      return '<div style="background:#fff;border-radius:12px;margin-bottom:8px;overflow:hidden"><div class="rec-list rl" data-a="recDetail" data-i="' + i + '">' +
        '<div class="lr-ic" style="width:40px;height:40px;border-radius:12px;background:' + esc(r.bg || '#eef4f1') + ';display:flex;align-items:center;justify-content:center;font-size:20px">' + (r.icon || '🏋️') + '</div>' +
        '<div><div class="rn">' + esc(r.name) + '</div><div class="rd">' + r.date + (r.done != null ? ' · 完成 ' + r.done + '/' + r.total : '') + '</div></div>' +
        '<div class="rm"><div class="n">' + r.min + '′</div><div class="l">' + (r.kcal || '-') + ' 千卡</div></div></div></div>';
    }).join('');
    return trendHtml() +
      '<div class="stats-row"><div class="stat"><div class="n">' + S.records.length + '</div><div class="l">累计训练</div></div>' +
      '<div class="stat"><div class="n">' + totalMin + '</div><div class="l">总分钟</div></div>' +
      '<div class="stat"><div class="n">' + names.length + '</div><div class="l">动作有纪录</div></div></div>' +
      (bestCards ? '<div class="h-sec">💪 动作最佳纪录</div>' + bestCards : '') +
      '<div class="h-sec">训练历史</div>' +
      (list || '<div class="empty"><div class="e-ic">🏋️</div>还没有训练记录<br>去首页开练一次吧</div>');
  }

  /* ============ Bottom sheet ============ */
  function openSheet(html) {
    var m = $('#sheetMask'); m.style.display = 'flex'; m.classList.add('in');
    var b = $('#sheetBody'); b.innerHTML = html;
    // 重新触发滑入动画（.sheet 元素持久，需 reflow 才能再播）
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  }
  function closeSheet() {
    var m = $('#sheetMask'); if (!m) return;
    m.classList.add('closing');
    setTimeout(function () {
      m.style.display = 'none'; m.classList.remove('in', 'closing');
      var b = $('#sheetBody'); if (b) b.style.animation = '';
    }, 250);
  }
  function sheetCourse(c) {
    S._course = c;
    var cfg = diffCfg(S.diff);
    var rows = c.actions.map(function (a) {
      var sv = a.type === 'reps' ? Math.max(5, Math.round(a.value * cfg.mul)) : Math.max(10, Math.round(a.value * cfg.mul));
      return '<div class="row-line"><span class="t main">' + (a.type === 'reps' ? '计数' : '计时') + '</span>' + a.icon + ' ' + esc(a.name) +
        '<span class="r">' + sv + (a.type === 'reps' ? ' 次' : ' 秒') + '</span></div>';
    }).join('');
    openSheet('<div class="sh-h"><div class="sh-t">' + c.icon + ' ' + esc(c.name) + '</div><div class="x" data-a="xSheet">✕</div></div>' +
      '<div class="sh-sub">' + c.level + ' · ' + c.duration + ' 分钟 · 约 ' + Math.round(c.kcal * cfg.kcal) + ' 千卡 · ' + c.actions.length + ' 个动作</div>' +
      '<div class="card" style="background:#f5f7f8;font-size:12px;line-height:1.6;color:#4a525c;padding:10px 12px">' + esc(c.desc) + '</div>' + rows +
      diffSeg() +
      '<div class="sh-go btn" data-a="runCourse" data-id="' + c.id + '">开始训练 ▸</div>');
  }
  function sheetAct(name) {
    var act = null;
    courses.forEach(function (c) { c.actions.forEach(function (a) { if (a.name === name && !act) act = a; }); });
    var lib = NS.ACT_LIB[name];
    var sub = act ? (act.type === 'reps' ? (lib && lib.d ? '难度 ' + '★'.repeat(lib.d) + '☆☆'.slice(0, 3 - lib.d) + ' · ' : '') + '单轮 ' + act.value + ' 次' : act.value + ' 秒 · 保持稳定节奏') : '';
    openSheet('<div class="sh-h"><div class="sh-t">' + (act ? act.icon : '🏋️') + ' ' + esc(name) + '</div><div class="x" data-a="xSheet">✕</div></div>' +
      '<div class="sh-sub">' + sub + ' · ' + esc(musclesOf({ name: name })) + '</div>' +
      (act && act.gif ? '<div class="demo"><img data-fb="' + act.icon + '" src="' + act.gif + '" alt=""></div>' : '') +
      '<div class="cue-box">💡 ' + esc((act && act.cue) || '保持核心收紧，动作标准优先于数量') + '</div>');
  }
  function sheetDay(wIdx, i) {
    var d = S.plan.weeks[wIdx].week[i];
    if (!d || d.rest) return;
    S._day = { w: wIdx, i: i };
    var cfg = diffCfg(S.diff);
    var rows = d.acts.map(function (a) {
      var tag = a.fin ? 'fin' : a.cool ? 'cool' : 'main';
      var tl = a.fin ? '收尾' : a.cool ? '冷身' : '主项';
      var sv = Math.max(a.unit === '次' ? 5 : 10, Math.round(a.target * cfg.mul));
      return '<div class="row-line"><span class="t ' + tag + '">' + tl + '</span>' + a.icon + ' ' + esc(a.name) +
        '<span class="r">×' + (a.round || 1) + ' ' + sv + a.unit + '</span></div>';
    }).join('');
    openSheet('<div class="sh-h"><div class="sh-t">' + d.wd + ' · ' + d.icon + ' ' + esc(d.typeName) + '</div><div class="x" data-a="xSheet">✕</div></div>' +
      '<div class="sh-sub">' + esc(d.muscle) + ' · 约 ' + d.duration + ' 分钟' + (d.custom ? ' · 🧠 ' + d.custom + ' 按成绩定制' : '') + '</div>' +
      '<div class="warm-box">🔥 ' + esc(d.warm || '') + '</div>' + rows +
      diffSeg() +
      (d.coach ? '<div class="coach-box">💬 ' + esc(d.coach) + '</div>' : '') +
      '<div class="sh-go btn" data-a="runDay" data-w="' + wIdx + '" data-i="' + i + '">按此训练开始 ▸</div>');
  }
  function sheetRec(i) {
    var r = S.records[i];
    var rows;
    if (!r.detail || !r.detail.length) rows = '<div class="empty" style="padding:16px">早期记录暂无动作明细</div>';
    else rows = r.detail.map(function (x) {
      var st;
      if (!x.actual || x.actual <= 0) st = '<span style="color:#a0a6ad">跳过</span>';
      else if (x.actual >= (x.target || 1)) st = '<span style="color:#0fb98c;font-weight:800">✓ 达标' + (x.actual > x.target ? ' +' + (x.actual - x.target) : '') + '</span>';
      else st = '<span style="color:#e08a00;font-weight:800">未达 ' + x.actual + '/' + x.target + '</span>';
      return '<div class="row-line">' + (x.icon || '•') + ' ' + esc(x.name) + '<span class="last">目标 ' + (x.target || '-') + (x.type === 'reps' ? ' 次' : ' 秒') + '</span><span class="r" style="font-weight:600;color:#4a525c">' + st + '</span></div>';
    }).join('');
    openSheet('<div class="sh-h"><div class="sh-t">' + (r.icon || '🏋️') + ' ' + esc(r.name) + '</div><div class="x" data-a="xSheet">✕</div></div>' +
      '<div class="sh-sub">' + r.date + ' · ' + r.min + ' 分钟' + (r.done != null ? ' · 完成 ' + r.done + '/' + r.total : '') + '</div>' + rows);
  }

  /* ============ 语音教练 / 连续打卡 / 实时 HUD ============ */
  var VOICE_ON = loadK('fit_voice', true);
  function phaseLabel(p) { return p === 'fin' ? '收尾' : p === 'cool' ? '冷身' : p === 'warm' ? '热身' : '正式'; }
  // 队列式播报：说完一条再播下一条，避免连续播报被 cancel 掐断；语速降到 0.9 更清晰
  var SP_Q = [], SP_BUSY = false;
  function spNext() {
    if (SP_BUSY) return;
    if (!SP_Q.length) { SP_BUSY = false; return; }
    var txt = SP_Q.shift();
    try {
      var u = new SpeechSynthesisUtterance(txt);
      u.lang = 'zh-CN'; u.rate = 0.9; u.pitch = 1; u.volume = 1;
      var vs = window.speechSynthesis.getVoices();
      for (var i = 0; i < vs.length; i++) { if (vs[i].lang && vs[i].lang.toLowerCase().indexOf('zh') >= 0) { u.voice = vs[i]; break; } }
      u.onend = spNext; u.onerror = spNext;
      SP_BUSY = true;
      window.speechSynthesis.speak(u);
    } catch (e) { SP_BUSY = false; spNext(); }
  }
  function speak(text) {
    if (!VOICE_ON || !('speechSynthesis' in window) || !text) return;
    SP_Q.push(text);
    if (!SP_BUSY) spNext();
  }
  function spStop() { SP_Q = []; SP_BUSY = false; if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }
  function streak() {
    var days = {}; S.records.forEach(function (r) { days[r.date] = 1; });
    var s = 0, d = new Date();
    for (;;) {
      var m = '0' + (d.getMonth() + 1), dd = '0' + d.getDate();
      var key = d.getFullYear() + '-' + m.slice(-2) + '-' + dd.slice(-2);
      if (days[key]) { s++; d.setDate(d.getDate() - 1); } else break;
    }
    return s;
  }
  function updateHUD() {
    if (!W) return;
    var h = $('#whud'); if (!h) return;
    var sec = Math.floor((Date.now() - W.t0) / 1000);
    var mm = Math.floor(sec / 60), ss = sec % 60;
    var txt = '⏱ ' + (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
    if (W.kcal) txt += ' · ≈' + Math.round(W.kcal * (sec / 60) / 20) + ' 千卡';
    h.textContent = txt;
  }

  /* ===== 组间节拍器：休息倒计时轻 tick，结束强 beep + 震动 ===== */
  var AC = null;
  function ensureAudio() {
    if (AC) { if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} } return; }
    try { var C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } catch (e) {}
  }
  function beep(freq, dur, vol) {
    if (!AC) return;
    try {
      if (AC.state === 'suspended') AC.resume();
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      o.connect(g); g.connect(AC.destination);
      var t = AC.currentTime;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  function tick() { beep(760, 0.07, 0.08); }            // 倒计时每秒轻提示
  function restEnd() {                                  // 休息结束 → 进下一动作
    beep(1320, 0.22, 0.22);
    if (navigator.vibrate) { try { navigator.vibrate([0, 110, 70, 110]); } catch (e) {} }
  }

  /* ============ 难度模式 ============ */
  function diffCfg(d) {
    if (d === 'easy') return { mul: 0.7, restAdd: 5, kcal: 0.8, label: '轻松' };
    if (d === 'hard') return { mul: 1.4, restAdd: -2, kcal: 1.25, label: '挑战' };
    return { mul: 1, restAdd: 0, kcal: 1, label: '标准' };
  }
  function scaleAction(a, cfg) {
    var b = {}; for (var k in a) b[k] = a[k];
    var v = a.value;
    b.value = a.type === 'reps' ? Math.max(5, Math.round(v * cfg.mul)) : Math.max(10, Math.round(v * cfg.mul));
    return b;
  }
  function diffSeg() {
    var on = function (k) { return S.diff === k ? ' on' : ''; };
    return '<div class="diff-seg"><span class="dl">训练难度</span>' +
      '<div class="o' + on('easy') + '" data-a="setDiff" data-v="easy">轻松</div>' +
      '<div class="o' + on('std') + '" data-a="setDiff" data-v="std">标准</div>' +
      '<div class="o' + on('hard') + '" data-a="setDiff" data-v="hard">挑战</div></div>' +
      '<div class="dhint">难度实时套用：' + (S.diff === 'easy' ? '少做几组·休息更长' : S.diff === 'hard' ? '加量·休息更短' : '按原计划强度') + '</div>';
  }

  /* ============ 热身序列（开练前的独立引导屏） ============ */
  // 取动作库里带真人 GIF 的动感/激活类动作，保证一致观感
  var WARM = [['开合跳', 30], ['高抬腿', 30], ['深蹲', 15], ['站姿提踵', 20], ['肩胸拉伸', 30]];
  function buildWarmSeq() {
    return WARM.map(function (p) {
      var src = NS.actionByName[p[0]]; if (!src) return null;
      return { name: src.name, icon: src.icon || '🏋️', type: src.type, value: p[1], phase: 'warm',
        cue: src.cue || '', anim: src.anim || 'dynamic', gif: src.gif || '', media: src.media || null };
    }).filter(Boolean);
  }

  /* ============ 跟练引擎 ============ */
  var W = null, WT = null;
  function startW(seq, title, icon, kcal, bg, tag, restSec, warmSeq) {
    var warm = (warmSeq && warmSeq.length) ? warmSeq : [];
    var full = warm.concat(seq);
    W = { seq: full, firstMain: warm.length, warmAck: warm.length === 0, title: title, icon: icon, kcal: kcal || 0, bg: bg || '#1FD6A8', i: 0, phase: 'ready', rem: 3,
      actual: 0, detail: [], t0: Date.now(), rest: (restSec != null ? restSec : S.restSec), paused: false, prs: 0, tag: tag };
    $('#wko').classList.remove('hide');
    keepAwake(true); // 跟练期间屏幕常亮
    ensureAudio();   // 组间节拍器：在用户点击的 gesture 链内初始化音频
    renderW();
    updateHUD();
    speak(warm.length ? ('先做热身运动，共 ' + warm.length + ' 个热身动作') : ('准备开始，共 ' + seq.length + ' 个动作'));
    speak(String(W.rem)); // 3-2-1 起始数字
    WT = setInterval(onTick, 1000);
  }
  function curA() { return W.seq[W.i]; }
  function onTick() {
    if (!W || W.paused) return;
    if (W.phase === 'ready') {
      W.rem--;
      if (W.rem <= 0) { speak('开始'); enterAct(); } else { speak(String(W.rem)); refreshN(); }
    } else if (W.phase === 'act') {
      if (curA().type === 'time' || curA().type === 'reps') { W.rem--; if (W.rem <= 0) { W.actual = curA().value; leaveAct(); } else refreshN(); }
    } else if (W.phase === 'rest') {
      W.rem--;
      if (W.rem <= 0) { restEnd(); goNext(); }   // 休息结束：强 beep + 震动，进下一动作
      else { tick(); refreshN(); }                // 倒计时每秒轻 tick
    }
    updateHUD();
  }
  function enterAct() {
    W.phase = 'act'; W.actual = 0;
    var a = curA();
    // 计时类按秒倒数；计数类按"每 reps 约 3 秒"估算时长自动跟练，免来回点屏幕
    W.rem = a.type === 'time' ? a.value : Math.max(8, Math.round(a.value * 3));
    var lead = a.phase === 'fin' ? '收尾' : a.phase === 'cool' ? '冷身' : '第 ' + (W.i + 1) + ' 个';
    speak(lead + '，' + a.name + '，' + (a.type === 'reps' ? a.value + ' 次' : '保持 ' + a.value + ' 秒'));
    if (a.cue) setTimeout(function () { if (W && W.phase === 'act') speak(a.cue); }, 1500);
    renderW();
  }
  function leaveAct() {   // 结束当前动作 → 休息（已记录）
    var a = curA();
    W.detail.push({ name: a.name, icon: a.icon, type: a.type, target: a.value, actual: W.actual, phase: a.phase });
    W.i++;
    if (W.i >= W.seq.length) { finishW(); return; }
    // 热身 → 正式训练 交界处：插入独立过渡屏，用户确认后再进入主项
    if (W.i === W.firstMain && !W.warmAck) { W.phase = 'warmDone'; renderW(); speak('热身完成，开始正式训练'); return; }
    W.phase = 'rest'; W.rem = Math.max(2, W.rest);
    var nx = W.seq[W.i];
    speak('休息 ' + W.rem + ' 秒');
    if (nx) setTimeout(function () { if (W && W.phase === 'rest') speak('下一个，' + nx.name); }, 700);
    renderW();
  }
  function goNext() {     // 休息结束 → 下一动作
    W.i++;
    if (W.i >= W.seq.length) { finishW(); return; }
    enterAct();
  }
  function finishW() {
    W.phase = 'done';
    stopT();
    W.detail.forEach(function (x) {
      if (x.type === 'reps' && x.actual > 0 && commitBest(x.name, x.actual)) W.prs++;
    });
    var sec = Math.max(60, (Date.now() - W.t0) / 1000);
    var min = fmtMin(sec);
    var done = W.detail.filter(function (x) { return x.actual > 0; }).length;
    var kcal = W.kcal ? Math.round(W.kcal * min / 20) : 0;
    saveRecord({ date: todayStr(), ts: Date.now(), name: W.title, icon: W.icon, min: min, kcal: kcal,
      done: done, total: W.seq.length, detail: W.detail, bg: W.bg, tag: W.tag });
    spStop();
    speak('训练完成，本次消耗约 ' + kcal + ' 千卡，完成 ' + done + ' 个动作');
    renderW();
  }
  function stopT() { if (WT) { clearInterval(WT); WT = null; } }
  function closeW() {
    stopT(); keepAwake(false); W = null;
    $('#wko').classList.add('hide');
    S.tab = 'record'; renderShell();
  }
  function wProg() {
    if (W.i < W.firstMain) return Math.max(1, Math.round(W.i / W.firstMain * 8)); // 热身占前 8%
    var mainI = W.i - W.firstMain, mainLen = W.seq.length - W.firstMain;
    var frac = mainLen > 0 ? mainI / mainLen : 1;
    return Math.min(100, 8 + Math.round(frac * 92));
  }
  function refreshN() {
    var n = $('#wnum'); if (n) n.textContent = W.rem;
    var p = $('#wprog'); if (p) p.style.width = wProg() + '%';
  }
  function renderW() {
    var wk = $('#wko');
    if (!W) return;
    var a = W.seq[Math.min(W.i, W.seq.length - 1)];
    var total = W.seq.length;
    var posHtml = '';
    if (W.phase === 'ready') posHtml = '<div class="wk-pos">即将开始 · 共 <b>' + total + '</b> 个动作</div>';
    else if (W.phase === 'act') posHtml = '<div class="wk-pos">动作 <b>' + (W.i + 1) + '</b> / ' + total + ' · ' + (a.phase && a.phase !== 'main' ? phaseLabel(a.phase) + ' · ' : '') + (a.type === 'reps' ? '计数' : '计时') + '</div>';
    else if (W.phase === 'rest') posHtml = '<div class="wk-pos">已完成 <b>' + Math.min(W.i, total) + '</b> / ' + total + ' · 休息</div>';
    var body = '', top = '<div class="wk-top"><div class="wk-back" data-a="closeW">‹</div><div class="wk-title">' + esc(W.title) + '</div>' +
      (W.phase !== 'done' ? '<div class="wk-hud" id="whud">00:00</div><div class="wk-voice" data-a="toggleVoice" title="语音教练开关">' + (VOICE_ON ? '🔊' : '🔇') + '</div><div class="wk-close" data-a="closeW">退出</div>' : '') + '</div>';
    if (W.phase === 'ready') {
      body = top + posHtml + '<div class="wk-prog"><i style="width:2%"></i></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 24px;text-align:center">' +
        '<div class="r-l" style="font-size:15px;color:rgba(255,255,255,.75)">' + esc(W.title) + '</div>' +
        '<div class="r-n" id="wnum" style="font-size:110px">' + W.rem + '</div><div class="r-l">准备开始</div>' +
        '<div class="wk-rest-l" style="margin-top:16px">第 1 个动作 · ' + a.icon + ' ' + esc(a.name) + ' · ' + (a.type === 'reps' ? a.value + ' 次' : a.value + ' 秒') + '</div>' +
        '<div class="wk-ctrl"><div class="wk-big" data-a="skipReady" style="width:150px;height:64px;border-radius:999px;font-size:17px">直接开练 ▸</div></div></div>';
    } else if (W.phase === 'done') {
      var doneN = W.detail.filter(function (x) { return x.actual > 0; }).length;
      var hit = W.detail.filter(function (x) { return x.actual >= (x.target || 1); }).length;
      var stk = streak();
      var secDone = Math.floor((Date.now() - W.t0) / 1000);
      var kcalDone = W.kcal ? Math.round(W.kcal * fmtMin(secDone) / 20) : 0;
      var rows = W.detail.map(function (x) {
        var st = (!x.actual || x.actual <= 0) ? '<span style="color:#a0a6ad">未做</span>'
          : (x.actual >= (x.target || 1) ? '<span style="color:#0fb98c;font-weight:800">✓ 达标</span>'
            : '<span style="color:#e08a00;font-weight:800">' + x.actual + '/' + (x.target || 1) + '</span>');
        return '<div class="row-line"><span class="t ' + (x.phase === 'fin' ? 'fin' : x.phase === 'cool' ? 'cool' : 'main') + '">' + phaseLabel(x.phase) + '</span>' + (x.icon || '•') + ' ' + esc(x.name) +
          '<span class="last">目标 ' + (x.target || '-') + (x.type === 'reps' ? ' 次' : ' 秒') + '</span><span class="r">' + st + '</span></div>';
      }).join('');
      body = top + '<div class="wk-done" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;padding:0 18px;overflow-y:auto">' +
        '<div class="d-ic">🎉</div><div class="d-t">训练完成</div>' +
        '<div class="d-p">' + esc(W.title) + '<br>' + doneN + '/' + W.detail.length + ' 个动作完成 · ' + fmtMin(secDone) + ' 分钟' + (kcalDone ? ' · ≈' + kcalDone + ' 千卡' : '') + (stk > 1 ? '<br>🔥 连续打卡 ' + stk + ' 天' : '') + '</div>' +
        (hit ? '<div class="d-rec">🏆 ' + hit + ' 个动作达标' + (W.prs ? ' · 打破 ' + W.prs + ' 项个人纪录' : '') + '</div>' : (W.prs ? '<div class="d-rec">✨ 打破 ' + W.prs + ' 项个人纪录</div>' : '')) +
        '<div class="done-detail">' + rows + '</div>' +
        '<div class="wk-ctrl" style="width:100%"><div class="wk-big" data-a="recDetail" data-i="0" style="width:150px;height:54px;font-size:14px">查看明细 ▸</div>' +
        '<div class="wk-mini" data-a="closeW">完成</div></div></div>';
    } else if (W.phase === 'warmDone') {
      body = top + '<div class="wk-done" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 18px">' +
        '<div class="d-ic">🔥</div><div class="d-t">热身完成</div>' +
        '<div class="d-p">身体已经热开了<br>准备好进入正式训练了吗？</div>' +
        '<div class="wk-ctrl" style="width:100%"><div class="wk-big" data-a="beginMain" style="width:210px;height:64px;font-size:18px">开始正式训练 ▸</div>' +
        '<div class="wk-mini" data-a="closeW">退出</div></div></div>';
    } else {
      var isAct = W.phase === 'act';
      var isTime = isAct && a.type === 'time';
      var big;
      if (isTime) big = '<div class="wk-big" data-a="skipRest"><span id="wnum">' + W.rem + '</span><small>秒 · 自动计时</small></div>';
      else if (isAct) big = '<div class="wk-big" data-a="finishAct"><span id="wnum">' + W.rem + '</span><small>秒 · 自动跟练</small></div>';
      else big = '<div class="wk-big" data-a="skipRest"><span id="wnum">' + W.rem + '</span><small>休息 · 自动进入下一动作</small></div>';
      var side;
      if (isAct && !isTime) side = '<div class="wk-mini" data-a="finishAct" style="font-size:13px">完成<br>本组</div>';
      else side = '<div class="wk-mini" data-a="skipRest">跳过</div>';
      var mid;
      if (W.phase === 'rest' && W.i + 1 < W.seq.length) {
        var nx = W.seq[W.i + 1];
        mid = '<div class="wk-next">' + (nx.gif ? '<img data-fb="' + nx.icon + '" src="' + nx.gif + '">' : '<div style="font-size:26px">' + nx.icon + '</div>') +
          '<div><div class="wn-t">下一动作</div><div class="wn-n">' + esc(nx.name) + ' · ' + (nx.type === 'reps' ? nx.value + ' 次' : nx.value + ' 秒') + '</div></div></div>';
      } else if (isAct) {
        mid = '<div class="wk-cue">' + esc(a.cue || '保持标准动作，注意呼吸节奏') + '</div>';
      } else mid = '<div class="wk-rest-l" style="margin-top:6px">上一组完成，喘口气</div>';
      var optsHtml = (W.phase === 'rest') ? '<div class="wk-rest-opts"><div class="o" data-a="restLess">−5s</div><div class="o" data-a="restMore">+10s</div><div class="o on" data-a="skipRest">跳过</div></div>' : '';
      body = top + posHtml + '<div class="wk-prog"><i id="wprog" style="width:' + wProg() + '%"></i></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 20px;min-height:0">' +
        (isAct ? '<div class="wk-act-name" style="margin-bottom:4px">' + a.icon + ' ' + esc(a.name) + '</div>' : '') +
        (W.phase === 'act' && !isTime ? '<div class="wk-act-tag" id="wl1" style="margin-bottom:4px">目标 ' + a.value + ' 次</div>' : '') +
        '<div class="wk-gif">' + (a.gif ? '<img id="wgif" data-fb="' + a.icon + '" src="' + a.gif + '">' : '<div class="bf">' + a.icon + '</div>') + '</div>' +
        mid + '</div>' + optsHtml +
        '<div class="wk-ctrl">' + side + big + '<div class="wk-mini" data-a="pauseW">⏸</div></div>';
    }
    wk.innerHTML = body;
    // 动作名放顶部进度条上
    var pr = $('#wprog');
  }
  function runCourse(id) {
    var c = courses.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var cfg = diffCfg(S.diff);
    var seq = c.actions.map(function (a) { var b = scaleAction(a, cfg); b.phase = 'main'; return b; });
    var kcal = Math.round((c.kcal || 0) * cfg.kcal);
    startW(seq, c.name, c.icon, kcal, c.color, 'fit_course_' + c.id, Math.max(3, S.restSec + cfg.restAdd), buildWarmSeq());
  }
  function runPlanDay(wIdx, i) {
    var d = S.plan.weeks[wIdx].week[i];
    if (!d || d.rest) return;
    var cfg = diffCfg(S.diff);
    var isRec = d.type === 'recover';
    var seq = d.seq.map(function (s) { var b = scaleAction(s, cfg); b.phase = s.phase || 'main'; return b; });
    var kcal = Math.round((d.kcal || 0) * cfg.kcal);
    startW(seq, '第' + (wIdx + 1) + '周 · ' + d.typeName, d.icon, kcal, '#1FD6A8', 'fit_plan_' + wIdx + '_' + i, Math.max(3, S.restSec + cfg.restAdd), isRec ? [] : buildWarmSeq());
  }

  /* ============ 饮食规划 ============ */
  var BF = [
    { n: '燕麦蛋奶早餐', kcal: 372, parts: [{ n: '燕麦', a: '40g' }, { n: '水煮蛋', a: '2个' }, { n: '脱脂牛奶', a: '200ml' }] },
    { n: '全麦三明治', kcal: 298, parts: [{ n: '全麦面包', a: '2片' }, { n: '鸡蛋', a: '1个' }, { n: '生菜番茄' }, { n: '牛油果', a: '30g' }] },
    { n: '紫薯豆浆', kcal: 393, parts: [{ n: '紫薯', a: '150g' }, { n: '水煮蛋', a: '1个' }, { n: '无糖豆浆', a: '300ml' }, { n: '核桃', a: '15g' }] },
    { n: '鸡胸蔬菜卷', kcal: 276, parts: [{ n: '全麦饼', a: '1张' }, { n: '鸡胸肉', a: '80g' }, { n: '时蔬' }, { n: '低脂酸奶蘸' }] },
    { n: '牛奶麦片', kcal: 430, parts: [{ n: '麦片', a: '50g' }, { n: '牛奶', a: '250ml' }, { n: '香蕉', a: '1根' }] },
    { n: '希腊酸奶碗', kcal: 340, parts: [{ n: '希腊酸奶', a: '150g' }, { n: '蓝莓', a: '50g' }, { n: '燕麦', a: '30g' }, { n: '杏仁', a: '10g' }] }
  ];
  var LUN = [
    { n: '糙米鸡胸', kcal: 404, parts: [{ n: '糙米饭', a: '150g' }, { n: '鸡胸肉', a: '120g' }, { n: '西兰花', a: '150g' }, { n: '橄榄油', a: '5g' }] },
    { n: '牛肉杂粮', kcal: 422, parts: [{ n: '杂粮饭', a: '150g' }, { n: '牛里脊', a: '100g' }, { n: '青菜', a: '150g' }, { n: '麻油', a: '3g' }] },
    { n: '清蒸鱼饭', kcal: 456, parts: [{ n: '米饭', a: '160g' }, { n: '鲈鱼', a: '150g' }, { n: '时蔬' }, { n: '豆油', a: '4g' }] },
    { n: '豆腐鸡丁', kcal: 441, parts: [{ n: '米饭', a: '150g' }, { n: '豆腐', a: '150g' }, { n: '鸡丁', a: '80g' }, { n: '蔬菜' }] },
    { n: '虾仁意面', kcal: 415, parts: [{ n: '意面', a: '60g(干)' }, { n: '虾仁', a: '120g' }, { n: '番茄酱' }, { n: '橄榄油', a: '5g' }] },
    { n: '照烧鸡腿饭', kcal: 470, parts: [{ n: '米饭', a: '150g' }, { n: '去皮鸡腿', a: '120g' }, { n: '西兰花' }, { n: '照烧汁' }] }
  ];
  var DIN = [
    { n: '鸡胸蔬菜沙拉', kcal: 395, parts: [{ n: '鸡胸肉', a: '100g' }, { n: '混合蔬菜', a: '200g' }, { n: '藜麦', a: '50g(干)' }, { n: '橄榄油', a: '5g' }] },
    { n: '鱼蔬荞麦', kcal: 386, parts: [{ n: '荞麦面', a: '60g(干)' }, { n: '鳕鱼', a: '120g' }, { n: '蔬菜' }, { n: '油', a: '4g' }] },
    { n: '番茄牛肉煲', kcal: 448, parts: [{ n: '牛肉', a: '100g' }, { n: '番茄', a: '150g' }, { n: '豆腐', a: '100g' }, { n: '米饭', a: '120g' }] },
    { n: '鸡蛋豆腐羹', kcal: 340, parts: [{ n: '鸡蛋', a: '2个' }, { n: '嫩豆腐', a: '150g' }, { n: '虾仁', a: '60g' }, { n: '蔬菜' }] },
    { n: '鸡腿时蔬', kcal: 402, parts: [{ n: '去皮鸡腿', a: '120g' }, { n: '红薯', a: '150g' }, { n: '西兰花' }, { n: '油', a: '3g' }] },
    { n: '虾仁蒸蛋', kcal: 360, parts: [{ n: '鸡蛋', a: '2个' }, { n: '虾仁', a: '80g' }, { n: '冬瓜' }, { n: '米饭', a: '100g' }] }
  ];
  var SNK = [
    { n: '酸奶蓝莓', kcal: 120, parts: [{ n: '希腊酸奶', a: '150g' }, { n: '蓝莓', a: '50g' }] },
    { n: '苹果杏仁', kcal: 183, parts: [{ n: '苹果', a: '1个' }, { n: '杏仁', a: '15g' }] },
    { n: '香蕉花生酱', kcal: 167, parts: [{ n: '香蕉', a: '1根' }, { n: '花生酱', a: '10g' }] },
    { n: '牛奶核桃', kcal: 222, parts: [{ n: '牛奶', a: '200ml' }, { n: '核桃', a: '15g' }] },
    { n: '蛋黄瓜', kcal: 155, parts: [{ n: '水煮蛋', a: '2个' }, { n: '黄瓜' }] },
    { n: '豆浆燕麦', kcal: 175, parts: [{ n: '无糖豆浆', a: '300ml' }, { n: '燕麦', a: '25g' }] }
  ];
  function bmr(p) { var b = 10 * p.weight + 6.25 * p.height - 5 * p.age; return Math.round(p.gender === '女' ? b - 161 : b + 5); }
  function tdee(b, act) { var f = ({ '久坐': 1.2, '轻度': 1.375, '中度': 1.55, '高强度': 1.725 })[act] || 1.2; return Math.round(b * f); }
  function targetKcal(t, goal) { return goal === '减脂' ? Math.round(t - 400) : goal === '增肌' ? Math.round(t + 300) : t; }
  function macroSplit(kcal, weight, goal, training) {
    var pPerKg = goal === '减脂' ? 2.0 : goal === '增肌' ? 1.8 : 1.6;
    var protein = Math.round(weight * pPerKg);
    var fat = Math.round(weight * 0.9);
    var pk = protein * 4, fk = fat * 9;
    var ck = kcal - pk - fk;
    if (ck < 0) ck = Math.round(kcal * 0.4);
    var carb = Math.round(ck / 4);
    if (training) { var shift = Math.round(kcal * 0.08); carb = Math.round((ck + shift) / 4); fat = Math.max(20, Math.round((fk - shift) / 9)); }
    return { protein: protein, fat: fat, carb: carb, pk: protein * 4, fk: fat * 9, ck: carb * 4 };
  }
  function pickMeal(arr, target) {
    var pool = arr.filter(function (t) { return Math.abs(t.kcal - target) <= 80; });
    if (!pool.length) { var bd = 1e9, bn = arr[0]; arr.forEach(function (t) { var d = Math.abs(t.kcal - target); if (d < bd) { bd = d; bn = t; } }); pool = [bn]; }
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function chipRowSel(arr, key, sel, aName) {
    return '<div class="chips">' + arr.map(function (v) {
      return '<span class="chip ' + (sel === v ? 'on' : '') + '" data-a="' + aName + '" data-k="' + key + '" data-v="' + v + '">' + v + '</span>';
    }).join('') + '</div>';
  }
  function mealCard(title, pct, meal) {
    var parts = meal.parts.map(function (x) { return '<div class="mc-p">' + esc(x.n) + (x.a ? ' <span class="mc-a">' + esc(x.a) + '</span>' : '') + '</div>'; }).join('');
    return '<div class="meal-card"><div class="mc-h"><span class="mc-t">' + title + '</span><span class="mc-pct">' + pct + '%</span><span class="mc-k">' + meal.kcal + ' 千卡</span></div>' + parts + '</div>';
  }
  function vDietForm() {
    var d = S.dietDraft;
    return '<div class="form-t">⚧ 性别</div>' + chipRowSel(['男', '女'], 'gender', d.gender, 'dform') +
      '<div class="form-t">🎂 年龄（岁）</div><div class="flds"><input class="fld" type="number" inputmode="numeric" data-k="age" value="' + d.age + '"></div>' +
      '<div class="form-t">📏 身高（cm）</div><div class="flds"><input class="fld" type="number" inputmode="numeric" data-k="height" value="' + d.height + '"></div>' +
      '<div class="form-t">⚖️ 体重（kg）</div><div class="flds"><input class="fld" type="number" inputmode="numeric" data-k="weight" value="' + d.weight + '"></div>' +
      '<div class="form-t">🏃 日常活动量</div>' + chipRowSel(['久坐', '轻度', '中度', '高强度'], 'activity', d.activity, 'dform') +
      '<div class="form-t">🎯 目标</div>' + chipRowSel(['减脂', '增肌', '维持'], 'goal', d.goal, 'dform') +
      '<div class="gen-btn btn" data-a="saveDiet">✨ 生成我的饮食方案</div>' +
      '<div style="text-align:center;font-size:11px;color:#a0a6ad;margin:14px 6px;line-height:1.7">按 Mifflin-St Jeor 公式估算基础代谢，结合活动系数与训练目标给出热量与营养素方案，并搭配一日餐单样例</div>';
  }
  function vDietResult() {
    var d = S.diet;
    var b = bmr(d), td = tdee(b, d.activity), tgt = targetKcal(td, d.goal);
    var dayK = d.training ? tgt + 150 : tgt;
    var m = macroSplit(dayK, d.weight, d.goal, d.training);
    var tot = m.pk + m.ck + m.fk || 1;
    var shares = { bf: Math.round(dayK * 0.25), lunch: Math.round(dayK * 0.35), dinner: Math.round(dayK * 0.30) };
    var bf = pickMeal(BF, shares.bf), lunch = pickMeal(LUN, shares.lunch), dinner = pickMeal(DIN, shares.dinner);
    var snackK = dayK - (bf.kcal + lunch.kcal + dinner.kcal);
    var snack = pickMeal(SNK, snackK > 60 ? snackK : 150);
    var water = Math.round(d.weight * 35);
    var goalTxt = d.goal === '减脂' ? '热量缺口，建议配合训练与充足蛋白以保留肌肉' : d.goal === '增肌' ? '热量盈余，保证蛋白摄入与力量训练刺激' : '维持当前体重，均衡搭配即可';
    return '' +
      '<div class="card diet-sum">' +
      '<div class="ds-row"><div class="ds-b"><div class="n">' + b + '</div><div class="l">基础代谢 BMR</div></div>' +
      '<div class="ds-b"><div class="n">' + td + '</div><div class="l">每日消耗 TDEE</div></div></div>' +
      '<div class="ds-target"><span class="ds-k">' + dayK + '</span> 千卡/天 · ' + (d.training ? '训练日' : '休息日') + ' · ' + esc(d.goal) + '</div></div>' +
      '<div class="card"><div class="form-t" style="margin:0 0 8px">🥗 三大营养素配比</div>' +
      '<div class="macro-bar"><i class="mp p" style="width:' + Math.round(m.pk / tot * 100) + '%"></i><i class="mp c" style="width:' + Math.round(m.ck / tot * 100) + '%"></i><i class="mp f" style="width:' + Math.round(m.fk / tot * 100) + '%"></i></div>' +
      '<div class="macro-leg"><span><b style="color:#0fb98c">' + m.protein + 'g</b> 蛋白 ' + Math.round(m.pk / tot * 100) + '%</span>' +
      '<span><b style="color:#f0a23a">' + m.carb + 'g</b> 碳水 ' + Math.round(m.ck / tot * 100) + '%</span>' +
      '<span><b style="color:#6a78d6">' + m.fat + 'g</b> 脂肪 ' + Math.round(m.fk / tot * 100) + '%</span></div>' +
      '<div style="font-size:11px;color:#a0a6ad;margin-top:8px">💧 建议饮水 ' + water + ' ml/天（约 ' + Math.round(water / 250) + ' 杯）</div></div>' +
      '<div class="diff-seg" style="margin:10px 0 6px"><span class="dl">当日类型</span>' +
      '<div class="o' + (d.training ? '' : ' on') + '" data-a="dietTrain" data-v="0">休息日</div>' +
      '<div class="o' + (d.training ? ' on' : '') + '" data-a="dietTrain" data-v="1">训练日</div></div>' +
      '<div class="h-sec">今日餐单 <span class="more" data-a="dietRegen" style="cursor:pointer">换一批 ⟳</span></div>' +
      mealCard('早餐', 25, bf) + mealCard('午餐', 35, lunch) + mealCard('晚餐', 30, dinner) + mealCard('加餐', 10, snack) +
      '<div class="card" style="font-size:11.5px;color:#7a838e;line-height:1.6;background:#f5f7f8">📌 ' + goalTxt + '。餐单为参考样例，按热量目标搭配中式食材；如有代谢疾病或特殊饮食需求，请遵营养师/医嘱。</div>' +
      '<div class="gen-btn btn ghost" data-a="dietEdit">↻ 重新填写资料</div>';
  }
  function vDiet() { return S.diet ? vDietResult() : vDietForm(); }

  /* ============ 记录趋势图 ============ */
  function weeklyTrend() {
    var map = {};
    S.records.forEach(function (r) {
      var d = new Date(r.date + 'T00:00:00');
      var y = d.getFullYear(); var start = new Date(y, 0, 1);
      var wk = Math.floor((Math.floor((d - start) / 86400000) + start.getDay() + 1) / 7);
      var key = y + '-' + wk;
      map[key] = (map[key] || 0) + (r.min || 0);
    });
    var out = [], now = new Date();
    for (var i = 7; i >= 0; i--) {
      var d = new Date(now); d.setDate(d.getDate() - i * 7);
      var y = d.getFullYear(); var start = new Date(y, 0, 1);
      var wk = Math.floor((Math.floor((d - start) / 86400000) + start.getDay() + 1) / 7);
      out.push({ label: i === 0 ? '本周' : i + '周前', min: map[y + '-' + wk] || 0 });
    }
    return out;
  }
  function trendHtml() {
    if (!S.records.length) return '';
    var data = weeklyTrend();
    var max = Math.max.apply(null, data.map(function (x) { return x.min; }).concat([1]));
    var bars = data.map(function (x) {
      var h = Math.max(4, Math.round(x.min / max * 100));
      return '<div class="tb"><div class="tb-c"><i class="' + (x.min > 0 ? '' : 'e') + '" style="height:' + h + '%"></i></div>' +
        '<div class="tb-l">' + x.label + '</div><div class="tb-v">' + x.min + '</div></div>';
    }).join('');
    return '<div class="h-sec">📊 近 8 周训练时长（分钟）</div><div class="trend">' + bars + '</div>';
  }

  /* ============ 事件委托 ============ */
  app.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-a]') : null;
    if (!el) return;
    var a = el.dataset.a, v = el.dataset.v, k = el.dataset.k;
    if (a === 'xSheet') { closeSheet(); return; }
    if (a === 'tab') { S.tab = v; renderShell(); return; }
    if (a === 'tabplan') { S.tab = 'plan'; renderShell(); return; }
    if (a === 'seg') { S.seg = v; renderView(); return; }
    if (a === 'mus') { S.actMus = v; renderView(); return; }
    if (a === 'form') { S.form[k] = (k === 'day' || k === 'length') ? Number(v) : v; renderView(); return; }
    if (a === 'genPlan') {
      S.plan = generatePlan({ goal: S.form.goal, days: S.form.day, length: S.form.length, level: S.form.level }, histForPlan());
      S.weekIdx = 0; saveK(KP, S.plan); renderView(); return;
    }
    if (a === 'replan') { S.plan = null; saveK(KP, null); renderView(); return; }
    if (a === 'week') { S.weekIdx = Number(el.dataset.i); renderView(); return; }
    if (a === 'openCourse') { var c = courses.filter(function (x) { return x.id === el.dataset.id; })[0]; if (c) sheetCourse(c); return; }
    if (a === 'runCourse') { closeSheet(); runCourse(el.dataset.id); return; }
    if (a === 'actInfo') { sheetAct(el.dataset.name); return; }
    /* 自定义训练 builder */
    if (a === 'bldToggle') {
      var nm = el.dataset.name;
      if (S.builder.sel[nm]) delete S.builder.sel[nm]; else S.builder.sel[nm] = 1;
      renderView(); return;
    }
    if (a === 'bldRound') {
      S.builder.rounds = Math.max(1, Math.min(5, S.builder.rounds + (v === '1' ? 1 : -1)));
      renderView(); return;
    }
    if (a === 'bldStart') { closeSheet(); bldStart(); return; }
    if (a === 'openDay') { sheetDay(Number(el.dataset.w), Number(el.dataset.i)); return; }
    if (a === 'runDay') { closeSheet(); runPlanDay(Number(el.dataset.w), Number(el.dataset.i)); return; }
    if (a === 'replay') {
      var r = S.records[0]; if (!r) return;
      if (r.tag && r.tag.indexOf('fit_course_') === 0) { runCourse(r.tag.slice(10)); return; }
      if (r.tag && r.tag.indexOf('fit_plan_') === 0) {
        var ps = r.tag.slice(9).split('_');
        if (S.plan && S.plan.weeks[Number(ps[0])]) runPlanDay(Number(ps[0]), Number(ps[1]));
        return;
      }
      return;
    }
    if (a === 'recDetail') { sheetRec(Number(el.dataset.i)); return; }
    /* 饮食规划 */
    if (a === 'dform') { S.dietDraft[k] = v; renderView(); return; }
    if (a === 'saveDiet') { S.diet = Object.assign({}, S.dietDraft, { training: false }); saveK('fit_diet', S.diet); renderView(); return; }
    if (a === 'dietEdit') { S.dietDraft = Object.assign({}, S.diet); S.diet = null; saveK('fit_diet', null); renderView(); return; }
    if (a === 'dietTrain') { if (S.diet) { S.diet.training = (v === '1'); saveK('fit_diet', S.diet); renderView(); } return; }
    if (a === 'dietRegen') { renderView(); return; }
    /* 跟练 */
    if (a === 'skipReady') { enterAct(); return; }
    if (a === 'beginMain') { if (W && W.phase === 'warmDone') { W.warmAck = true; enterAct(); } return; }
    if (a === 'addRep') {
      if (W.actual < curA().value) { W.actual++; refreshN(); }
      else leaveAct();
      return;
    }
    if (a === 'repDec') { if (W.actual > 0) { W.actual--; refreshN(); } return; }
    if (a === 'skipRest') {
      if (W.phase === 'rest') goNext(); else if (W.phase === 'act') leaveAct();
      return;
    }
    if (a === 'finishAct') { if (W && W.phase === 'act') { W.actual = curA().value; leaveAct(); } return; }
    if (a === 'pauseW') { if (W) { W.paused = !W.paused; } return; }
    if (a === 'closeW') { closeW(); return; }
    if (a === 'toggleVoice') { VOICE_ON = !VOICE_ON; saveK('fit_voice', VOICE_ON); if (!VOICE_ON) spStop(); renderW(); return; }
    if (a === 'setDiff') { S.diff = v; saveK('fit_diff', S.diff); if (S._course) sheetCourse(S._course); else if (S._day) sheetDay(S._day.w, S._day.i); return; }
    if (a === 'restMore') { if (W && W.phase === 'rest') { W.rem += 10; refreshN(); speak('休息 ' + W.rem + ' 秒'); } return; }
    if (a === 'restLess') { if (W && W.phase === 'rest') { W.rem = Math.max(2, W.rem - 5); refreshN(); } return; }
  });
  /* 点遮罩关 sheet */
  app.addEventListener('click', function (e) { if (e.target && e.target.id === 'sheetMask') closeSheet(); });
  /* 饮食表单：数字输入实时写草稿（不重渲染，避免丢失焦点） */
  app.addEventListener('input', function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains('fld')) {
      var k = t.dataset.k;
      S.dietDraft[k] = (k === 'age' || k === 'height' || k === 'weight') ? (Number(t.value) || 0) : t.value;
    }
  });

  renderShell();
})();
