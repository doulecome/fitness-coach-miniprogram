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

  /* ===== 图片兜底：GIF CDN 加载失败 → 替换为动作 emoji（error 不冒泡，须 capture 捕获） ===== */
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.parentNode) {
      var s = document.createElement('span');
      s.className = 'img-fb';
      s.textContent = t.getAttribute('data-fb') || '🏋️';
      t.parentNode.replaceChild(s, t);
    }
  }, true);

  /* ============ 状态 ============ */
  var S = {
    tab: 'home', seg: 'course', actMus: '全部',
    best: loadK(KB, {}), records: loadK(KR, []), plan: loadK(KP, null), weekIdx: 0,
    form: { goal: '减脂', day: 4, length: 30, level: '进阶' }, restSec: loadK(KRS, 10)
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
  var TABS = [{ k: 'home', i: '🏠', l: '首页' }, { k: 'train', i: '🏋️', l: '训练' }, { k: 'plan', i: '🗓️', l: '计划' }, { k: 'record', i: '📈', l: '记录' }];
  function tabTitle() {
    if (S.tab === 'home') return '健身教练';
    if (S.tab === 'train') return '训练';
    if (S.tab === 'plan') return S.plan ? '我的 4 周计划' : 'AI 定制计划';
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
      heroTxt = '今日 · ' + day.icon + ' ' + day.typeName;
      heroSub = day.muscle + ' · 约 ' + day.duration + ' 分钟' + (day.custom ? ' · 🧠 ' + day.custom + ' 个动作按你成绩定制' : '');
      heroBtn = '开始今日训练';
    } else { heroTxt = '开始你的第一练'; heroSub = '先生成一份 4 周 AI 计划，或直接挑一门课开练'; heroBtn = '去定制计划'; }
    var hb = day && !day.rest ? 'runDay' : 'tabplan';
    var lastR = S.records[0];
    var lastCard = '';
    if (lastR) {
      var lb = lastR.tag && lastR.tag.indexOf('fit_course_') === 0 ? 'replay' : (lastR.tag && lastR.tag.indexOf('fit_plan_') === 0 ? 'replay' : '');
      lastCard = '<div class="card last-rec"><div class="lr-ic" style="background:' + esc(lastR.bg || '#eef4f1') + '">' + (lastR.icon || '🏋️') + '</div>' +
        '<div><div class="lr-n">' + esc(lastR.name) + '</div><div class="lr-s">' + lastR.date + ' · ' + lastR.min + ' 分钟' + (lastR.done != null ? ' · 完成 ' + lastR.done + '/' + lastR.total : '') + '</div></div>' +
        (lb ? '<div class="btn" data-a="' + lb + '">再练一次</div>' : '') + '</div>';
    }
    var strip = '<div class="course-strip">' + courses.slice(0, 6).map(function (c) {
      return '<div class="cs-card" data-a="openCourse" data-id="' + c.id + '"><div class="c-ic">' + c.icon + '</div><div class="c-n">' + esc(c.name) + '</div><div class="c-m">' + c.duration + '′ · ' + c.actions.length + ' 动作</div></div>';
    }).join('') + '</div>';
    return '<div class="hero"><div class="h-day">' + (d.getMonth() + 1) + '月' + d.getDate() + '日 · ' + WCN[jd] + '</div>' +
      '<div class="h-t">' + esc(heroTxt) + '</div><div class="h-desc">' + esc(heroSub) + '</div>' +
      '<div class="h-cta" data-a="' + hb + '" data-w="0" data-i="' + slot + '">' + heroBtn + '</div></div>' +
      '<div class="stats-row"><div class="stat"><div class="n">' + minToday + '</div><div class="l">今日分钟</div></div>' +
      '<div class="stat"><div class="n">' + mdays + '</div><div class="l">本月练次</div></div>' +
      '<div class="stat"><div class="n">' + recCount + '</div><div class="l">动作有纪录</div></div></div>' +
      '<div class="h-sec">精选课程<span class="more">点卡片看动作清单</span></div>' + strip + lastCard;
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
    var seg = '<div class="seg"><div class="sg ' + (S.seg === 'course' ? 'on' : '') + '" data-a="seg" data-v="course">课程</div><div class="sg ' + (S.seg === 'acts' ? 'on' : '') + '" data-a="seg" data-v="acts">动作库</div></div>';
    if (S.seg === 'course') {
      return seg + '<div class="course-grid">' + courses.map(function (c) {
        return '<div class="course-card" data-a="openCourse" data-id="' + c.id + '"><div class="cc-ic" style="background:' + esc(c.color || '#1FD6A8') + '22">' + c.icon + '</div>' +
          '<div class="cc-n">' + esc(c.name) + '</div><div class="cc-m">' + c.level + ' · ' + c.duration + ' 分钟 · ' + c.actions.length + ' 动作</div>' +
          '<div class="cc-btn btn">开始 ▸</div></div>';
      }).join('') + '</div>';
    }
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
    return '<div class="stats-row"><div class="stat"><div class="n">' + S.records.length + '</div><div class="l">累计训练</div></div>' +
      '<div class="stat"><div class="n">' + totalMin + '</div><div class="l">总分钟</div></div>' +
      '<div class="stat"><div class="n">' + names.length + '</div><div class="l">动作有纪录</div></div></div>' +
      (bestCards ? '<div class="h-sec">💪 动作最佳纪录</div>' + bestCards : '') +
      '<div class="h-sec">训练历史</div>' +
      (list || '<div class="empty"><div class="e-ic">🏋️</div>还没有训练记录<br>去首页开练一次吧</div>');
  }

  /* ============ Bottom sheet ============ */
  function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheetMask').style.display = 'flex'; }
  function closeSheet() { $('#sheetMask').style.display = 'none'; }
  function sheetCourse(c) {
    var rows = c.actions.map(function (a) {
      return '<div class="row-line"><span class="t main">' + (a.type === 'reps' ? '计数' : '计时') + '</span>' + a.icon + ' ' + esc(a.name) +
        '<span class="r">' + a.value + (a.type === 'reps' ? ' 次' : ' 秒') + '</span></div>';
    }).join('');
    openSheet('<div class="sh-h"><div class="sh-t">' + c.icon + ' ' + esc(c.name) + '</div><div class="x" data-a="xSheet">✕</div></div>' +
      '<div class="sh-sub">' + c.level + ' · ' + c.duration + ' 分钟 · 约 ' + c.kcal + ' 千卡 · ' + c.actions.length + ' 个动作</div>' +
      '<div class="card" style="background:#f5f7f8;font-size:12px;line-height:1.6;color:#4a525c;padding:10px 12px">' + esc(c.desc) + '</div>' + rows +
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
    var rows = d.acts.map(function (a) {
      var tag = a.fin ? 'fin' : a.cool ? 'cool' : 'main';
      var tl = a.fin ? '收尾' : a.cool ? '冷身' : '主项';
      return '<div class="row-line"><span class="t ' + tag + '">' + tl + '</span>' + a.icon + ' ' + esc(a.name) +
        '<span class="r">×' + (a.round || 1) + ' ' + a.target + a.unit + '</span></div>';
    }).join('');
    openSheet('<div class="sh-h"><div class="sh-t">' + d.wd + ' · ' + d.icon + ' ' + esc(d.typeName) + '</div><div class="x" data-a="xSheet">✕</div></div>' +
      '<div class="sh-sub">' + esc(d.muscle) + ' · 约 ' + d.duration + ' 分钟' + (d.custom ? ' · 🧠 ' + d.custom + ' 按成绩定制' : '') + '</div>' +
      '<div class="warm-box">🔥 ' + esc(d.warm || '') + '</div>' + rows +
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

  /* ============ 跟练引擎 ============ */
  var W = null, WT = null;
  function startW(seq, title, icon, kcal, bg, tag) {
    W = { seq: seq, title: title, icon: icon, kcal: kcal || 0, bg: bg || '#1FD6A8', i: 0, phase: 'ready', rem: 3,
      actual: 0, detail: [], t0: Date.now(), rest: S.restSec, paused: false, prs: 0, tag: tag };
    $('#wko').classList.remove('hide');
    renderW();
    WT = setInterval(onTick, 1000);
  }
  function curA() { return W.seq[W.i]; }
  function onTick() {
    if (!W || W.paused) return;
    if (W.phase === 'ready') {
      W.rem--;
      if (W.rem <= 0) enterAct(); else refreshN();
    } else if (W.phase === 'act') {
      if (curA().type === 'time') { W.rem--; if (W.rem <= 0) { W.actual = curA().value; leaveAct(); } else refreshN(); }
    } else if (W.phase === 'rest') {
      W.rem--;
      if (W.rem <= 0) goNext();
      else refreshN();
    }
  }
  function enterAct() {
    W.phase = 'act'; W.actual = 0;
    var a = curA();
    W.rem = a.type === 'time' ? a.value : 0;
    renderW();
  }
  function leaveAct() {   // 结束当前动作 → 休息（已记录）
    var a = curA();
    W.detail.push({ name: a.name, icon: a.icon, type: a.type, target: a.value, actual: W.actual });
    W.i++;
    if (W.i >= W.seq.length) { finishW(); return; }
    W.phase = 'rest'; W.rem = Math.max(2, W.rest); renderW();
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
    renderW();
  }
  function stopT() { if (WT) { clearInterval(WT); WT = null; } }
  function closeW() {
    stopT(); W = null;
    $('#wko').classList.add('hide');
    S.tab = 'record'; renderShell();
  }
  function wProg() {
    return Math.min(100, Math.round(((W.i + (W.phase === 'rest' || W.phase === 'done' ? 1 : 0.35)) / W.seq.length) * 100));
  }
  function refreshN() {
    var n = $('#wnum'); if (n) n.textContent = W.phase === 'act' && curA().type === 'reps' ? Math.min(W.actual + 1, curA().value) : W.rem;
    var p = $('#wprog'); if (p) p.style.width = wProg() + '%';
  }
  function renderW() {
    var wk = $('#wko');
    if (!W) return;
    var a = W.seq[Math.min(W.i, W.seq.length - 1)];
    var body = '', top = '<div class="wk-top"><div class="wk-back" data-a="closeW">‹</div><div class="wk-title">' + esc(W.title) + '</div>' +
      (W.phase !== 'done' ? '<div class="wk-close" data-a="closeW">退出</div>' : '') + '</div>';
    if (W.phase === 'ready') {
      body = top + '<div class="wk-prog"><i style="width:2%"></i></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 24px;text-align:center">' +
        '<div class="r-l" style="font-size:15px;color:rgba(255,255,255,.75)">' + esc(W.title) + '</div>' +
        '<div class="r-n" id="wnum" style="font-size:96px">' + W.rem + '</div><div class="r-l">准备开始</div>' +
        '<div class="wk-rest-l" style="margin-top:16px">第 1 个动作 · ' + a.icon + ' ' + esc(a.name) + ' · ' + (a.type === 'reps' ? a.value + ' 次' : a.value + ' 秒') + '</div>' +
        '<div class="wk-ctrl"><div class="wk-big" data-a="skipReady" style="width:150px;height:64px;border-radius:999px;font-size:17px">直接开练 ▸</div></div></div>';
    } else if (W.phase === 'done') {
      var doneN = W.detail.filter(function (x) { return x.actual > 0; }).length;
      var hit = W.detail.filter(function (x) { return x.actual >= (x.target || 1); }).length;
      body = top + '<div class="wk-done" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 24px">' +
        '<div class="d-ic">🎉</div><div class="d-t">训练完成</div>' +
        '<div class="d-p">' + esc(W.title) + '<br>' + doneN + '/' + W.detail.length + ' 个动作完成 · ' + fmtMin((Date.now() - W.t0) / 1000) + ' 分钟</div>' +
        (hit ? '<div class="d-rec">🏆 ' + hit + ' 个动作达标' + (W.prs ? ' · 打破 ' + W.prs + ' 项个人纪录' : '') + '</div>' : (W.prs ? '<div class="d-rec">✨ 打破 ' + W.prs + ' 项个人纪录</div>' : '')) +
        '<div class="wk-ctrl"><div class="wk-big" data-a="closeW" style="width:160px;height:60px;border-radius:999px;font-size:16px">完成</div></div></div>';
    } else {
      var isAct = W.phase === 'act';
      var isTime = isAct && a.type === 'time';
      var big;
      if (isTime) big = '<div class="wk-big" data-a="skipRest"><span id="wnum">' + W.rem + '</span><small>秒 · 点击跳过</small></div>';
      else if (isAct) big = '<div class="wk-big" data-a="addRep"><span id="wnum">1</span><small>做完一次点一下</small></div>';
      else big = '<div class="wk-big" data-a="skipRest"><span id="wnum">' + W.rem + '</span><small>休息 · 点击跳过</small></div>';
      var side;
      if (isAct && !isTime) side = '<div class="wk-mini" data-a="repDec">−</div><div class="wk-mini" data-a="skipRest" style="font-size:13px">完成<br>本组</div>';
      else side = '<div class="wk-mini" data-a="skipRest">跳过</div>';
      var mid;
      if (W.phase === 'rest' && W.i + 1 < W.seq.length) {
        var nx = W.seq[W.i + 1];
        mid = '<div class="wk-next">' + (nx.gif ? '<img data-fb="' + nx.icon + '" src="' + nx.gif + '">' : '<div style="font-size:26px">' + nx.icon + '</div>') +
          '<div><div class="wn-t">下一动作</div><div class="wn-n">' + esc(nx.name) + ' · ' + (nx.type === 'reps' ? nx.value + ' 次' : nx.value + ' 秒') + '</div></div></div>';
      } else if (isAct) {
        mid = '<div class="wk-cue">' + esc(a.cue || '保持标准动作，注意呼吸节奏') + '</div>';
      } else mid = '<div class="wk-rest-l" style="margin-top:6px">上一组完成，喘口气</div>';
      body = top + '<div class="wk-prog"><i id="wprog" style="width:' + wProg() + '%"></i></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 20px;min-height:0">' +
        (W.phase === 'act' && !isTime ? '<div class="wk-act-tag" id="wl1" style="margin-bottom:8px">目标 ' + a.value + ' 次</div>' : '') +
        '<div class="wk-gif">' + (a.gif ? '<img id="wgif" data-fb="' + a.icon + '" src="' + a.gif + '">' : '<div class="bf">' + a.icon + '</div>') + '</div>' +
        mid + '</div>' +
        '<div class="wk-ctrl">' + side + big + '<div class="wk-mini" data-a="pauseW">⏸</div></div>';
    }
    wk.innerHTML = body;
    // 动作名放顶部进度条上
    var pr = $('#wprog');
  }
  function runCourse(id) {
    var c = courses.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var seq = c.actions.map(function (a) { return { name: a.name, icon: a.icon, type: a.type, value: a.value, gif: a.gif, cue: a.cue }; });
    startW(seq, c.name, c.icon, c.kcal, c.color, 'fit_course_' + c.id);
  }
  function runPlanDay(wIdx, i) {
    var d = S.plan.weeks[wIdx].week[i];
    if (!d || d.rest) return;
    var seq = d.seq.map(function (s) { return { name: s.name, icon: s.icon, type: s.type, value: s.value, gif: s.gif, cue: s.cue }; });
    startW(seq, '第' + (wIdx + 1) + '周 · ' + d.typeName, d.icon, d.kcal || 0, '#1FD6A8', 'fit_plan_' + wIdx + '_' + i);
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
    if (a === 'openCourse') { var c = courses.filter(function (x) { return x.id === v; })[0]; if (c) sheetCourse(c); return; }
    if (a === 'runCourse') { closeSheet(); runCourse(v); return; }
    if (a === 'actInfo') { sheetAct(el.dataset.name); return; }
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
    /* 跟练 */
    if (a === 'skipReady') { enterAct(); return; }
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
    if (a === 'pauseW') { if (W) { W.paused = !W.paused; } return; }
    if (a === 'closeW') { closeW(); return; }
  });
  /* 点遮罩关 sheet */
  app.addEventListener('click', function (e) { if (e.target && e.target.id === 'sheetMask') closeSheet(); });

  renderShell();
})();
