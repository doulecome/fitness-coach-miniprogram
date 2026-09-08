/* 健身教练 · 网页版交互逻辑（由 build_site.js 注入 window.__NS 后运行） */
(function () {
  'use strict';
  var NS = window.__NS;
  var courses = NS.courses, generatePlan = NS.generatePlan;
  var KB = 'fit_best', KR = 'fit_records', KP = 'fit_plan', KRS = 'fit_rest';

  /* ============ 工具 ============ */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // 渲染动作示范：gif 走 <img>，视频(开练覆盖通道的 .mp4/.webm)走 <video> 自动循环；无图时降级 emoji
  function mediaTag(url, icon, extra) {
    icon = icon || '🏋️'; extra = extra || '';
    if (!url) return '<div class="bf">' + esc(icon) + '</div>';
    if (/\.(mp4|webm|ogg|mov)$/i.test(url)) return '<video ' + extra + ' data-fb="' + esc(icon) + '" autoplay loop muted playsinline src="' + url + '"></video>';
    return '<img ' + extra + ' loading="lazy" data-fb="' + esc(icon) + '" src="' + url + '">';
  }
  function $(s, p) { return (p || document).querySelector(s); }
  function todayStr() { var d = new Date(), m = '0' + (d.getMonth() + 1), dd = '0' + d.getDate(); return d.getFullYear() + '-' + m.slice(-2) + '-' + dd.slice(-2); }
  function fmtMin(sec) { return Math.max(1, Math.round(sec / 60)); }
  var WCN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function loadK(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function saveK(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  /* 轻提示 toast：底部浮层 2.2s 自动消失，复用单实例 */
  var toastT = null;
  function toast(msg) {
    var t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; app.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  /* ===== 图片兜底：GIF CDN 加载失败 → 依次切换备用节点，全失败才降级为 emoji =====
     error 不冒泡，须 capture 捕获；容错链按可达性排序：cdn/gcore 直连 200、fastly 301 跟随 */
  var GIF_HOSTS = ['cdn.jsdelivr.net', 'gcore.jsdelivr.net', 'fastly.jsdelivr.net'];
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || (t.tagName !== 'IMG' && t.tagName !== 'VIDEO')) return;
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
    tab: 'home', seg: 'course', actMus: '全部', equipFilter: '全部',
    best: loadK(KB, {}), records: loadK(KR, []), plan: loadK(KP, null), weekIdx: 0,
    form: { goal: '减脂', day: 4, length: 30, level: '进阶' }, restSec: loadK(KRS, 10), diff: loadK('fit_diff', 'std'),
    recoveryOn: loadK('fit_recovery', false),
    weights: loadK('fit_weight', {}), dietLog: loadK('fit_dietlog', {}),
    hiit: { tpl: 'tabata', sel: {} }, badges: loadK('fit_badges', {}),
    diet: loadK('fit_diet', null), dietDraft: { gender: '男', age: 28, height: 175, weight: 70, activity: '中度', goal: '减脂' },
    builder: { sel: {}, rounds: 3 },
    dietPair: { staple: '', protein: '', veg: '', other: '' }, dietPairRes: null
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
  function saveRecord(o) { S.records.unshift(o); S.records = S.records.slice(0, 200); saveK(KR, S.records); checkNewBadges(); }

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
      (heroBg ? mediaTag(heroBg, heroEmoji, 'class="hero-bg"') + '<div class="hero-veil"></div>' : '') +
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
    // 呼吸放松（#24）：三种节奏，复用跟练全屏引擎做引导
    var breathCard = '<div class="card breath-card"><div style="display:flex;align-items:center;gap:10px">' +
      '<span style="font-size:24px">🌬</span><div style="flex:1;min-width:0"><div style="font-weight:800;font-size:13.5px;color:var(--ink)">呼吸放松 · 1-2 分钟</div>' +
      '<div style="font-size:10.5px;color:#7a838e;margin-top:2px">睡前助眠 / 训练前专注 / 焦虑平复，跟随全屏节奏引导</div></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<div class="btn" style="flex:1;font-size:12px;padding:9px 0" data-a="breath" data-v="478">4-7-8 助眠</div>' +
      '<div class="btn ghost" style="flex:1;font-size:12px;padding:9px 0" data-a="breath" data-v="box">盒式专注</div>' +
      '<div class="btn ghost" style="flex:1;font-size:12px;padding:9px 0" data-a="breath" data-v="618">6-1-6 平复</div></div></div>';
    // 精选课程：真人 GIF 封面大卡（用每门课第一个动作的演示图），Keep 式推荐流
    var strip = '<div class="course-strip">' + courses.slice(0, 6).map(function (c) {
      var cover = (c.actions[0] && c.actions[0].gif) ? c.actions[0].gif : '';
      var cbg = 'background:linear-gradient(135deg,' + (c.color || '#1FD6A8') + ',#0d8f6f)';
      return '<div class="cs-card" style="' + cbg + '" data-a="openCourse" data-id="' + c.id + '">' +
        (cover ? mediaTag(cover, c.icon) + '<div class="cs-veil"></div>' : '<div class="img-fb">' + c.icon + '</div>') +
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
      '<div class="h-sec">为你精选<span class="more">点卡片看动作清单</span></div>' + strip + lastCard + breathCard;
  }

  /* ============ 训练库 ============ */
  function musclesOf(a) {
    var lib = NS.ACT_LIB[a.name];
    if (lib) return lib.g === 'push' ? '胸·肩' : lib.g === 'legs' ? '臀·腿' : lib.g === 'pull' ? '背·臂' : lib.g === 'core' ? '核心' : lib.g === 'stretch' ? '拉伸' : '全身';
    var t = '';
    courses.forEach(function (c) { c.actions.forEach(function (x) { if (x.name === a.name && c.muscle) t = c.muscle; }); });
    return t || '全身';
  }
  var EQUIPS = ['全部', '徒手', '哑铃', '弹力带', '壶铃'];
  function equipOk(a) { return S.equipFilter === '全部' || (a.equip || '徒手') === S.equipFilter; }
  function equipChips() {
    return '<div class="chips eq-chips">' + EQUIPS.map(function (e) {
      return '<span class="chip ' + (S.equipFilter === e ? 'on' : '') + '" data-a="equipF" data-v="' + e + '">' + (e === '全部' ? '全部器材' : e) + '</span>';
    }).join('') + '</div>';
  }
  function vTrain() {
    var seg = '<div class="seg"><div class="sg ' + (S.seg === 'course' ? 'on' : '') + '" data-a="seg" data-v="course">课程</div><div class="sg ' + (S.seg === 'acts' ? 'on' : '') + '" data-a="seg" data-v="acts">动作库</div><div class="sg ' + (S.seg === 'custom' ? 'on' : '') + '" data-a="seg" data-v="custom">自定义</div><div class="sg ' + (S.seg === 'hiit' ? 'on' : '') + '" data-a="seg" data-v="hiit">HIIT</div></div>';
    if (S.seg === 'hiit') return seg + equipChips() + '<div style="height:6px"></div>' + vHiit();
    if (S.seg === 'course') {
      return seg + '<div class="course-grid">' + courses.map(function (c) {
        return '<div class="course-card" data-a="openCourse" data-id="' + c.id + '"><div class="cc-ic" style="background:' + esc(c.color || '#1FD6A8') + '22">' + c.icon + '</div>' +
          '<div class="cc-n">' + esc(c.name) + '</div><div class="cc-m">' + c.level + ' · ' + c.duration + ' 分钟 · ' + c.actions.length + ' 动作</div>' +
          '<div class="cc-btn btn">开始 ▸</div></div>';
      }).join('') + '</div>';
    }
    if (S.seg === 'custom') return seg + equipChips() + '<div style="height:6px"></div>' + vBuilder();
    var seen = {}, list = [];
    courses.forEach(function (c) { c.actions.forEach(function (a) { if (!seen[a.name]) { seen[a.name] = 1; list.push(a); } }); });
    var mus = ['全部', '胸·肩', '臀·腿', '背·臂', '核心', '拉伸', '全身'];
    var chips = mus.map(function (m) { return '<span class="chip ' + (S.actMus === m ? 'on' : '') + '" data-a="mus" data-v="' + m + '">' + m + '</span>'; }).join('');
    var filtered = list.filter(function (a) { return equipOk(a) && (S.actMus === '全部' || (musclesOf(a) || '').indexOf(S.actMus) >= 0); });
    var rows = filtered.map(function (a) {
      return '<div class="act-row" data-a="actInfo" data-name="' + esc(a.name) + '"><div class="a-ic">' + a.icon + '</div>' +
        '<div><div class="a-n">' + esc(a.name) + '</div><div class="a-s">' + (a.type === 'reps' ? a.value + ' 次' : a.value + ' 秒') + ' · ' + esc(musclesOf(a)) + ' · ' + esc(a.equip || '徒手') + '</div></div>' +
        (a.gif ? '<div class="a-g">' + mediaTag(a.gif, a.icon) + '</div>' : '') + '<div class="a-go">›</div></div>';
    }).join('');
    return seg + equipChips() + '<div style="height:6px"></div>' + '<div class="chips">' + chips + '</div><div style="height:10px"></div>' + (rows || '<div class="empty"><div class="e-ic">🤸</div>该筛选条件下暂无动作</div>');
  }

  /* ============ 自定义训练 builder ============ */
  var BLD_GROUPS = [['胸·肩', 'push'], ['背·臂', 'pull'], ['臀·腿', 'legs'], ['核心', 'core'], ['燃脂', 'cardio'], ['拉伸', 'stretch']];
  function vBuilder() {
    var seen = {}, all = [];
    courses.forEach(function (c) { c.actions.forEach(function (a) { if (!seen[a.name]) { seen[a.name] = 1; all.push(a); } }); });
    var html = '<div class="bld-hint">勾选动作，自由组合成你的专属训练</div>';
    BLD_GROUPS.forEach(function (g) {
      var items = all.filter(function (a) { var lib = NS.ACT_LIB[a.name]; return lib && lib.g === g[1] && equipOk(a); });
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
    startW(seq, '自定义训练 · ' + names.length + ' 动作', '🎯', 0, '#7C5CFF', 'fit_custom_' + Date.now(), Math.max(3, S.restSec + cfg.restAdd), buildWarmSeq(warmKindFromBuilder(S.builder.sel)));
  }

  /* ============ HIIT/Tabata 计时模式（#22）：模板 + 动作循环，全部转计时复用跟练引擎 ============ */
  var HIT_TPL = {
    tabata: { n: 'Tabata', desc: '经典 8 轮 · 动 20s / 休 10s · 共 4 分钟', work: 20, rest: 10, rounds: 8 },
    hiit30: { n: 'HIIT 30/15', desc: '10 轮 · 动 30s / 休 15s · 共 7.5 分钟', work: 30, rest: 15, rounds: 10 },
    emom:   { n: 'EMOM', desc: '每分钟完成该动作，共 10 轮', work: 60, rest: 1, rounds: 10 },
    amrap:  { n: 'AMRAP', desc: '12 分钟 · 尽可能多循环', work: 45, rest: 15, rounds: 9 }
  };
  function vHiit() {
    var t = HIT_TPL[S.hiit.tpl];
    var chips = Object.keys(HIT_TPL).map(function (k) {
      return '<span class="chip ' + (S.hiit.tpl === k ? 'on' : '') + '" data-a="hitTpl" data-v="' + k + '">' + HIT_TPL[k].n + '</span>';
    }).join('');
    var nSel = Object.keys(S.hiit.sel).length;
    var groups = [['胸·肩', 'push'], ['背·臂', 'pull'], ['臀·腿', 'legs'], ['核心', 'core'], ['燃脂', 'cardio']];
    var list = '';
    groups.forEach(function (g) {
      var seen = {}, items = [];
      courses.forEach(function (c) { c.actions.forEach(function (a) {
        var lib = NS.ACT_LIB[a.name];
        if (!seen[a.name] && lib && lib.g === g[1] && equipOk(a)) { seen[a.name] = 1; items.push(a); }
      }); });
      if (!items.length) return;
      list += '<div class="bld-g">' + g[0] + '</div>' + items.slice(0, 8).map(function (a) {
        var on = S.hiit.sel[a.name] ? ' on' : '';
        return '<div class="bld-it' + on + '" data-a="hitToggle" data-name="' + esc(a.name) + '"><div class="b-ic">' + a.icon + '</div>' +
          '<div class="b-n">' + esc(a.name) + '</div><div class="b-go">' + (on ? '✓' : '＋') + '</div></div>';
      }).join('');
    });
    return '<div class="bld-hint">⚡ 间歇训练：选 1-4 个动作，按模板节奏动休交替</div>' +
      '<div class="chips">' + chips + '</div>' +
      '<div class="card" style="margin:8px 0;font-size:12px;color:#4a525c;padding:10px 12px;background:#fff4ec">⏱ ' + esc(t.desc) + '</div>' + list +
      '<div class="bld-foot"><div class="bld-ct">已选 <b>' + nSel + '</b> / 4 项</div>' +
      '<div class="btn' + (nSel ? '' : ' ghost') + '" data-a="hitStart">开练 ▸</div></div>';
  }
  function hiitStart() {
    var t = HIT_TPL[S.hiit.tpl], names = Object.keys(S.hiit.sel);
    if (!names.length) { toast('先勾选 1-4 个动作'); return; }
    if (names.length > 4) { toast('最多选 4 个动作'); return; }
    var seq = [];
    for (var r = 0; r < t.rounds; r++) names.forEach(function (nm) {
      var a = NS.actionByName[nm]; if (!a) return;
      seq.push({ name: nm, icon: a.icon || '⚡', type: 'time', value: t.work, cue: a.cue || '' });
    });
    var kcal = Math.round(t.rounds * (t.work / 60) * 9 * (names.length / 2 + 0.5));
    startW(seq, t.n + ' · ' + names.length + ' 动作 × ' + t.rounds + ' 轮', '⚡', kcal, '#FF6B4A', 'fit_hiit_' + S.hiit.tpl + '_' + Date.now(), t.rest, []);
  }

  /* ============ 呼吸放松（#24）：4-7-8 / 盒式 / 6-1-6，纯计时序列复用跟练引擎 ============ */
  var BREATH = {
    '478': { n: '4-7-8 助眠', seq: [[4, '用鼻吸气'], [7, '屏住呼吸'], [8, '用嘴缓呼']], round: 5 },
    box:   { n: '盒式专注', seq: [[4, '用鼻吸气'], [4, '屏住呼吸'], [4, '用嘴呼气'], [4, '保持空杯']], round: 6 },
    '618': { n: '6-1-6 平复', seq: [[6, '深吸气'], [1, '轻停'], [6, '慢呼气']], round: 8 }
  };
  function startBreath(k) {
    var b = BREATH[k]; if (!b) return;
    var seq = [];
    for (var r = 0; r < b.round; r++) b.seq.forEach(function (s) {
      seq.push({ name: s[1], icon: '🌬', type: 'time', value: s[0], cue: '跟随节奏，不要刻意用力' });
    });
    startW(seq, b.n + ' · ' + b.round + ' 轮', '🌬', 5, '#7C5CFF', 'fit_breath_' + k + '_' + Date.now(), 1, []);
  }

  /* ============ 体重记录（#20）：每日 10 秒，趋势 sparkline + 7 日变化 ============ */
  function weightCard() {
    var w = S.weights, days = Object.keys(w).sort();
    var latest = days.length ? w[days[days.length - 1]] : null;
    var pts = days.slice(-14).map(function (k) { return w[k]; });
    var d7 = '';
    if (days.length >= 2) {
      var a = w[days[Math.max(0, days.length - 8)]], bb = w[days[days.length - 1]], diff = Math.round((bb - a) * 10) / 10;
      if (days.length >= 8) d7 = '<span style="margin-left:10px;color:' + (diff <= 0 ? '#0fb98c' : '#e08a00') + '">7 日 ' + (diff > 0 ? '+' : '') + diff + ' kg</span>';
    }
    var spark = '';
    if (pts.length >= 2) {
      var mn = Math.min.apply(null, pts) - 0.5, mx = Math.max.apply(null, pts) + 0.5;
      var W = 300, H = 54;
      var poly = pts.map(function (v, i) {
        return Math.round(i / (pts.length - 1) * (W - 8) + 4) + ',' + Math.round(H - 6 - (v - mn) / (mx - mn) * (H - 14));
      }).join(' ');
      spark = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:' + H + 'px;margin-top:6px">' +
        '<polyline points="' + poly + '" fill="none" stroke="#1FD6A8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
    }
    return '<div class="card"><div class="form-t" style="margin:0 0 8px">⚖️ 体重记录</div>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      (latest != null ? '<div><span style="font-size:26px;font-weight:800;color:var(--ink)">' + latest + '</span><span style="font-size:11px;color:#7a838e"> kg · 最新</span></div>' + d7 : '<div style="font-size:12px;color:#7a838e">记录第一笔体重，开始追踪趋势</div>') +
      '</div>' + spark +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<input type="number" step="0.1" id="wgtIn" class="fld" style="flex:1" placeholder="今日体重 kg">' +
      '<div class="btn" style="padding:9px 18px" data-a="weightSave">记录</div></div></div>';
  }

  /* ============ 成就徽章（#21）：数据全来自 records/best/streak/dietLog，纯展示层 ============ */
  function badgeDefs() {
    var totalMin = S.records.reduce(function (a, r) { return a + (r.min || 0); }, 0);
    var uniq = {};
    S.records.forEach(function (r) { (r.detail || []).forEach(function (x) { uniq[x.name] = 1; }); });
    var nPR = Object.keys(S.best).filter(function (n) { return S.best[n].best > 0; }).length;
    var dietDays = Object.keys(S.dietLog).filter(function (k) { var d = S.dietLog[k]; return d && (d.bf || d.lunch || d.dinner || d.snack); }).length;
    var stk = streak() || 0;
    return [
      { id: 'first',  ic: '🥇', n: '第一练',     d: '完成首次训练',       ok: S.records.length >= 1,  p: S.records.length / 1 },
      { id: 'rec10',  ic: '🎯', n: '小有所成',   d: '累计 10 次训练',     ok: S.records.length >= 10, p: S.records.length / 10 },
      { id: 'rec50',  ic: '🏆', n: '训练成瘾',   d: '累计 50 次训练',     ok: S.records.length >= 50, p: S.records.length / 50 },
      { id: 'st3',    ic: '🔥', n: '三连击',     d: '连续打卡 3 天',       ok: stk >= 3,  p: stk / 3 },
      { id: 'st7',    ic: '⚡', n: '一周不断',   d: '连续打卡 7 天',       ok: stk >= 7,  p: stk / 7 },
      { id: 'st30',   ic: '🌟', n: '月度habit',  d: '连续打卡 30 天',      ok: stk >= 30, p: stk / 30 },
      { id: 'pr1',    ic: '💪', n: '首个 PR',    d: '拿下第一个个人最佳',  ok: nPR >= 1,  p: nPR / 1 },
      { id: 'pr10',   ic: '🚀', n: 'PR 收集家',  d: '10 个动作有 PR',      ok: nPR >= 10, p: nPR / 10 },
      { id: 'min100', ic: '⏱', n: '一小时',     d: '累计训练 100 分钟',   ok: totalMin >= 100, p: totalMin / 100 },
      { id: 'min600', ic: '⌛', n: '十小时',     d: '累计训练 600 分钟',   ok: totalMin >= 600, p: totalMin / 600 },
      { id: 'act100', ic: '📚', n: '百动解锁',   d: '练过 100 个不同动作', ok: Object.keys(uniq).length >= 100, p: Object.keys(uniq).length / 100 },
      { id: 'diet7',  ic: '🥗', n: '吃练闭环',   d: '饮食打卡 7 天',       ok: dietDays >= 7, p: dietDays / 7 }
    ];
  }
  function checkNewBadges() {
    var defs = badgeDefs(), fresh = [];
    defs.forEach(function (b) { if (b.ok && !S.badges[b.id]) { S.badges[b.id] = 1; fresh.push(b); } });
    if (fresh.length) { saveK('fit_badges', S.badges); toast('🏆 解锁成就：' + fresh[0].n + (fresh.length > 1 ? ' 等 ' + fresh.length + ' 项' : '')); }
  }
  function badgeWall() {
    var items = badgeDefs().map(function (b) {
      return '<div class="bdg' + (b.ok ? ' on' : '') + '"><div class="bdg-ic">' + b.ic + '</div><div class="bdg-n">' + esc(b.n) + '</div><div class="bdg-d">' + esc(b.d) + '</div>' +
        (b.ok ? '<div class="bdg-done">✓ 已达成</div>' : '<div class="bdg-bar"><i style="width:' + Math.min(100, Math.round(b.p * 100)) + '%"></i></div>') + '</div>';
    }).join('');
    return '<div class="h-sec">🏅 成就墙</div><div class="bdg-grid">' + items + '</div>';
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
      '<div class="diff-seg" style="margin:16px 0 8px"><span class="dl">🔄 恢复感知</span>' +
      '<div class="o' + (S.recoveryOn ? '' : ' on') + '" data-a="setRecovery" data-v="0">关</div>' +
      '<div class="o' + (S.recoveryOn ? ' on' : '') + '" data-a="setRecovery" data-v="1">开 · 避开 48h 内同肌群</div></div>' +
      '<div class="gen-btn btn" data-a="genPlan">✨ 生成我的 4 周计划</div>' +
      '<div style="text-align:center;font-size:11px;color:#a0a6ad;margin:14px 6px;line-height:1.7">引擎与微信小程序完全一致：按目标 / 水平 / 时长从动作库动态编排每个训练日（主项×组数 + 热身 + 收尾 + 冷身），读取你的成绩历史逐动作定制目标。开启"恢复感知"后，会根据你最近的训练记录自动把 48h 内刚练过的肌群当天改为恢复日。</div>';
  }
  function histForPlan() {
    var h = {};
    Object.keys(S.best).forEach(function (n) {
      var b = S.best[n], hist = b.hist || [];
      var recent = hist.slice(-3);
      var avg = recent.length ? Math.round(recent.reduce(function (a, x) { return a + x; }, 0) / recent.length) : 0;
      h[n] = { best: b.best, count: hist.length, last: b.last, recent: avg };
    });
    return h;
  }
  function vPlanResult() {
    var p = S.plan, w = p.weeks[S.weekIdx];
    var tabs = p.weeks.map(function (x, i) {
      return '<div class="pt ' + (S.weekIdx === i ? 'on' : '') + '" data-a="week" data-i="' + i + '"><div class="pt-i">第' + (i + 1) + '周</div><div class="pt-l">' + x.label + '</div></div>';
    }).join('');
    var days = w.week.map(function (d, i) {
      if (d.rest) return '<div class="day-card rest"><span class="rest-em">💤</span><div class="dc-rest">' + d.wd + ' · 休息日，让身体恢复</div></div>';
      var grp = groupOfType(d.type);
      var warn = !d.recovered && trainedRecently(grp);
      var acts = d.acts.slice(0, 5).map(function (a) {
        return '<div class="dc-act">' + (a.fin ? '🧯 收尾 · ' : a.cool ? '🧘 冷身 · ' : '') + esc(a.name) + (a.round > 1 ? ' <b>×' + a.round + '</b>' : '') + ' · ' + a.target + a.unit + '</div>';
      }).join('');
      var warnHtml = warn ? '<div class="rec-warn">🔴 该肌群 48h 内刚练过 · <span class="rec-fix" data-a="dayRecover" data-w="' + S.weekIdx + '" data-i="' + i + '">转恢复日</span></div>' : '';
      return '<div class="day-card' + (warn ? ' warn' : '') + '" data-a="openDay" data-w="' + S.weekIdx + '" data-i="' + i + '">' +
        '<div class="dc-h"><span class="dc-wd">' + d.wd + '</span><span class="dc-t">' + d.icon + ' ' + esc(d.typeName) + '</span></div>' +
        '<div class="dc-m">' + esc(d.muscle) + ' · 约 ' + d.duration + ' 分钟' + (d.custom ? ' · 🧠 ' + d.custom : '') + (d.recovered ? ' · 🌿已转恢复' : '') + '</div>' + warnHtml + acts +
        '<div class="dc-foot"><span class="dc-tag">' + (d.nActs || d.acts.length) + ' 个动作</span>' +
        '<span class="dc-run btn" data-a="runDay" data-w="' + S.weekIdx + '" data-i="' + i + '">开练 ▸</span></div></div>';
    }).join('');
    return '<div class="phase-tabs">' + tabs + '</div>' +
      '<div class="phase-tip">📌 ' + esc(p.weeks[S.weekIdx].tip) + '</div>' +
      (p.cycle && p.cycle > 1 ? '<div class="phase-tip" style="background:#eef0ff">🚀 第 ' + p.cycle + ' 进阶周期 · 目标已按你的个人最佳自动上调</div>' : '') +
      (p.customTotal ? '<div class="phase-tip" style="background:#e8f7f2">🧠 本计划 ' + p.customTotal + ' 个动作目标已按你的成绩历史自动定制</div>' : '') +
      (p.edited ? '<div class="phase-tip" style="background:#fff4ec;color:#c4691f">✏️ 你已手动调整本计划（替换动作 / 组数），重新定制将还原改动</div>' : '') +
      '<div class="sum-chips"><div class="sc"><div class="n">' + w.days + '</div><div class="l">训练天</div></div>' +
      '<div class="sc"><div class="n">' + w.totalMin + '</div><div class="l">分钟/周</div></div>' +
      '<div class="sc"><div class="n">' + w.totalKcal + '</div><div class="l">千卡/周</div></div></div>' +
      '<div class="card" style="font-size:12px;color:#4a525c;line-height:1.7">💬 ' + esc(p.levelNote) + '<br>🔁 ' + esc(p.weeksNote) + '</div>' + days +
      (S.weekIdx === p.weeks.length - 1 ? '<div class="gen-btn btn" data-a="nextCycle">🚀 4 周完成 · 生成下一进阶周期</div>' : '') +
      '<div class="gen-btn btn" data-a="sharePlan">📤 复制周计划 · 分享</div>' +
      '<div class="gen-btn btn ghost" data-a="replan">↻ 重新定制</div>';
  }

  /* ============ 恢复感知调度（#14） ============ */
  function groupOfType(type) { return ({ push: 'push', pull: 'pull', legs: 'legs', core: 'core', fat: 'cardio', recover: 'stretch' })[type] || 'cardio'; }
  function recordGroups(r) {
    var s = {};
    (r.detail || []).forEach(function (x) { var lib = NS.ACT_LIB[x.name]; if (lib) s[lib.g] = 1; });
    return s;
  }
  function trainedRecently(group) {
    var cutoff = Date.now() - 2 * 86400000; // 48h
    for (var i = 0; i < S.records.length; i++) {
      var r = S.records[i];
      if (new Date(r.date + 'T00:00:00').getTime() < cutoff) continue;
      if (recordGroups(r)[group]) return true;
    }
    return false;
  }
  function makeRecoverDay(wd, length) {
    return {
      wd: wd, rest: false, type: 'recover', typeName: '舒缓恢复日', icon: '🌿', muscle: '全身·深度放松',
      duration: Math.max(10, Math.round((length || 30) * 0.5)), kcal: 30, nActs: 0, nUnique: 0, warm: '',
      coach: '该肌群 48h 内刚练过，今天改为舒缓拉伸帮助恢复，避免连续刺激同一肌群。', custom: 0, acts: [], seq: [], recovered: true
    };
  }
  function applyRecovery(plan) {
    if (!plan || !plan.weeks) return;
    plan.weeks.forEach(function (wk, wIdx) {
      wk.week.forEach(function (d, i) {
        if (d.rest || d.recovered) return;
        if (trainedRecently(groupOfType(d.type))) plan.weeks[wIdx].week[i] = makeRecoverDay(d.wd, plan.length);
      });
    });
    plan.edited = true;
  }

  /* ============ 肌群覆盖 / 训练量 / 计划可编辑 ============ */
  var GRP_AXES = [['push', '胸肩'], ['pull', '背臂'], ['legs', '臀腿'], ['core', '核心'], ['cardio', '燃脂'], ['stretch', '拉伸']];
  function groupCoverage() {
    var res = {};
    GRP_AXES.forEach(function (g) {
      var done = 0, total = 0;
      Object.keys(NS.ACT_LIB).forEach(function (n) {
        if (NS.ACT_LIB[n].g === g[0]) { total++; if (S.best[n] && S.best[n].best > 0) done++; }
      });
      res[g[0]] = { label: g[1], done: done, total: total, pct: total ? Math.round(done / total * 100) : 0 };
    });
    return res;
  }
  function radarSvg(vals, labels) {
    var cx = 120, cy = 112, R = 82, n = 6;
    function pt(i, r) { var a = (-90 + i * 60) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
    var rings = '', i, p;
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      var ps = []; for (i = 0; i < n; i++) { p = pt(i, R * f); ps.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
      rings += '<polygon points="' + ps.join(' ') + '" fill="none" stroke="#e6e9ee" stroke-width="1"/>';
    });
    var axes = '';
    for (i = 0; i < n; i++) { p = pt(i, R); axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#e6e9ee" stroke-width="1"/>'; }
    var vp = []; for (i = 0; i < n; i++) { p = pt(i, R * Math.max(0, Math.min(100, vals[i])) / 100); vp.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
    var poly = '<polygon points="' + vp.join(' ') + '" fill="rgba(31,214,168,.28)" stroke="#0fb98c" stroke-width="2"/>';
    var dots = '', labs = '';
    for (i = 0; i < n; i++) {
      p = pt(i, R * Math.max(0, Math.min(100, vals[i])) / 100);
      dots += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#0fb98c"/>';
      var lp = pt(i, R + 20);
      labs += '<text x="' + lp[0].toFixed(1) + '" y="' + lp[1].toFixed(1) + '" font-size="9.5" fill="#7a838e" text-anchor="middle" dominant-baseline="middle">' + labels[i] + '</text>';
    }
    return '<svg viewBox="0 0 240 224" width="100%" style="display:block">' + rings + axes + poly + dots + labs + '</svg>';
  }
  function weakHtml(cov) {
    var total = 0, weak = [];
    GRP_AXES.forEach(function (g) { total += cov[g[0]].done; if (cov[g[0]].done === 0) weak.push(g[1]); });
    if (total === 0) return '<div class="weak-tip">开始第一次训练后，这里会显示你的六大肌群覆盖雷达图</div>';
    if (!weak.length) return '<div class="weak-ok">✅ 六大肌群都已练过，保持推拉蹲均衡</div>';
    return '<div class="weak-tip">⚠ 还没练过：' + weak.join('、') + '，下次计划可优先加入</div>';
  }
  function volumeStats() {
    var total = 0, week = 0, bestSession = 0;
    var cutoff = Date.now() - 7 * 86400000;
    S.records.forEach(function (r) {
      var reps = 0;
      (r.detail || []).forEach(function (x) { if (x.type === 'reps' && x.actual > 0) reps += x.actual; });
      total += reps;
      if (new Date(r.date + 'T00:00:00').getTime() >= cutoff) week += reps;
      if (reps > bestSession) bestSession = reps;
    });
    return { totalReps: total, weekReps: week, bestSession: bestSession };
  }
  function altActs(name) {
    var lib = NS.ACT_LIB[name]; if (!lib) return [];
    var g = lib.g;
    if (['push', 'pull', 'legs', 'core', 'cardio'].indexOf(g) < 0) return [];
    return Object.keys(NS.ACT_LIB).filter(function (n) { return n !== name && NS.ACT_LIB[n].g === g; })
      .sort(function (a, b) { return NS.ACT_LIB[a].d - NS.ACT_LIB[b].d; });
  }
  function seqItemLocal(a) {
    var t = NS.actionByName[a.name] || {};
    return { name: a.name, icon: a.icon || t.icon || '🏋️', type: a.type || t.type || 'reps', value: a.target,
      phase: a.fin ? 'fin' : a.cool ? 'cool' : 'main', cue: a.cue || t.cue || '', anim: t.anim || 'dynamic', gif: t.gif || '', media: t.media || null };
  }
  function rebuildSeq(day) {
    var seq = [];
    day.acts.forEach(function (a) {
      if (a.fin || a.cool) seq.push(seqItemLocal(a));
      else for (var r = 0; r < (a.round || 1); r++) seq.push(seqItemLocal(a));
    });
    day.seq = seq; day.nActs = seq.length;
  }
  function sheetEditDay(wIdx, i) {
    var d = S.plan.weeks[wIdx].week[i];
    if (!d || d.rest) return;
    var mains = d.acts.filter(function (a) { return !a.fin && !a.cool; });
    var rows = mains.map(function (a) {
      var alts = altActs(a.name);
      return '<div class="ed-row"><div class="ed-n">' + esc(a.name) + ' <span class="ed-r">×' + a.round + ' 组</span></div>' +
        (alts.length ? '<div class="ed-swap" data-a="swapAct" data-w="' + wIdx + '" data-i="' + i + '" data-name="' + esc(a.name) + '">替换 ↺</div>' : '') + '</div>';
    }).join('');
    openSheet('<div class="sh-h"><div class="sh-t">✏️ 编辑 · ' + d.wd + ' ' + esc(d.typeName) + '</div><div class="x" data-a="xSheet">✕</div></div>' +
      '<div class="sh-sub">替换主项或调整组数，改动仅保存在本计划（重新定制会还原）</div>' + rows +
      '<div class="ed-sets"><span>本日组数</span><div class="ed-step">' +
      '<span class="o" data-a="daySets" data-w="' + wIdx + '" data-i="' + i + '" data-v="-1">−</span>' +
      '<b id="edSets">' + (mains[0] ? mains[0].round : 1) + '</b>' +
      '<span class="o" data-a="daySets" data-w="' + wIdx + '" data-i="' + i + '" data-v="1">＋</span></div></div>' +
      '<div class="sh-go btn" data-a="xSheet">完成</div>');
  }
  function sheetSwap(wIdx, i, name) {
    var alts = altActs(name);
    var cards = alts.map(function (n) {
      var a = NS.actionByName[n], lib = NS.ACT_LIB[n];
      return '<div class="swap-it" data-a="doSwap" data-w="' + wIdx + '" data-i="' + i + '" data-from="' + esc(name) + '" data-to="' + esc(n) + '">' +
        '<div class="s-ic">' + (a ? a.icon : '🏋️') + '</div><div><div class="s-n">' + esc(n) + '</div><div class="s-d">' + '★'.repeat(lib.d) + '☆'.repeat(3 - lib.d) + '</div></div></div>';
    }).join('');
    openSheet('<div class="sh-h"><div class="sh-t">替换 · ' + esc(name) + '</div><div class="x" data-a="xSheet">✕</div></div>' +
      '<div class="sh-sub">选择同肌群动作替换（难度 ' + '★'.repeat(NS.ACT_LIB[name].d) + '☆'.repeat(3 - NS.ACT_LIB[name].d) + '）</div>' +
      '<div class="swap-grid">' + cards + '</div>');
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
    var cov = groupCoverage();
    var radarHtml = '<div class="card radar-card"><div class="form-t" style="margin:0 0 4px">🎯 肌群覆盖度</div>' +
      radarSvg([cov.push.pct, cov.pull.pct, cov.legs.pct, cov.core.pct, cov.cardio.pct, cov.stretch.pct], ['胸肩', '背臂', '臀腿', '核心', '燃脂', '拉伸']) +
      weakHtml(cov) + '</div>';
    var vol = volumeStats();
    var volHtml = '<div class="card"><div class="form-t" style="margin:0 0 8px">📦 训练量总览</div>' +
      '<div class="vol-row"><div class="vol-b"><div class="n">' + vol.totalReps + '</div><div class="l">累计次数</div></div>' +
      '<div class="vol-b"><div class="n">' + vol.weekReps + '</div><div class="l">近7天次数</div></div>' +
      '<div class="vol-b"><div class="n">' + vol.bestSession + '</div><div class="l">单日最高动作</div></div></div>' +
      '<div style="font-size:10.5px;color:#a0a6ad;margin-top:8px">个人最佳(PR)见下方"动作最佳纪录"</div></div>';
    var backup = '<div class="card backup-card"><div class="zh-st-h" style="margin-bottom:6px">💾 训练档案备份</div>' +
      '<div style="font-size:11.5px;color:#7a838e;line-height:1.6;margin-bottom:8px">一键导出全部动作纪录 / 训练历史 / 计划 / 饮食方案到 JSON，换设备或清缓存前先备份，避免数据丢失。</div>' +
      '<div class="bk-btns"><div class="btn" data-a="exportData">⬇ 导出备份</div><div class="btn ghost" data-a="importData">⬆ 导入备份</div></div>' +
      '<input type="file" id="impFile" accept="application/json" style="display:none"></div>';
    return trendHtml() + prTrendHtml() + weightCard() + radarHtml + volHtml + backup +
      '<div class="stats-row"><div class="stat"><div class="n">' + S.records.length + '</div><div class="l">累计训练</div></div>' +
      '<div class="stat"><div class="n">' + totalMin + '</div><div class="l">总分钟</div></div>' +
      '<div class="stat"><div class="n">' + names.length + '</div><div class="l">动作有纪录</div></div></div>' +
      badgeWall() +
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
  function variantChips(name) {
    var lib = NS.ACT_LIB[name]; if (!lib) return '';
    var chips = '';
    if (lib.reg && NS.actionByName[lib.reg]) chips += '<span class="vk reg" data-a="actVariant" data-name="' + esc(lib.reg) + '">↩ 退阶：' + esc(lib.reg) + '</span>';
    if (lib.adv && NS.actionByName[lib.adv]) chips += '<span class="vk adv" data-a="actVariant" data-name="' + esc(lib.adv) + '">进阶：' + esc(lib.adv) + ' ↪</span>';
    return chips ? '<div class="var-chips">变式链：' + chips + '</div>' : '';
  }
  /* 渐进超负荷建议（#16）：按个人最佳给"本次冲击目标"——次数 +5%（至少+1），计时 +5 秒 */
  function overloadHint(name, type) {
    var rec = S.best[name];
    if (!rec || !rec.best) return '';
    var unit = type === 'reps' ? ' 次' : ' 秒';
    var nxt = type === 'reps' ? Math.max(rec.best + 1, Math.ceil(rec.best * 1.05)) : rec.best + 5;
    return '<div class="pr-hint">🏅 个人最佳 <b>' + rec.best + unit + '</b>' + (rec.lastDate ? '（' + esc(rec.lastDate) + '）' : '') +
      ' · 渐进超负荷：本次建议冲 <b>' + nxt + unit + '</b>' + '</div>';
  }
  function sheetAct(name) {
    var act = null;
    courses.forEach(function (c) { c.actions.forEach(function (a) { if (a.name === name && !act) act = a; }); });
    var lib = NS.ACT_LIB[name];
    var sub = act ? (act.type === 'reps' ? (lib && lib.d ? '难度 ' + '★'.repeat(lib.d) + '☆☆'.slice(0, 3 - lib.d) + ' · ' : '') + '单轮 ' + act.value + ' 次' : act.value + ' 秒 · 保持稳定节奏') : '';
    var zhSteps = act && act.zhSteps;
    var stepsHtml = zhSteps && zhSteps.length ? '<div class="zh-steps"><div class="zh-st-h">分步要领（真人示范要点）</div>' +
      zhSteps.map(function (s, i) { return '<div class="zh-st"><span>' + (i + 1) + '</span>' + esc(s) + '</div>'; }).join('') + '</div>' : '';
    openSheet('<div class="sh-h"><div class="sh-t">' + (act ? act.icon : '🏋️') + ' ' + esc(name) + '</div><div class="x" data-a="xSheet">✕</div></div>' +
      '<div class="sh-sub">' + sub + ' · ' + esc(musclesOf({ name: name })) + ' · ' + esc(act && act.equip ? act.equip : '徒手') + '</div>' +
      (act && act.gif ? '<div class="demo">' + mediaTag(act.gif, act.icon) + '</div>' : '') +
      overloadHint(name, act && act.type) +
      '<div class="cue-box">💡 ' + esc((act && act.cue) || '保持核心收紧，动作标准优先于数量') + '</div>' +
      stepsHtml +
      variantChips(name));
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
      '<div class="sh-go btn ghost" data-a="editDay" data-w="' + wIdx + '" data-i="' + i + '">✏️ 编辑本日安排</div>' +
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

  /* ============ 热身序列（开练前的独立引导屏，按训练类型自适应） ============ */
  // 取动作库里带真人 GIF 的动感/激活类动作，保证一致观感
  // kind: cardio(燃脂) | strength(力量) | core(核心) | stretch(拉伸)
  var WARM_SETS = {
    cardio: [['开合跳', 30], ['高抬腿', 30], ['深蹲跳', 15], ['登山者', 30], ['弓步跳', 16], ['肩胸拉伸', 25]],
    strength: [['肩胸拉伸', 30], ['深蹲', 15], ['弓步蹲', 16], ['站姿提踵', 20], ['标准俯卧撑', 12], ['开合跳', 20]],
    core: [['肩胸拉伸', 30], ['臀桥', 15], ['登山者', 30], ['站姿提踵', 20], ['卷腹', 15]],
    stretch: [['肩胸拉伸', 35], ['臀桥', 15], ['站姿提踵', 20], ['深蹲', 12], ['开合跳', 20]]
  };
  function buildWarmSeq(kind) {
    var set = WARM_SETS[kind] || WARM_SETS.strength;
    return set.map(function (p) {
      var src = NS.actionByName[p[0]]; if (!src) return null;
      return { name: src.name, icon: src.icon || '🏋️', type: src.type, value: p[1], phase: 'warm',
        cue: src.cue || '', anim: src.anim || 'dynamic', gif: src.gif || '', media: src.media || null };
    }).filter(Boolean);
  }
  function warmKindFromCourse(cat) {
    if (cat === '减脂') return 'cardio';
    if (cat === '核心') return 'core';
    if (cat === '拉伸') return 'stretch';
    return 'strength';
  }
  function warmKindFromDayType(type) {
    if (type === 'fat') return 'cardio';
    if (type === 'core') return 'core';
    return 'strength'; // push / legs / 其他
  }
  function warmKindFromBuilder(sel) {
    if (sel['燃脂']) return 'cardio';
    if (sel['核心']) return 'core';
    if (sel['拉伸']) return 'stretch';
    return 'strength'; // 胸·肩 / 臀·腿 / 混合
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
  function leaveAct() {   // 结束当前动作 → 休息（W.i 停在刚完成的动作上，不前进）
    var a = curA();
    W.detail.push({ name: a.name, icon: a.icon, type: a.type, target: a.value, actual: W.actual, phase: a.phase });
    // 热身 → 正式训练 交界处：刚完成最后一个热身动作时，插入独立过渡屏，用户确认后再进入主项
    if (W.i === W.firstMain - 1 && !W.warmAck && W.firstMain < W.seq.length) { W.phase = 'warmDone'; renderW(); speak('热身完成，开始正式训练'); return; }
    W.phase = 'rest'; W.rem = Math.max(2, W.rest);
    var nx = W.seq[W.i + 1];
    speak('休息 ' + W.rem + ' 秒');
    if (nx) setTimeout(function () { if (W && W.phase === 'rest') speak('下一个，' + nx.name); }, 700);
    renderW();
  }
  function goNext() {     // 休息结束 → 下一动作（W.i 前进 1）
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
    if (W.phase === 'ready') return 0;
    if (W.phase === 'warmDone') return 8; // 热身处境固定 8%
    var total = W.seq.length;
    if (W.i < W.firstMain) {
      var wdone = W.i + (W.phase === 'rest' ? 1 : 0);
      return Math.max(1, Math.round(wdone / W.firstMain * 8));
    }
    var mainI = W.i - W.firstMain, mainLen = total - W.firstMain;
    var frac = mainLen > 0 ? (mainI + (W.phase === 'rest' ? 1 : 0)) / mainLen : 1;
    return Math.min(100, Math.round(8 + frac * 92));
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
      var warmNames = W.seq.slice(0, W.firstMain).map(function (a) { return a.name; });
      var warmChips = warmNames.map(function (n) { return '<span class="wk-wc">' + esc(n) + '</span>'; }).join('');
      body = top + '<div class="wk-done" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 18px">' +
        '<div class="d-ic">🔥</div><div class="d-t">热身完成</div>' +
        '<div class="d-p">身体已经热开了<br>准备好进入正式训练了吗？</div>' +
        '<div class="wk-warm">' + warmChips + '</div>' +
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
        mid = '<div class="wk-next">' + (nx.gif ? mediaTag(nx.gif, nx.icon) : '<div style="font-size:26px">' + nx.icon + '</div>') +
          '<div><div class="wn-t">下一动作</div><div class="wn-n">' + esc(nx.name) + ' · ' + (nx.type === 'reps' ? nx.value + ' 次' : nx.value + ' 秒') + '</div></div></div>';
      } else if (isAct) {
        mid = '<div class="wk-cue">' + esc(a.cue || '保持标准动作，注意呼吸节奏') + '</div>';
      } else mid = '<div class="wk-rest-l" style="margin-top:6px">上一组完成，喘口气</div>';
      var optsHtml = (W.phase === 'rest') ? '<div class="wk-rest-opts"><div class="o" data-a="restLess">−5s</div><div class="o" data-a="restMore">+10s</div><div class="o on" data-a="skipRest">跳过</div></div>' : '';
      body = top + posHtml + '<div class="wk-prog"><i id="wprog" style="width:' + wProg() + '%"></i></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 20px;min-height:0">' +
        (isAct ? '<div class="wk-act-name" style="margin-bottom:4px">' + a.icon + ' ' + esc(a.name) + '</div>' : '') +
        (W.phase === 'act' && !isTime ? '<div class="wk-act-tag" id="wl1" style="margin-bottom:4px">目标 ' + a.value + ' 次</div>' : '') +
        '<div class="wk-gif">' + (a.gif ? mediaTag(a.gif, a.icon, 'id="wgif"') : '<div class="bf">' + a.icon + '</div>') + '</div>' +
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
    startW(seq, c.name, c.icon, kcal, c.color, 'fit_course_' + c.id, Math.max(3, S.restSec + cfg.restAdd), buildWarmSeq(warmKindFromCourse(c.cat)));
  }
  function runPlanDay(wIdx, i) {
    var d = S.plan.weeks[wIdx].week[i];
    if (!d || d.rest) return;
    var cfg = diffCfg(S.diff);
    var isRec = d.type === 'recover';
    var seq = d.seq.map(function (s) { var b = scaleAction(s, cfg); b.phase = s.phase || 'main'; return b; });
    var kcal = Math.round((d.kcal || 0) * cfg.kcal);
    startW(seq, '第' + (wIdx + 1) + '周 · ' + d.typeName, d.icon, kcal, '#1FD6A8', 'fit_plan_' + wIdx + '_' + i, Math.max(3, S.restSec + cfg.restAdd), isRec ? [] : buildWarmSeq(warmKindFromDayType(d.type)));
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
  /* ============ 饮食搭配库（相宜相克） ============ */
  var PAIR = [
    { a: '鸡胸肉', b: '西兰花', t: 'good', why: '高蛋白低脂 + 膳食纤维，饱腹强且促吸收' },
    { a: '糙米', b: '豆腐', t: 'good', why: '谷物缺赖氨酸、豆类补之，蛋白互补利用率更高' },
    { a: '杂粮', b: '豆腐', t: 'good', why: '谷物与豆制品氨基酸互补，提升蛋白质量' },
    { a: '番茄', b: '橄榄油', t: 'good', why: '番茄红素为脂溶性，橄榄油助其吸收' },
    { a: '鸡蛋', b: '番茄', t: 'good', why: '番茄红素遇热+脂肪吸收更好，鸡蛋补充蛋白' },
    { a: '酸奶', b: '莓', t: 'good', why: '益生菌与抗氧化物协同，肠道友好' },
    { a: '牛肉', b: '彩椒', t: 'good', why: '彩椒维C促进牛肉中铁的吸收' },
    { a: '牛肉', b: '青椒', t: 'good', why: '青椒维C促进牛肉中铁的吸收' },
    { a: '菠菜', b: '柠檬', t: 'good', why: '维C促进菠菜中非血红素铁的吸收' },
    { a: '红薯', b: '鸡蛋', t: 'good', why: '慢碳 + 优质蛋白，血糖平稳又顶饱' },
    { a: '藜麦', b: '蔬菜', t: 'good', why: '藜麦为完全蛋白，配蔬菜营养更全' },
    { a: '牛奶', b: '菠菜', t: 'warn', why: '牛奶高钙遇菠菜草酸易成草酸钙，影响钙吸收', fix: '错开餐次，或菠菜先焯水去草酸' },
    { a: '豆腐', b: '菠菜', t: 'warn', why: '豆腐高钙与菠菜草酸结合，降低钙吸收', fix: '菠菜先焯水，或与豆制品错餐' },
    { a: '香蕉', b: '花生酱', t: 'warn', why: '高糖 + 高脂同餐，热量密度偏高', fix: '减脂期注意分量，或拆到不同餐' },
    { a: '香蕉', b: '牛油果', t: 'warn', why: '高糖 + 高脂同餐，热量密度偏高', fix: '减脂期减半其一' },
    { a: '茶', b: '牛肉', t: 'warn', why: '茶中鞣酸抑制铁的吸收', fix: '餐后间隔 1 小时再饮茶' },
    { a: '茶', b: '菠菜', t: 'warn', why: '茶中鞣酸抑制铁的吸收', fix: '餐后间隔 1 小时再饮茶' }
  ];
  function pairLookup(x, y) {
    for (var i = 0; i < PAIR.length; i++) {
      var r = PAIR[i];
      if ((x.indexOf(r.a) >= 0 && y.indexOf(r.b) >= 0) || (x.indexOf(r.b) >= 0 && y.indexOf(r.a) >= 0)) return r;
    }
    return null;
  }
  function mealFindings(meal) {
    var names = meal.parts.map(function (p) { return p.n; });
    var out = [];
    for (var i = 0; i < names.length; i++) for (var j = i + 1; j < names.length; j++) {
      var r = pairLookup(names[i], names[j]);
      if (r) out.push(r);
    }
    return out;
  }
  var FOOD_CATS = [
    { k: 'staple', l: '主食', opts: ['米饭', '糙米', '燕麦', '红薯', '全麦面包', '意面', '荞麦面'] },
    { k: 'protein', l: '蛋白', opts: ['鸡胸肉', '鸡蛋', '牛肉', '鱼', '虾', '豆腐', '希腊酸奶'] },
    { k: 'veg', l: '蔬菜', opts: ['西兰花', '菠菜', '番茄', '彩椒', '生菜', '冬瓜'] },
    { k: 'other', l: '其他', opts: ['牛油果', '香蕉', '牛奶', '橄榄油', '柠檬', '坚果'] }
  ];
  function goldenCombos(goal) {
    if (goal === '增肌') return [
      { c: '牛肉 + 糙米 + 彩椒', t: '优质蛋白 + 慢碳 + 维C促铁，增肌黄金三角' },
      { c: '鸡蛋 + 全麦面包 + 牛油果', t: '完整氨基酸 + 好脂肪，训练后恢复友好' },
      { c: '三文鱼 + 红薯 + 西兰花', t: 'Omega-3 抗炎 + 慢碳 + 纤维，助合成' }
    ];
    if (goal === '维持') return [
      { c: '豆腐 + 杂粮 + 时蔬', t: '植物蛋白与谷物互补，清淡均衡' },
      { c: '鸡胸 + 藜麦 + 牛油果', t: '完全蛋白 + 好脂肪，饱腹不长胖' },
      { c: '鱼 + 糙米 + 番茄', t: '低脂优质蛋白 + 抗氧化物，日常稳态' }
    ];
    return [
      { c: '鸡胸肉 + 西兰花 + 糙米', t: '高蛋白低脂 + 慢碳，减脂饱腹标配' },
      { c: '番茄 + 鸡蛋 + 橄榄油', t: '番茄红素脂溶吸收，低脂又抗氧' },
      { c: '希腊酸奶 + 莓果', t: '高蛋白益生菌 + 抗氧，加餐不胖' }
    ];
  }
  function vDietPair() {
    var d = S.diet;
    var golds = goldenCombos(d.goal);
    var goldHtml = golds.map(function (g) {
      return '<div class="gc"><div class="gc-c">' + esc(g.c) + '</div><div class="gc-t">' + esc(g.t) + '</div></div>';
    }).join('');
    var sel = S.dietPair, res = S.dietPairRes;
    var pickHtml = FOOD_CATS.map(function (c) {
      var chips = c.opts.map(function (o) {
        return '<span class="chip sm ' + (sel[c.k] === o ? 'on' : '') + '" data-a="pairPick" data-k="' + c.k + '" data-v="' + o + '">' + o + '</span>';
      }).join('');
      return '<div class="pc"><div class="pc-l">' + c.l + '</div><div class="chips">' + chips + '</div></div>';
    }).join('');
    var resHtml = '';
    if (res) {
      var head = res.warn ? '⚠ 搭配需注意' : '✓ 搭配优秀';
      var items = res.items.map(function (it) {
        return '<div class="pr ' + (it.t === 'good' ? 'g' : 'w') + '"><b>' + esc(it.a) + ' + ' + esc(it.b) + '</b> · ' + esc(it.why) + (it.fix ? ' <span class="pr-fix">→ ' + esc(it.fix) + '</span>' : '') + '</div>';
      }).join('');
      var empty = res.items.length ? '' : '<div class="pr g">所选食材无明显冲突，整体搭配均衡 👍</div>';
      resHtml = '<div class="pair-res ' + (res.warn ? 'w' : 'g') + '"><div class="pr-h">' + head + '</div>' + items + empty + '</div>';
    }
    return '<div class="card diet-pair"><div class="form-t" style="margin:0 0 8px">🥇 目标黄金搭配 · ' + esc(d.goal) + '</div>' + goldHtml +
      '<div class="h-sec" style="margin:14px 0 8px">🔍 搭配自检</div>' + pickHtml +
      '<div class="gen-btn btn" data-a="pairCheck" style="margin-top:12px">检测搭配</div>' + resHtml + '</div>';
  }
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
  function mealCard(title, pct, meal, badges) {
    var parts = meal.parts.map(function (x) { return '<div class="mc-p">' + esc(x.n) + (x.a ? ' <span class="mc-a">' + esc(x.a) + '</span>' : '') + '</div>'; }).join('');
    var bd = '';
    if (badges && badges.length) {
      bd = '<div class="mc-bd">' + badges.map(function (r) {
        return '<span class="bd ' + (r.t === 'good' ? 'g' : 'w') + '">' + (r.t === 'good' ? '✓ 宜搭 ' : '⚠ 注意 ') + esc(r.a) + '+' + esc(r.b) + '</span>';
      }).join('') + '</div>';
    }
    return '<div class="meal-card"><div class="mc-h"><span class="mc-t">' + title + '</span><span class="mc-pct">' + pct + '%</span><span class="mc-k">' + meal.kcal + ' 千卡</span></div>' + parts + bd + '</div>';
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
    // 饮食打卡（#23）：勾选已吃的餐 → 已摄入 vs 目标进度
    var today = todayStr();
    var dl = S.dietLog[today] || (S.dietLog[today] = {});
    var eaten = (dl.bf ? bf.kcal : 0) + (dl.lunch ? lunch.kcal : 0) + (dl.dinner ? dinner.kcal : 0) + (dl.snack ? snack.kcal : 0);
    var mealChips = [['bf', '🌅 早餐'], ['lunch', '☀️ 午餐'], ['dinner', '🌙 晚餐'], ['snack', '🍪 加餐']].map(function (x) {
      return '<span class="chip ' + (dl[x[0]] ? 'on' : '') + '" data-a="mealChk" data-k="' + x[0] + '">' + x[1] + (dl[x[0]] ? ' ✓' : '') + '</span>';
    }).join('');
    var mealChkHtml = '<div class="card" style="margin-top:8px"><div class="form-t" style="margin:0 0 8px">🍽 今日饮食打卡</div>' +
      '<div class="chips">' + mealChips + '</div>' +
      '<div class="macro-bar" style="margin-top:10px"><i class="mp p" style="width:' + Math.min(100, Math.round(eaten / dayK * 100)) + '%"></i></div>' +
      '<div style="font-size:11px;color:#7a838e;margin-top:6px">已摄入 <b style="color:var(--ink)">' + eaten + '</b> / 目标 ' + dayK + ' 千卡' +
      (eaten > dayK ? ' · <span style="color:#e08a00">超 ' + (eaten - dayK) + ' 千卡</span>' : ' · 还剩 ' + (dayK - eaten) + ' 千卡') + '</div></div>';
    var goalTxt = d.goal === '减脂' ? '热量缺口，建议配合训练与充足蛋白以保留肌肉' : d.goal === '增肌' ? '热量盈余，保证蛋白摄入与力量训练刺激' : '维持当前体重，均衡搭配即可';
    // 热量闭环（#16）：把训练消耗汇入饮食预算视角——展示本周训练消耗，训练日已 +150 千卡
    var cutoff7 = Date.now() - 7 * 86400000;
    var wkR = S.records.filter(function (r) { return new Date(r.date + 'T00:00:00').getTime() >= cutoff7; });
    var wkK = wkR.reduce(function (a, r) { return a + (r.kcal || 0); }, 0);
    var trainCard = '<div class="card train-loop"><div class="form-t" style="margin:0 0 6px">🏃 本周训练消耗（热量闭环）</div>' +
      '<div class="vol-row"><div class="vol-b"><div class="n">' + wkK + '</div><div class="l">近 7 天消耗(千卡)</div></div>' +
      '<div class="vol-b"><div class="n">' + wkR.length + '</div><div class="l">训练次数</div></div>' +
      '<div class="vol-b"><div class="n">+' + (d.training ? 150 : 0) + '</div><div class="l">训练日追加</div></div></div>' +
      '<div style="font-size:10.5px;color:#a0a6ad;margin-top:6px">训练日当天已在本方案热量基础上 +150 千卡（见上方"当日类型"）。练得越多、热量预算越贴合实际消耗，吃练自然闭环。</div></div>';
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
      mealCard('早餐', 25, bf, mealFindings(bf)) + mealCard('午餐', 35, lunch, mealFindings(lunch)) + mealCard('晚餐', 30, dinner, mealFindings(dinner)) + mealCard('加餐', 10, snack, mealFindings(snack)) +
      mealChkHtml +
      trainCard +
      vDietPair() +
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

  /* ============ 训练趋势时间线（#13）：PR 曲线 + 周训练量曲线 ============ */
  function lineSvg(vals, color, w, h) {
    if (!vals.length) return '<div style="font-size:11px;color:#a0a6ad;padding:8px 2px">数据不足（至少 2 次记录）</div>';
    var max = Math.max.apply(null, vals.concat([1]));
    var n = vals.length;
    var pts = vals.map(function (v, i) {
      var x = n === 1 ? w / 2 : (i / (n - 1)) * (w - 8) + 4;
      var y = h - (v / max) * (h - 10) - 5;
      return [x.toFixed(1), y.toFixed(1)];
    });
    var poly = '<polyline points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/>';
    var dots = pts.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.6" fill="' + color + '"/>'; }).join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="display:block">' + poly + dots + '</svg>';
  }
  function weeklyVol() {
    var map = {};
    S.records.forEach(function (r) {
      var reps = 0; (r.detail || []).forEach(function (x) { if (x.type === 'reps' && x.actual > 0) reps += x.actual; });
      var d = new Date(r.date + 'T00:00:00');
      var y = d.getFullYear(); var start = new Date(y, 0, 1);
      var wk = Math.floor((Math.floor((d - start) / 86400000) + start.getDay() + 1) / 7);
      var key = y + '-' + wk;
      map[key] = (map[key] || 0) + reps;
    });
    var out = [], now = new Date();
    for (var i = 7; i >= 0; i--) {
      var d = new Date(now); d.setDate(d.getDate() - i * 7);
      var y = d.getFullYear(); var start = new Date(y, 0, 1);
      var wk = Math.floor((Math.floor((d - start) / 86400000) + start.getDay() + 1) / 7);
      out.push({ label: i === 0 ? '本周' : i + '周前', reps: map[y + '-' + wk] || 0 });
    }
    return out;
  }
  function prTrendHtml() {
    var names = Object.keys(S.best).filter(function (n) { return S.best[n].best > 0 && (S.best[n].hist || []).length >= 2; });
    if (!names.length) return '';
    names.sort(function (a, b) { return (S.best[b].hist.length) - (S.best[a].hist.length); });
    var top = names.slice(0, 3);
    var cards = top.map(function (nm) {
      var hist = (S.best[nm].hist || []).slice(-12);
      return '<div class="card"><div class="zh-st-h" style="margin-bottom:4px">' + esc(nm) + ' · PR 曲线（近 ' + hist.length + ' 次）</div>' +
        lineSvg(hist, '#0fb98c', 280, 70) +
        '<div style="font-size:10px;color:#a0a6ad;margin-top:4px">最佳 ' + S.best[nm].best + ' · 最近 ' + hist[hist.length - 1] + '</div></div>';
    }).join('');
    var vol = weeklyVol().map(function (x) { return x.reps; });
    var volCard = '<div class="card"><div class="zh-st-h" style="margin-bottom:4px">📈 近 8 周训练量（总次数）</div>' + lineSvg(vol, '#6a78d6', 280, 70) + '</div>';
    return '<div class="h-sec">⏱ 训练趋势时间线</div>' + cards + volCard;
  }

  /* ============ 周计划分享（#17）：生成可读文本并复制到剪贴板 ============ */
  function planShareText() {
    var p = S.plan; if (!p) return '';
    var lines = ['🏋️ 我的 ' + p.weeks.length + ' 周健身计划'];
    if (p.levelNote) lines.push('💬 ' + p.levelNote);
    p.weeks.forEach(function (wk, wi) {
      lines.push('');
      lines.push('—— 第' + (wi + 1) + '周（' + wk.days + ' 练 · 约 ' + wk.totalMin + ' 分钟 · ' + wk.totalKcal + ' 千卡）——');
      wk.week.forEach(function (d) {
        if (d.rest) { lines.push(d.wd + '：💤 休息日'); return; }
        var mains = d.acts.filter(function (a) { return !a.fin && !a.cool; }).slice(0, 4).map(function (a) { return a.name; }).join('、');
        lines.push(d.wd + '：' + d.icon + ' ' + d.typeName + '（' + mains + (d.acts.length > 4 ? ' 等' : '') + '）');
      });
    });
    lines.push('');
    lines.push('—— 来自「健身教练」网页版');
    return lines.join('\n');
  }
  function copyText(txt, okMsg) {
    var done = function () { toast(okMsg); };
    var fallback = function () {
      try {
        var ta = document.createElement('textarea');
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta); done();
      } catch (e) { toast('复制失败，请手动选择文本'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, fallback);
    } else fallback();
  }
  function sharePlan() {
    var txt = planShareText();
    if (!txt) { toast('先生成计划再分享'); return; }
    copyText(txt, '📋 周计划已复制，去粘贴分享吧');
  }

  /* ============ 训练档案导出/备份（#15） ============ */
  function exportData() {
    var payload = { v: 1, exportedAt: new Date().toISOString(), best: S.best, records: S.records, plan: S.plan, diet: S.diet, dietPair: S.dietPair };
    try {
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'fit_backup_' + todayStr() + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) { alert('导出失败：' + e.message); }
  }
  function importData(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var p = JSON.parse(reader.result);
        if (p.best) { S.best = p.best; saveK(KB, S.best); }
        if (p.records) { S.records = p.records; saveK(KR, S.records); }
        if (p.plan !== undefined) { S.plan = p.plan; saveK(KP, S.plan); }
        if (p.diet !== undefined) { S.diet = p.diet; saveK('fit_diet', S.diet); }
        if (p.dietPair) S.dietPair = p.dietPair;
        alert('已导入备份：动作纪录 ' + Object.keys(S.best).length + ' 项，训练记录 ' + S.records.length + ' 条');
        renderShell();
      } catch (e) { alert('导入失败：文件格式不正确'); }
    };
    reader.readAsText(file);
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
    if (a === 'equipF') { S.equipFilter = v; renderView(); return; }
    if (a === 'setRecovery') { S.recoveryOn = (v === '1'); saveK('fit_recovery', S.recoveryOn); renderView(); return; }
    if (a === 'exportData') { exportData(); return; }
    if (a === 'sharePlan') { sharePlan(); return; }
    /* 体重 / 饮食打卡 */
    if (a === 'weightSave') {
      var wi = $('#wgtIn'), wv = wi ? Number(wi.value) : 0;
      if (!wv || wv < 20 || wv > 400) { toast('请输入合理体重 (20-400 kg)'); return; }
      S.weights[todayStr()] = Math.round(wv * 10) / 10; saveK('fit_weight', S.weights);
      renderView(); toast('⚖️ 已记录 ' + S.weights[todayStr()] + ' kg'); return;
    }
    if (a === 'mealChk') {
      var td = todayStr(), log = S.dietLog[td] || (S.dietLog[td] = {});
      log[k] = !log[k]; saveK('fit_dietlog', S.dietLog); renderView(); return;
    }
    /* 呼吸放松 */
    if (a === 'breath') { startBreath(v); return; }
    /* HIIT */
    if (a === 'hitTpl') { S.hiit.tpl = v; renderView(); return; }
    if (a === 'hitToggle') {
      var hn = el.dataset.name;
      if (S.hiit.sel[hn]) delete S.hiit.sel[hn]; else if (Object.keys(S.hiit.sel).length >= 4) { toast('最多选 4 个动作'); } else S.hiit.sel[hn] = 1;
      renderView(); return;
    }
    if (a === 'hitStart') { hiitStart(); return; }
    /* 进阶周期 */
    if (a === 'nextCycle') {
      if (!S.plan) return;
      var cyc = (S.plan.cycle || 1) + 1;
      S.plan = generatePlan({ goal: S.form.goal, days: S.form.day, length: S.form.length, level: S.form.level }, histForPlan());
      S.plan.cycle = cyc;
      if (S.recoveryOn) applyRecovery(S.plan);
      S.weekIdx = 0; saveK(KP, S.plan); renderView();
      toast('🚀 第 ' + cyc + ' 周期已生成 · 目标按个人最佳自动上调'); return;
    }
    if (a === 'importData') { var fi = $('#impFile'); if (fi) fi.click(); return; }
    if (a === 'dayRecover') {
      var dw = Number(el.dataset.w), di = Number(el.dataset.i);
      var d0 = S.plan && S.plan.weeks[dw] && S.plan.weeks[dw].week[di];
      if (!d0 || d0.rest) return;
      S.plan.weeks[dw].week[di] = makeRecoverDay(d0.wd, S.plan.length);
      saveK(KP, S.plan); renderView(); return;
    }
    if (a === 'form') { S.form[k] = (k === 'day' || k === 'length') ? Number(v) : v; renderView(); return; }
    if (a === 'genPlan') {
      S.plan = generatePlan({ goal: S.form.goal, days: S.form.day, length: S.form.length, level: S.form.level }, histForPlan());
      if (S.recoveryOn) applyRecovery(S.plan);
      S.weekIdx = 0; saveK(KP, S.plan); renderView(); return;
    }
    if (a === 'replan') { S.plan = null; saveK(KP, null); renderView(); return; }
    if (a === 'week') { S.weekIdx = Number(el.dataset.i); renderView(); return; }
    if (a === 'openCourse') { var c = courses.filter(function (x) { return x.id === el.dataset.id; })[0]; if (c) sheetCourse(c); return; }
    if (a === 'runCourse') { closeSheet(); runCourse(el.dataset.id); return; }
    if (a === 'actInfo') { sheetAct(el.dataset.name); return; }
    if (a === 'actVariant') { sheetAct(el.dataset.name); return; }
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
    if (a === 'editDay') { sheetEditDay(Number(el.dataset.w), Number(el.dataset.i)); return; }
    if (a === 'swapAct') { sheetSwap(Number(el.dataset.w), Number(el.dataset.i), el.dataset.name); return; }
    if (a === 'doSwap') {
      var dw = Number(el.dataset.w), di = Number(el.dataset.i), from = el.dataset.from, to = el.dataset.to;
      var dd = S.plan.weeks[dw] && S.plan.weeks[dw].week[di]; if (!dd) return;
      var t = NS.actionByName[to]; if (!t) return;
      dd.acts.forEach(function (act) { if (act.name === from && !act.fin && !act.cool) { act.name = to; act.icon = t.icon || '🏋️'; act.type = t.type; act.cue = t.cue || ''; act.fromHist = false; } });
      dd.seq.forEach(function (s) { if (s.name === from && s.phase === 'main') { s.name = to; s.icon = t.icon || '🏋️'; s.type = t.type; s.cue = t.cue || ''; } });
      S.plan.edited = true; saveK(KP, S.plan);
      sheetEditDay(dw, di); return;
    }
    if (a === 'daySets') {
      var dws = Number(el.dataset.w), dis = Number(el.dataset.i), dv = el.dataset.v === '1' ? 1 : -1;
      var dds = S.plan.weeks[dws] && S.plan.weeks[dws].week[dis]; if (!dds) return;
      var ms = dds.acts.filter(function (x) { return !x.fin && !x.cool; });
      if (!ms.length) return;
      var nr = Math.max(1, Math.min(6, ms[0].round + dv));
      ms.forEach(function (x) { x.round = nr; });
      rebuildSeq(dds);
      S.plan.edited = true; saveK(KP, S.plan);
      sheetEditDay(dws, dis); return;
    }
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
    /* 饮食搭配自检 */
    if (a === 'pairPick') { S.dietPair[k] = (S.dietPair[k] === v ? '' : v); S.dietPairRes = null; renderView(); return; }
    if (a === 'pairCheck') {
      var sel = S.dietPair; var foods = [sel.staple, sel.protein, sel.veg, sel.other].filter(function (x) { return x; });
      var pItems = [], pWarn = false;
      for (var pi = 0; pi < foods.length; pi++) for (var pj = pi + 1; pj < foods.length; pj++) {
        var pr = pairLookup(foods[pi], foods[pj]);
        if (pr) { pItems.push(pr); if (pr.t === 'warn') pWarn = true; }
      }
      S.dietPairRes = { warn: pWarn, items: pItems };
      renderView(); return;
    }
    /* 跟练 */
    if (a === 'skipReady') { enterAct(); return; }
    if (a === 'beginMain') { if (W && W.phase === 'warmDone') { W.warmAck = true; W.i = W.firstMain; enterAct(); } return; }
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
  app.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.id === 'impFile') { importData(t.files && t.files[0]); t.value = ''; }
  });

  renderShell();
})();
