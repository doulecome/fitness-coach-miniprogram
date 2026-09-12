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

  /* ============ 身体数据分析器（通用 · 隐私安全） ============
     体检/身体数据只存本机 localStorage（fit_health），仓库代码零个人数据。
     analyzeHealth：规则引擎——按 BMI/血压/静息心率/尿酸/血糖/GGT 生成训练与饮食建议；
     parseReport：粘贴体检报告文字自动提取数值。 */
  function analyzeHealth(h) {
    var r = { gender: h.gender || '男', age: Number(h.age) || 28, height: Number(h.height) || 175, weight: Number(h.weight) || 70, activity: h.activity || '中度', examDate: h.examDate || '' };
    r.idealWeight = Math.round(r.height - 105);
    var bmi = r.weight / Math.pow(r.height / 100, 2);
    r.bmi = Math.round(bmi * 10) / 10;
    /* 体脂率（可选指标）：BMI 正常但体脂偏高 = 隐性肥胖，未显式指定目标时方向定为减脂 */
    r.bfp = 0; r.bfpLv = '';
    var bfpRaw = Number(h.bfp) || 0;
    if (bfpRaw) {
      var bfHi = r.gender === '女' ? 32 : 25, bfLo = r.gender === '女' ? 18 : 10;
      r.bfp = bfpRaw; r.bfpLv = bfpRaw >= bfHi ? 'high' : bfpRaw <= bfLo ? 'low' : 'ok';
    }
    r.goal = bmi < 18.5 ? '增肌' : bmi >= 24 ? '减脂' : (h.goal || (r.bfpLv === 'high' ? '减脂' : '维持'));
    r.weightGoal = bmi < 18.5 ? Math.max(Math.round(r.idealWeight * 0.88), Math.round(r.weight + 4)) : bmi >= 24 ? Math.round(r.weight - 5) : (r.goal === '减脂' ? Math.round(r.weight - 3) : r.weight);
    r.water = Math.max(Math.round(r.weight * 35), 2000);
    var tips = [];
    r.dietFlags = []; /* 体检标记 → 餐单选品偏好（低嘌呤硬排除 / 低 GI 软优先） */
    if (bmi < 18.5) tips.push({ i: '⚖️', t: '体重偏轻（BMI ' + r.bmi + '）', d: '核心是吃够 + 练够：每天比消耗多吃约 300 千卡，以力量训练为主、少做长时间有氧。理想体重约 ' + r.idealWeight + 'kg，先定 ' + r.weightGoal + 'kg 小目标，每月增 0.8~1.2kg 最稳。' });
    else if (bmi >= 28) tips.push({ i: '⚖️', t: '肥胖（BMI ' + r.bmi + '）', d: '建议系统减重：热量缺口 300~500 千卡/天，每周 3 次力量 + 2 次有氧组合，保肌肉先于掉体重。先定 ' + r.weightGoal + 'kg 目标，每月减 2~3kg。' });
    else if (bmi >= 24) tips.push({ i: '⚖️', t: '超重（BMI ' + r.bmi + '）', d: '热量缺口约 300 千卡/天，力量有氧各半，目标先定 ' + r.weightGoal + 'kg，每月减 1~2kg。' });
    else tips.push({ i: '⚖️', t: '体重正常（BMI ' + r.bmi + '）', d: '按目标维持或塑形即可，力量训练为主保持肌肉量与骨密度。' });
    var sys = Number(h.sys) || 0, dia = Number(h.dia) || 0;
    if (sys >= 140 || dia >= 90) { tips.push({ i: '❤️', t: '血压偏高（' + sys + '/' + dia + '）', d: '建议先就医评估再上强度；以中低强度有氧为主，暂避大重量憋气，力量动作用轻重量高次数。' }); r.bpFlag = 'high'; }
    else if (sys >= 120 || dia >= 80) { tips.push({ i: '❤️', t: '血压正常偏高（' + sys + '/' + dia + '）', d: '可正常训练，但大重量少憋气、组间充分休息；每周 2 次中低强度有氧有助血压回落。' }); r.bpFlag = 'watch'; }
    var hr = Number(h.hr) || 0;
    if (hr > 100) tips.push({ i: '💓', t: '静息心率偏快（' + hr + ' 次/分）', d: '优先睡眠与压力管理；从低强度开始渐进，每周 1~2 次 30 分钟轻松有氧（能说话的配速），帮静息心率降下来。' });
    else if (hr >= 90) tips.push({ i: '💓', t: '静息心率接近上限（' + hr + ' 次/分）', d: '正常范围但偏快：规律有氧 + 充足睡眠，通常 8~12 周可见改善。' });
    var ua = Number(h.ua) || 0;
    if (ua > 428) { tips.push({ i: '🧪', t: '尿酸偏高（' + ua + ' μmol/L）', d: '蛋白优选鸡蛋、牛奶、乳清、鸡胸；少吃动物内脏、浓肉汤、部分海鲜，不饮酒、少喝含糖饮料；每天喝够 ' + (r.water / 1000).toFixed(1) + 'L 水。明显升高建议就医复查。' }); r.water = Math.max(r.water, 2400); r.lowPurine = true; }
    else if (ua >= 390) { tips.push({ i: '🧪', t: '尿酸接近上限（' + ua + ' μmol/L）', d: '高蛋白饮食期间优选蛋、奶、乳清等低嘌呤来源，多喝水（' + (r.water / 1000).toFixed(1) + 'L/天），少内脏与浓汤。' }); r.water = Math.max(r.water, 2200); r.lowPurine = true; }
    if (r.lowPurine) r.dietFlags.push('低嘌呤');
    var glu = Number(h.glu) || 0;
    if (glu >= 6.1) { tips.push({ i: '🩸', t: '空腹血糖偏高（' + glu + ' mmol/L）', d: '建议复查糖代谢；训练加每周 2~3 次有氧，主食换低 GI（糙米/燕麦），少含糖饮料。' }); r.dietFlags.push('低GI'); }
    var ggt = Number(h.ggt) || 0;
    if (ggt > 60) tips.push({ i: '🫀', t: 'GGT 偏高（' + ggt + ' U/L）', d: '常见于饮酒或肝胆问题，建议戒酒并复查肝功能后再定训练强度。' });
    else if (ggt > 0 && ggt < 10) tips.push({ i: '🫀', t: 'GGT 偏低（' + ggt + ' U/L）', d: '多与营养摄入不足相关，非疾病信号：把热量与蛋白吃够，通常随营养改善回升。' });
    /* ---- 血脂四项：参考《中国成人血脂异常防治指南》通用区间，任一项有值才判定 ---- */
    var tc = Number(h.tc) || 0, tg = Number(h.tg) || 0, hdl = Number(h.hdl) || 0, ldl = Number(h.ldl) || 0;
    r.lipid = null;
    if (tc || tg || hdl || ldl) {
      var lp = {};
      if (tc) { lp.tc = tc; lp.tcLv = tc >= 6.2 ? 'high' : tc >= 5.2 ? 'edge' : 'ok'; }
      if (tg) { lp.tg = tg; lp.tgLv = tg >= 2.3 ? 'high' : tg >= 1.7 ? 'edge' : 'ok'; }
      if (hdl) { lp.hdl = hdl; lp.hdlLv = hdl < (r.gender === '女' ? 1.3 : 1.0) ? 'low' : 'ok'; }
      if (ldl) { lp.ldl = ldl; lp.ldlLv = ldl >= 4.1 ? 'high' : ldl >= 3.4 ? 'edge' : 'ok'; }
      r.lipid = lp;
      var seg = [];
      if (lp.tcLv && lp.tcLv !== 'ok') seg.push('总胆固醇 ' + tc);
      if (lp.tgLv && lp.tgLv !== 'ok') seg.push('甘油三酯 ' + tg);
      if (lp.hdlLv && lp.hdlLv !== 'ok') seg.push('HDL ' + hdl);
      if (lp.ldlLv && lp.ldlLv !== 'ok') seg.push('LDL ' + ldl);
      var ldlBad = (lp.ldlLv && lp.ldlLv !== 'ok') || (lp.tcLv && lp.tcLv !== 'ok');
      var tgBad = lp.tgLv && lp.tgLv !== 'ok';
      var hdlBad = lp.hdlLv === 'low';
      var lHigh = lp.tcLv === 'high' || lp.tgLv === 'high' || lp.ldlLv === 'high';
      if (seg.length) {
        var ladv = [];
        if (ldlBad) ladv.push('减少饱和脂肪与反式脂肪（肥肉、油炸、奶油糕点、内脏），多吃膳食纤维、豆类与深海鱼');
        if (tgBad) ladv.push('甘油三酯与酒精、含糖饮料、精制主食最相关：先戒酒、少甜饮、主食换低 GI（糙米/燕麦）');
        if (hdlBad) ladv.push('HDL 偏低（好胆固醇不足）：规律有氧 + 适量优质脂肪（坚果、橄榄油、深海鱼）比单纯少吃更有效');
        tips.push({ i: '🩸', t: '血脂' + (lHigh ? '异常' : '边缘偏高') + '（' + seg.join(' / ') + '）', d: ladv.join('；') + '。建议 3~6 个月复查血脂四项。' });
        if (tgBad) r.dietFlags.push('低GI'); /* 真实联动：甘油三酯偏高时主食优先粗粮 */
      }
    }
    /* ---- 体脂率 ---- */
    if (r.bfpLv === 'high') tips.push({ i: '📊', t: '体脂率偏高（' + r.bfp + '%）', d: 'BMI ' + r.bmi + ' 在正常范围但体脂占比偏高（隐性肥胖倾向）：热量小幅缺口 200~300 千卡 + 力量训练为主保住肌肉，比单纯节食有效。' });
    else if (r.bfpLv === 'low') tips.push({ i: '📊', t: '体脂率偏低（' + r.bfp + '%）', d: '体脂过低会影响激素水平与免疫力：适当增加优质脂肪与总热量，减少长时间有氧。' });
    /* ---- 骨密度 T 值（WHO 口径：≥-1 正常 / -1~-2.5 骨量减少 / ≤-2.5 骨质疏松）---- */
    if (h.bmd !== undefined && h.bmd !== null && h.bmd !== '') {
      var tVal = Number(h.bmd);
      if (!isNaN(tVal)) {
        r.bmd = tVal;
        if (tVal <= -2.5) tips.push({ i: '🦴', t: '骨密度 T 值 ' + tVal + '（骨质疏松范围）', d: '训练需在医生指导下进行：以坐姿/固定器械等低冲击抗阻为主，避免弯腰负重（硬拉、仰卧起坐）与跳跃；同时补足钙与维生素 D、多晒太阳。' });
        else if (tVal < -1) tips.push({ i: '🦴', t: '骨密度 T 值 ' + tVal + '（骨量减少）', d: '骨骼需要负重刺激：每周 3 次抗阻或自重训练（深蹲、推举、提重物行走）比游泳更有效；配合补钙 + 维生素 D，避免过度节食。' });
      }
    }
    /* 结构化锻炼建议：由指标推导每周训练安排与强度红线（联动训练计划） */
    var tt = [];
    if (r.goal === '增肌') tt.push({ i: '🏋️', t: '每周 4 练 · 力量为主', d: '推/拉/蹲分化循环，复合动作优先、渐进加重；有氧每周 1~2 次、每次 15~20 分钟轻松配速即可，避免消耗过大影响增重。' });
    else if (r.goal === '减脂') tt.push({ i: '🏋️', t: '每周 5 练 · 力量+有氧组合', d: '3 次力量（大肌群优先，守住肌肉和代谢）+ 2 次 30~40 分钟有氧造热量缺口；体重下降后力量重量同步上调。' });
    else tt.push({ i: '🏋️', t: '每周 3~4 练 · 塑形维持', d: '力量训练为主保持肌肉量与骨密度，搭配 1~2 次 20~30 分钟有氧维持心肺。' });
    if (sys >= 140 || dia >= 90) { tt.push({ i: '⚠️', t: '强度红线：血压偏高', d: '暂缓大重量与憋气发力（大重量深蹲/硬拉/推举），改轻重量高次数、组间充分休息；先就医评估再逐步上强度。' }); r.levelCap = '新手'; }
    else if (sys >= 120 || dia >= 80) tt.push({ i: '⚠️', t: '强度注意：血压正常偏高', d: '可正常训练，但大重量少憋气、组间多休息；每周 2 次中低强度有氧有助血压回落。' });
    if (hr > 90) tt.push({ i: '💓', t: '心率提示：轻松配速起步', d: '有氧控制在"能正常说话"的强度（RPE 4~6），随静息心率下降再逐步提速。' });
    /* 血脂 / 骨密度识别到时追加的训练安排（识别不到则整段不出现） */
    if (r.lipid && (r.lipid.ldlLv !== undefined || r.lipid.tcLv !== undefined || r.lipid.tgLv !== undefined) &&
      ((r.lipid.ldlLv && r.lipid.ldlLv !== 'ok') || (r.lipid.tcLv && r.lipid.tcLv !== 'ok') || (r.lipid.tgLv && r.lipid.tgLv !== 'ok'))) {
      tt.push({ i: '🫀', t: '有氧补充：血脂偏高', d: '在力量训练之外每周 3 次 30 分钟中等强度有氧（快走/骑车/椭圆机，能说话但略喘），对降甘油三酯与 LDL 最直接。' });
    }
    if (r.bmd != null && r.bmd <= -2.5) tt.push({ i: '🦴', t: '强度红线：骨质疏松', d: '避免脊柱屈曲负重与跳跃落地（仰卧起坐、弯腰硬拉、跳箱），改坐姿器械与快走；上强度前先就医评估。' });
    else if (r.bmd != null && r.bmd < -1) tt.push({ i: '🦴', t: '训练重点：负重抗阻', d: '骨量减少期最有效的是抗阻/负重训练（每周 3 次），别把训练全换成游泳或骑行这类无负重有氧。' });
    r.trainTips = tt;
    /* 标记去重（血糖与甘油三酯都可能要求低 GI） */
    r.dietFlags = r.dietFlags.filter(function (x, i, a) { return a.indexOf(x) === i; });
    r.planGoal = r.goal === '维持' ? '保持健康' : r.goal; /* 映射到计划表单的目标枚举 */
    r.planDays = r.goal === '减脂' ? 5 : r.goal === '增肌' ? 4 : 3;
    if (r.levelCap) r.planDays = Math.min(r.planDays, 3);
    tips.push({ i: '📌', t: '通用原则', d: '本分析基于常见参考区间，仅作训练与饮食方向参考；异常指标请以专科医生意见为准。' });
    r.tips = tips;
    return r;
  }
  function parseReport(txt) {
    var out = {}, num = function (re) { var m = txt.match(re); return m ? Number(m[1]) : 0; };
    var v;
    v = num(/身高[^0-9\n]{0,8}(\d{3}(?:\.\d)?)/); if (v >= 120 && v <= 230) out.height = v;
    v = num(/体重[^0-9\n]{0,8}(\d{2,3}(?:\.\d)?)/); if (v >= 25 && v <= 250) out.weight = v;
    v = num(/理想体重[^0-9\n]{0,8}(\d{2,3}(?:\.\d)?)/); if (v >= 30 && v <= 200) out.idealWeight = v;
    v = num(/收缩压[^0-9\n]{0,8}(\d{2,3})/); if (v >= 70 && v <= 220) out.sys = v;
    v = num(/舒张压[^0-9\n]{0,8}(\d{2,3})/); if (v >= 40 && v <= 140) out.dia = v;
    v = num(/(?:脉搏|静息心率)[^0-9\n]{0,8}(\d{2,3})/); if (v >= 35 && v <= 160) out.hr = v;
    v = num(/尿酸[^0-9\n]{0,12}(\d{2,4})/); if (v >= 100 && v <= 900) out.ua = v;
    v = num(/(?:空腹)?血糖[^0-9\n]{0,12}(\d\.\d{1,2})/); if (v >= 2 && v <= 33) out.glu = v;
    v = num(/谷氨酰[^0-9\n]{0,16}(\d{1,3})/); if (v >= 1 && v <= 500) out.ggt = v;
    /* ---- 可选指标：报告里没有这几项就不带出来，调用方按"有值才分析"处理 ---- */
    v = num(/(?:高密度脂蛋白|HDL)[^0-9\-]{0,12}(\d(?:\.\d{1,2})?)/); if (v >= 0.2 && v <= 5) out.hdl = v;
    v = num(/(?:低密度脂蛋白|LDL)[^0-9\-]{0,12}(\d(?:\.\d{1,2})?)/); if (v >= 0.3 && v <= 12) out.ldl = v;
    v = num(/甘油三酯[^0-9\-]{0,12}(\d(?:\.\d{1,2})?)/); if (v >= 0.2 && v <= 30) out.tg = v;
    v = num(/总胆固醇[^0-9\-]{0,12}(\d(?:\.\d{1,2})?)/); if (v < 1.5 || v > 20) v = 0;
    if (!v) {
      /* 报告只写「胆固醇」时兜底，但要排除「高密度/低密度脂蛋白胆固醇」这两项 */
      var reC = /胆固醇[^0-9\-]{0,12}(\d(?:\.\d{1,2})?)/g, mC;
      while ((mC = reC.exec(txt))) {
        if (/高密度|低密度|HDL|LDL/.test(txt.slice(Math.max(0, mC.index - 8), mC.index))) continue;
        var cv = Number(mC[1]); if (cv >= 1.5 && cv <= 20) { v = cv; break; }
      }
    }
    if (v) out.tc = v;
    v = num(/体脂(?:率|百分比)?[^0-9\-]{0,10}(\d{1,2}(?:\.\d)?)/); if (v >= 3 && v <= 60) out.bfp = v;
    /* 骨密度 T 值可为 0 或负数，不能用 truthy 判断是否识别到 */
    var mt = txt.match(/(?:骨密度[^0-9\n\-]{0,12}|[Tt]\s*值[^0-9\n\-]{0,8})(-?\d(?:\.\d{1,2})?)/);
    if (mt) { var tv = Number(mt[1]); if (tv >= -6 && tv <= 4) out.bmd = tv; }
    var dt = txt.match(/(20\d{2})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
    if (dt) out.examDate = dt[1] + '-' + ('0' + dt[2]).slice(-2) + '-' + ('0' + dt[3]).slice(-2);
    return out;
  }
  var HEALTH0 = loadK('fit_health', null);
  /* 无档案 → 通用默认（不含任何个人数据）；有档案 → 全部由 analyzeHealth 派生 */
  var PROFILE = HEALTH0 ? analyzeHealth(HEALTH0) : { gender: '男', age: 28, height: 175, weight: 70, activity: '中度', goal: '减脂', weightGoal: 65, water: 0, examDate: '', idealWeight: 0, bmi: 0, tips: [] };
  /* ============ 状态 ============ */
  var S = {
    tab: 'home', seg: 'course', actMus: '全部', actQ: '', equipFilter: '全部',
    theme: loadK('fit_theme', 'light'), favs: loadK('fit_favs', []),
    best: loadK(KB, {}), records: loadK(KR, []), plan: loadK(KP, null), weekIdx: 0,
    form: { goal: PROFILE.planGoal || (PROFILE.goal === '维持' ? '保持健康' : PROFILE.goal), day: 4, length: 30, level: '进阶', venue: '🏠 居家' }, restSec: loadK(KRS, 10), diff: loadK('fit_diff', 'std'),
    recoveryOn: loadK('fit_recovery', false),
    weights: loadK('fit_weight', {}), dietLog: loadK('fit_dietlog', {}),
    hiit: { tpl: 'tabata', sel: {} }, badges: loadK('fit_badges', {}),
    rpeLog: loadK('fit_rpe', []), fitness: loadK('fit_fitness', []), wGoal: loadK('fit_wgoal', PROFILE.weightGoal), remind: loadK('fit_remind', null), pantry: loadK('fit_pantry', []), dayMeal: loadK('fit_daymeal', null),
    health: HEALTH0, healthDraft: null, healthOpen: false,
    diet: loadK('fit_diet', null), dietDraft: { gender: PROFILE.gender, age: PROFILE.age, height: PROFILE.height, weight: PROFILE.weight, activity: PROFILE.activity, goal: PROFILE.goal }, dietFormOpen: false, dietAuto: false,
    builder: { sel: {}, rounds: 3 },
    dietPair: { staple: '', protein: '', veg: '', other: '' }, dietPairRes: null
  };
  /* 体检基线体重：有身体档案且体重曲线为空时，把体检当天体重作为趋势起点 */
  (function seedProfile() {
    if (S.health && !Object.keys(S.weights).length && PROFILE.examDate && PROFILE.weight) {
      S.weights[PROFILE.examDate] = PROFILE.weight; saveK('fit_weight', S.weights);
    }
  })();
  /* v33 启动自愈：有身体档案但计划缺失、或计划从未按档案生成过（旧版本遗留）时，
     开机即按档案参数补齐训练计划——不再依赖"必须再点一次保存"。
     已有进度的计划（手动生成/手动编辑/进阶周期/有训练打卡/RPE 反馈）一律不覆盖。 */
  (function ensureProfilePlan() {
    if (!S.health) return;
    S.form.goal = PROFILE.planGoal || (PROFILE.goal === '维持' ? '保持健康' : PROFILE.goal);
    if (PROFILE.levelCap) S.form.level = PROFILE.levelCap;
    if (PROFILE.planDays) S.form.day = PROFILE.planDays;
    var hasProgress = !!S.plan && (S.plan.fromHealth || S.plan.manual || S.plan.edited || (S.plan.cycle || 1) > 1 ||
      S.records.some(function (r) { return r.tag && r.tag.indexOf('fit_plan_') === 0; }) || S.rpeLog.length > 0);
    if (!S.plan || !hasProgress) {
      var want = { goal: S.form.goal, days: S.form.day, length: S.form.length, level: rpeBiasLevel(S.form.level), venue: S.form.venue === '🏋️ 健身房' ? 'gym' : 'home' };
      S.plan = generatePlan(want, histForPlan());
      S.plan.fromHealth = true;
      if (S.recoveryOn) applyRecovery(S.plan);
      S.weekIdx = 0; saveK(KP, S.plan);
    }
  })();
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
  var APP_VER = 'v34';
  var TABS = [{ k: 'home', i: '🏠', l: '首页' }, { k: 'train', i: '🏋️', l: '训练' }, { k: 'plan', i: '🗓️', l: '计划' }, { k: 'diet', i: '🍱', l: '饮食' }, { k: 'record', i: '📈', l: '记录' }];
  function tabTitle() {
    if (S.tab === 'home') return '健身教练';
    if (S.tab === 'train') return '训练';
    if (S.tab === 'plan') return S.plan ? '我的 4 周计划' : 'AI 定制计划';
    if (S.tab === 'diet') return '饮食规划';
    return '我的记录';
  }
  function applyTheme() {
    var p = document.querySelector('.phone');
    if (p) p.classList.toggle('dark', S.theme === 'dark');
  }
  function renderShell() {
    applyTheme();
    app.innerHTML =
      '<div id="topbar">' + esc(tabTitle()) + '<span class="tb-sub">网页预览 · 同款引擎</span><span class="tb-theme" data-a="toggleTheme" title="深浅色切换">' + (S.theme === 'dark' ? '☀️' : '🌙') + '</span></div>' +
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
    /* 保持滚动位置与输入焦点：点勾选/打卡/换一批不再跳顶（tab 切换走 renderShell 重建 #view，自然回顶） */
    var sy = v.scrollTop;
    var ae = document.activeElement, fk = (ae && ae.getAttribute) ? ae.getAttribute('data-k') : null;
    var caret = (ae && typeof ae.selectionStart === 'number') ? ae.selectionStart : null;
    if (S.tab === 'home') v.innerHTML = vHome();
    else if (S.tab === 'train') v.innerHTML = vTrain();
    else if (S.tab === 'plan') v.innerHTML = S.plan ? vPlanResult() : vPlanForm();
    else if (S.tab === 'diet') v.innerHTML = vDiet();
    else v.innerHTML = vRecord();
    v.scrollTop = sy;
    if (fk) {
      var nf = v.querySelector('.fld[data-k="' + fk + '"]');
      if (nf) { nf.focus(); if (caret != null && typeof nf.setSelectionRange === 'function') { try { nf.setSelectionRange(caret, caret); } catch (e2) {} } }
    }
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
    // 续练卡片：上次中途退出且有实质进度时显示（12 小时内有效）
    var rs = loadK('fit_resume', null);
    var resumeCard = (rs && rs.seq && rs.seq.length && rs.done > 0 && Date.now() - rs.ts < 12 * 3600e3)
      ? '<div class="card resume-card"><div class="rc-l">⏸ 上次练到一半</div><div class="rc-t">' + (rs.icon || '🏋️') + ' ' + esc(rs.title) + '</div>' +
        '<div class="rc-m">已完成 ' + rs.done + '/' + rs.seq.length + ' 个动作 · 进度已保存</div>' +
        '<div class="rc-btns"><div class="btn" data-a="resumeRun">继续训练 ▸</div><div class="btn ghost" data-a="resumeDismiss">忽略</div></div></div>'
      : '';
    // 今日饮食入口（首页直达，Keep 式预算视角）
    var mealTeaser = '';
    if (!S.dietFormOpen) {
      ensureDiet();
      var th = todayMeals();
      var dlh = dayLog(), eatenH = logKcal(dlh), budgetH = th.dayK + todayBurn(), leftH = Math.round(budgetH - eatenH);
      var recItems = dlh.items.slice(-4).map(function (x) { return x.n; });
      var chipsH = (recItems.length ? recItems : [th.bf.n, th.lunch.n, th.dinner.n]).map(function (mn) {
        return '<span style="font-size:11px;padding:3px 9px;border-radius:999px;background:var(--bg);color:var(--ink)">' + esc(mn) + '</span>';
      }).join('');
      mealTeaser = '<div class="card" data-a="tab" data-v="diet" style="cursor:pointer">' +
        '<div style="display:flex;align-items:center;margin-bottom:4px"><b style="font-size:13.5px">🍱 今日饮食</b>' +
        '<span style="margin-left:auto;font-size:12px;font-weight:800;color:' + (leftH < 0 ? '#e05a4e' : '#0fb98c') + '">' + (leftH < 0 ? '超 ' + (-leftH) : '还能吃 ' + leftH) + ' 千卡</span></div>' +
        '<div style="font-size:10.5px;color:#8d959e;margin-bottom:7px">已吃 ' + eatenH + ' / 预算 ' + budgetH + ' 千卡 · 点开记录 ▸</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' + chipsH + '</div></div>';
    }
    return heroHtml + resumeCard +
      '<div class="stats-row"><div class="stat"><div class="n">' + minToday + '</div><div class="l">今日分钟</div></div>' +
      '<div class="stat"><div class="n">' + mdays + '</div><div class="l">本月练次</div></div>' +
      '<div class="stat"><div class="n">' + recCount + '</div><div class="l">动作有纪录</div></div>' +
      '<div class="stat"><div class="n">' + (streak() || 0) + '</div><div class="l">连续打卡</div></div></div>' +
      mealTeaser +
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
  var EQUIPS = ['全部', '徒手', '哑铃', '弹力带', '壶铃', '器械'];
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
    var mus = ['⭐', '全部', '胸·肩', '臀·腿', '背·臂', '核心', '拉伸', '全身'];
    var chips = mus.map(function (m) { return '<span class="chip ' + (S.actMus === m ? 'on' : '') + '" data-a="mus" data-v="' + m + '">' + (m === '⭐' ? '⭐ 收藏' : m) + '</span>'; }).join('');
    var filtered = list.filter(function (a) { return equipOk(a) && (S.actMus === '全部' || (S.actMus === '⭐' ? S.favs.indexOf(a.name) >= 0 : (musclesOf(a) || '').indexOf(S.actMus) >= 0)) && (!S.actQ || a.name.indexOf(S.actQ) >= 0); });
    var rows = filtered.map(function (a) {
      var isFav = S.favs.indexOf(a.name) >= 0;
      return '<div class="act-row" data-a="actInfo" data-name="' + esc(a.name) + '"><div class="a-ic">' + a.icon + '</div>' +
        '<div><div class="a-n">' + (isFav ? '⭐ ' : '') + esc(a.name) + '</div><div class="a-s">' + (a.type === 'reps' ? a.value + ' 次' : a.value + ' 秒') + ' · ' + esc(musclesOf(a)) + ' · ' + esc(a.equip || '徒手') + '</div></div>' +
        (a.gif ? '<div class="a-g">' + mediaTag(a.gif, a.icon) + '</div>' : '') + '<div class="a-go">›</div></div>';
    }).join('');
    return seg + equipChips() + '<div style="height:6px"></div>' + '<input id="actSearch" class="srch-in" placeholder="🔍 搜索动作名…" value="' + esc(S.actQ || '') + '">' + '<div class="chips">' + chips + '</div><div style="height:10px"></div>' + (rows || '<div class="empty" id="actEmpty"><div class="e-ic">🤸</div>该筛选条件下暂无动作</div>');
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
    var goalHtml = '';
    if (latest != null) {
      if (S.wGoal) {
        var rem = Math.round((S.wGoal - latest) * 10) / 10;
        var diff = Math.round((latest - S.wGoal) * 10) / 10;
        var etaTxt = '';
        if (days.length >= 8) {
          var span = Math.max(2, days.length - 8);
          var slope = (latest - w[days[Math.max(0, days.length - 8)]]) / span; /* kg/天 */
          if (Math.abs(rem) < 0.05) etaTxt = ' · 🎉 已达成目标';
          else if (Math.abs(slope) > 0.01 && rem * slope < 0) etaTxt = ' · 按当前趋势约 ' + Math.ceil(Math.abs(rem / slope)) + ' 天达成';
          else etaTxt = ' · 按当前趋势暂难达成，调整下饮食/训练吧';
        } else etaTxt = ' · 再记 ' + (8 - days.length) + ' 天可预估达成时间';
        goalHtml = '<div style="font-size:11.5px;margin-top:6px;color:' + (Math.abs(rem) < 0.05 ? '#0fb98c' : '#4a525c') + '">🎯 目标 ' + S.wGoal + ' kg · ' + (Math.abs(diff) < 0.05 ? '已达成 🎉' : (diff > 0 ? '还需减 ' + diff : '还需增 ' + (-diff)) + ' kg') + etaTxt + '</div>';
      } else goalHtml = '<div style="font-size:11.5px;margin-top:6px;color:#7a838e">设一个目标体重，追踪达成进度 →</div>';
    }
    return '<div class="card"><div class="form-t" style="margin:0 0 8px">⚖️ 体重记录</div>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      (latest != null ? '<div><span style="font-size:26px;font-weight:800;color:var(--ink)">' + latest + '</span><span style="font-size:11px;color:#7a838e"> kg · 最新</span></div>' + d7 : '<div style="font-size:12px;color:#7a838e">记录第一笔体重，开始追踪趋势</div>') +
      '</div>' + spark + goalHtml +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<input type="number" step="0.1" id="wgtIn" class="fld" style="flex:1" placeholder="今日体重 kg">' +
      '<input type="number" step="0.1" id="wgoalIn" class="fld" style="flex:1" placeholder="目标体重' + (S.wGoal ? ' ' + S.wGoal : '') + ' kg">' +
      '<div class="btn" style="padding:9px 18px" data-a="weightSave">记录</div></div></div>';
  }

  /* ===== 体重里程碑（v30）：按「起点 → 目标」动态算三档，通用不写死具体 kg =====
     起点 = 体重曲线最早一条（有身体档案时会自动种入体检当天体重），目标 = S.wGoal。
     增重与减重同构：越过该档位即解锁。三档 = 进度的 1/3、2/3、100%。 */
  function weightProgress() {
    var ks = Object.keys(S.weights || {}).sort();
    if (!ks.length) return null;
    var start = Number(S.weights[ks[0]]) || 0;
    var goal = Number(S.wGoal) || Number(PROFILE.weightGoal) || 0;
    if (!start || !goal) return null;
    var span = Math.abs(goal - start);
    if (span < 0.5) return null; /* 目标与起点几乎一样，不设里程碑 */
    var up = goal > start;
    var cur = Number(S.weights[ks[ks.length - 1]]) || start;
    var seen = {}, steps = [];
    [1 / 3, 2 / 3, 1].forEach(function (p) {
      var v = Math.round((up ? start + span * p : start - span * p) * 10) / 10;
      if (seen[v]) return;
      seen[v] = 1;
      steps.push({ v: v, ok: up ? cur >= v - 0.05 : cur <= v + 0.05 });
    });
    return { start: start, cur: cur, goal: goal, up: up, steps: steps };
  }

  /* ============ 成就徽章（#21）：数据全来自 records/best/streak/dietLog，纯展示层 ============ */
  function badgeDefs() {
    var totalMin = S.records.reduce(function (a, r) { return a + (r.min || 0); }, 0);
    var uniq = {};
    S.records.forEach(function (r) { (r.detail || []).forEach(function (x) { uniq[x.name] = 1; }); });
    var nPR = Object.keys(S.best).filter(function (n) { return S.best[n].best > 0; }).length;
    var dietDays = Object.keys(S.dietLog).filter(function (k) { var d = S.dietLog[k]; return d && (d.bf || d.lunch || d.dinner || d.snack); }).length;
    var stk = streak() || 0;
    /* 体重里程碑：数字由本机曲线与目标算出，代码里不含任何个人数值 */
    var wp = weightProgress();
    var wMeta = [['📈', '体重第一阶'], ['💪', '体重过半'], ['🏆', '体重达标']];
    var wDefs = wMeta.map(function (m, i) {
      var s = wp && wp.steps[i];
      if (!s) return { id: 'wt' + i, ic: m[0], n: m[1], d: '先记录体重并设定目标', ok: false, p: 0 };
      var done = Math.abs(wp.cur - wp.start), need = Math.abs(s.v - wp.start);
      return { id: 'wt' + i, ic: m[0], n: m[1], d: (wp.up ? '体重达到 ' : '体重降到 ') + s.v + ' kg', ok: s.ok, p: need ? Math.min(1, done / need) : 0 };
    });
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
    ].concat(wDefs);
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

  /* ============ RPE 疲劳反馈闭环（#31）：练完感受 → 引擎自适应强度 ============ */
  function rpeBiasLevel(base) {
    var levels = ['新手', '进阶', '老手'];
    var idx = levels.indexOf(base); if (idx < 0) idx = 1;
    var last = S.rpeLog.slice(-3);
    if (last.length < 2) return base;
    var h = last.filter(function (r) { return r.v === 'hard'; }).length;
    var e = last.filter(function (r) { return r.v === 'easy'; }).length;
    if (h === last.length && idx > 0) { S.rpeApplied = 'down'; return levels[idx - 1]; }
    if (e === last.length && idx < 2) { S.rpeApplied = 'up'; return levels[idx + 1]; }
    S.rpeApplied = null; return base;
  }
  function rpeVote(v) {
    S.rpeLog.push({ date: todayStr(), ts: Date.now(), v: v });
    S.rpeLog = S.rpeLog.slice(-40); saveK('fit_rpe', S.rpeLog);
    W.rpeVoted = true; renderW();
    var last = S.rpeLog.slice(-3);
    var h = last.filter(function (r) { return r.v === 'hard'; }).length;
    var e = last.filter(function (r) { return r.v === 'easy'; }).length;
    var order = ['light', 'std', 'hard'], di = order.indexOf(S.diff);
    if (last.length >= 3 && h === 3 && di > 0) { S.diff = order[di - 1]; saveK('fit_diff', S.diff); toast('记录了「很累」×3 · 下次训练已自动下调难度档 😌'); }
    else if (last.length >= 3 && e === 3 && di < 2) { S.diff = order[di + 1]; saveK('fit_diff', S.diff); toast('记录了「轻松」×3 · 下次训练已自动上调难度档 💪'); }
    else toast(v === 'hard' ? '收到，注意恢复 💤' : v === 'easy' ? '收到，下次可以更拼 💪' : '收到，保持这个节奏 👌');
  }

  /* ============ 计划 ============ */
  var GOALS = ['减脂', '增肌', '塑形', '保持健康', '拉伸放松'], DAYS = [3, 4, 5, 6], LENS = [15, 30, 45], LEVELS = ['新手', '进阶', '老手'], VENUES = ['🏠 居家', '🏋️ 健身房'];
  function chipRow(arr, key, fmt) {
    return '<div class="chips">' + arr.map(function (v) {
      return '<span class="chip ' + (S.form[key] === v ? 'on' : '') + '" data-a="form" data-k="' + key + '" data-v="' + v + '">' + fmt(v) + '</span>';
    }).join('') + '</div>';
  }
  function vPlanForm() {
    return '<div class="form-t">📍 训练场景</div>' + chipRow(VENUES, 'venue', function (v) { return v; }) +
      '<div class="form-t">🎯 目标</div>' + chipRow(GOALS, 'goal', function (v) { return v; }) +
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
      '<div class="card" style="font-size:12px;color:#4a525c;line-height:1.7">' + esc(p.venueNote || '') + (S.rpeApplied ? '<br>🧠 根据你近 3 次训练反馈，难度已自动' + (S.rpeApplied === 'down' ? '下调' : '上调') : '') + '<br>💬 ' + esc(p.levelNote) + '<br>🔁 ' + esc(p.weeksNote) + '</div>' + days +
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
  /* ============ 训练热力图（#32）：近半年打卡密度，颜色=当日训练分钟 ============ */
  function heatmap() {
    var byDay = {};
    S.records.forEach(function (r) { byDay[r.date] = (byDay[r.date] || 0) + (r.min || 15); });
    var today = new Date(); today.setHours(23, 59, 59, 999);
    var d = new Date(today); d.setDate(d.getDate() - 26 * 7);
    while (d.getDay() !== 1) d.setDate(d.getDate() - 1); /* 对齐周一 */
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var weeks = [];
    for (var ci = 0; ci < 27; ci++) {
      var col = [];
      for (var ri = 0; ri < 7; ri++) {
        var key = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        col.push(d > today ? null : (byDay[key] || 0));
        d.setDate(d.getDate() + 1);
      }
      weeks.push(col);
    }
    var rects = weeks.map(function (col, ci) {
      return col.map(function (v, ri) {
        if (v === null) return '';
        var c = v === 0 ? 'var(--line)' : v < 20 ? '#bfe8da' : v < 35 ? '#6fd3b4' : v < 50 ? '#2cc294' : '#0fb98c';
        return '<rect x="' + (ci * 15 + 4) + '" y="' + (ri * 15 + 4) + '" width="11" height="11" rx="2.5" fill="' + c + '"/>';
      }).join('');
    }).join('');
    var total = Object.keys(byDay).length;
    return '<div class="card"><div class="form-t" style="margin:0 0 6px">🗓 训练热力图 <span style="font-size:10px;color:#8d959e;margin-left:6px">近半年 · ' + total + ' 天练过</span></div>' +
      '<svg viewBox="0 0 409 113" style="width:100%">' + rects + '</svg>' +
      '<div style="font-size:10px;color:#8d959e;margin-top:4px">▢ 少 ▢▢▢▢ 多 · 颜色深浅 = 当日训练分钟</div></div>';
  }
  /* ============ 体能测试（#35）：每月记录三项体质指标，追踪进步 ============ */
  function fitTestCard() {
    var f = S.fitness, last = f[f.length - 1], prev = f.length > 1 ? f[f.length - 2] : null;
    var items = [['pushup', '俯卧撑最大次数', '个'], ['plank', '平板支撑', '秒'], ['squat', '一分钟深蹲', '个']];
    var rows = items.map(function (it) {
      var k = it[0], v = last ? last[k] : null;
      var delta = '';
      if (last && prev && last[k] != null && prev[k] != null) {
        var df = last[k] - prev[k];
        delta = '<span style="margin-left:auto;font-size:12px;font-weight:800;color:' + (df > 0 ? '#0fb98c' : df < 0 ? '#e08a00' : '#8d959e') + '">' + (df > 0 ? '↑' : df < 0 ? '↓' : '—') + ' ' + Math.abs(df) + '</span>';
      }
      return '<div class="ft-row" style="display:flex;margin-top:6px;align-items:baseline"><div style="flex:1"><div style="font-size:11px;color:#8d959e">' + it[1] + '</div><div style="font-size:18px;font-weight:800;color:var(--ink)">' + (v != null ? v + ' ' + it[2] : '—') + '</div></div>' + delta + '</div>';
    }).join('');
    return '<div class="card"><div class="form-t" style="margin:0 0 4px">🏋️ 体能测试 <span style="font-size:10px;color:#8d959e;margin-left:6px">' + (f.length ? '最近 ' + last.date : '建议每月测一次') + '</span></div>' + rows +
      '<div style="display:flex;gap:6px;margin-top:10px">' +
      '<input type="number" id="ftPush" class="fld" placeholder="俯卧撑·个">' +
      '<input type="number" id="ftPlank" class="fld" placeholder="平板·秒">' +
      '<input type="number" id="ftSquat" class="fld" placeholder="深蹲·个"></div>' +
      '<div class="btn" style="margin-top:8px;text-align:center" data-a="fitTestSave">记录本次体测</div></div>';
  }
  /* ============ 周报分享图（#33）：canvas 生成近 7 天训练总结卡片 ============ */
  function weeklyReport() {
    var now = new Date();
    var from = new Date(now); from.setDate(now.getDate() - 6);
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var key = function (dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); };
    var inRange = S.records.filter(function (r) { return r.date >= key(from) && r.date <= key(now); });
    var mins = inRange.reduce(function (a, r) { return a + (r.min || 0); }, 0);
    var kcalc = inRange.reduce(function (a, r) { return a + (r.kcal || 0); }, 0);
    /* 上周对比 */
    var pf = new Date(from); pf.setDate(from.getDate() - 7);
    var pt = new Date(from); pt.setDate(from.getDate() - 1);
    var prevMins = S.records.filter(function (r) { return r.date >= key(pf) && r.date <= key(pt); }).reduce(function (a, r) { return a + (r.min || 0); }, 0);
    var cmp = prevMins ? Math.round((mins - prevMins) / prevMins * 100) : null;
    /* 每日分钟柱状 */
    var daily = [];
    for (var i = 0; i < 7; i++) { var dd = new Date(from); dd.setDate(from.getDate() + i); daily.push({ d: dd, min: byKeyMin(key(dd)) }); }
    function byKeyMin(k2) { return S.records.filter(function (r) { return r.date === k2; }).reduce(function (a, r) { return a + (r.min || 0); }, 0); }
    var wK = Object.keys(S.weights).sort();
    var wA = wK.length >= 2 ? S.weights[wK[wK.length - 1]] - S.weights[wK[Math.max(0, wK.length - 8)]] : null;
    var c = document.createElement('canvas'); c.width = 750; c.height = 960;
    var x = c.getContext('2d');
    /* 背景 */
    var g = x.createLinearGradient(0, 0, 0, 960); g.addColorStop(0, '#0e5c46'); g.addColorStop(1, '#0b3a2e');
    x.fillStyle = g; x.fillRect(0, 0, 750, 960);
    x.fillStyle = '#1FD6A8'; x.font = 'bold 40px sans-serif'; x.fillText('💪 我的训练周报', 48, 92);
    x.fillStyle = '#9fd8c6'; x.font = '22px sans-serif';
    x.fillText(key(from).slice(5) + ' ~ ' + key(now).slice(5) + ' · 健身教练网页版', 48, 130);
    /* 大数字区 */
    var cards = [
      [inRange.length + ' 次', '本周训练'], [mins + ' 分钟', '总时长'], [kcalc + ' 千卡', '消耗']
    ];
    cards.forEach(function (cd, i2) {
      var cx = 48 + i2 * 222;
      x.fillStyle = 'rgba(255,255,255,0.08)';
      x.beginPath(); x.roundRect ? x.roundRect(cx, 170, 202, 120, 18) : x.rect(cx, 170, 202, 120); x.fill();
      x.fillStyle = '#fff'; x.font = 'bold 34px sans-serif'; x.fillText(cd[0], cx + 20, 226);
      x.fillStyle = '#9fd8c6'; x.font = '19px sans-serif'; x.fillText(cd[1], cx + 20, 262);
    });
    /* 对比行 */
    x.fillStyle = '#fff'; x.font = '24px sans-serif';
    x.fillText('🔥 连续打卡 ' + streak() + ' 天' + (cmp !== null ? '　训练时长较上周 ' + (cmp >= 0 ? '↑ +' : '↓ ') + cmp + '%' : ''), 48, 350);
    if (wA !== null) x.fillText('⚖️ 近期体重 ' + (wA > 0 ? '+' : '') + Math.round(wA * 10) / 10 + ' kg' + (S.wGoal ? ' · 目标 ' + S.wGoal + ' kg' : ''), 48, 392);
    /* 每日柱状图 */
    x.fillStyle = '#9fd8c6'; x.font = 'bold 24px sans-serif'; x.fillText('每日训练分钟', 48, 470);
    var mx = Math.max.apply(null, daily.map(function (o) { return o.min; }).concat([30]));
    daily.forEach(function (o, i3) {
      var bx = 48 + i3 * 94, bh = Math.max(4, Math.round(o.min / mx * 300));
      x.fillStyle = o.min ? '#1FD6A8' : 'rgba(255,255,255,0.15)';
      x.beginPath(); x.roundRect ? x.roundRect(bx, 800 - bh, 56, bh, 10) : x.rect(bx, 800 - bh, 56, bh); x.fill();
      x.fillStyle = '#9fd8c6'; x.font = '18px sans-serif';
      x.fillText(['日', '一', '二', '三', '四', '五', '六'][o.d.getDay()], bx + 20, 836);
      if (o.min) { x.fillStyle = '#fff'; x.fillText(o.min, bx + 12, 792 - bh); }
    });
    /* RPE 情绪 */
    var rpes = S.rpeLog.filter(function (r) { return r.date >= key(from); });
    if (rpes.length) {
      var em = { easy: '😌', ok: '🙂', hard: '😵' };
      var line = '本次感受：' + rpes.map(function (r) { return em[r.v] || '·'; }).join(' ');
      x.fillStyle = '#fff'; x.font = '24px sans-serif'; x.fillText(line, 48, 900);
    }
    x.fillStyle = '#6fbfa8'; x.font = '18px sans-serif'; x.fillText('— 每一次训练，都是在给未来的自己存款 —', 48, 936);
    var url = c.toDataURL('image/png');
    openSheet('<div class="sh-h"><div class="sh-t">📊 我的训练周报</div><div class="x" data-a="xSheet">✕</div></div>' +
      '<div class="sh-sub">长按图片保存 / 分享到朋友圈</div>' +
      '<img src="' + url + '" style="width:100%;border-radius:14px;display:block">');
  }

  /* ============ 训练提醒（#37）：定时 Notification（页面/PWA 打开期间生效） ============ */
  function remindCard() {
    var r = S.remind || { on: false, time: '19:30' };
    var perm = ('Notification' in window) ? Notification.permission : 'unsupported';
    return '<div class="card"><div class="form-t" style="margin:0 0 8px">⏰ 每日训练提醒</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<div class="btn ' + (r.on ? '' : 'ghost') + '" style="padding:9px 16px" data-a="remindToggle">' + (r.on ? '✅ 已开启' : '🔕 未开启') + '</div>' +
      '<input type="time" id="remindTime" class="fld" style="flex:1" value="' + esc(r.time) + '">' +
      '<div class="btn" style="padding:9px 16px" data-a="remindSave">保存</div></div>' +
      '<div style="font-size:10.5px;color:#8d959e;margin-top:6px">' + (perm === 'unsupported' ? '当前浏览器不支持通知（建议用手机 Chrome + 添加到主屏幕）' : perm === 'denied' ? '通知权限已被拒绝，请在浏览器设置中允许' : '网页打开期间生效 · 保存时会请求通知权限') + '</div></div>';
  }
  function remindLoop() {
    if (remindLoop._t) return;
    /* 惰性启动：未开启提醒/无权限时绝不装定时器（避免 jsdom 测试进程被挂住） */
    if (!S.remind || !S.remind.on) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    remindLoop._t = setInterval(function () {
      var r = S.remind;
      if (!r || !r.on) return;
      var now = new Date(), pad = function (n) { return String(n).padStart(2, '0'); };
      var hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
      var fired = loadK('fit_remind_fired', '');
      if (hm < r.time || fired === todayStr()) return;
      var trained = S.records.some(function (x) { return x.date === todayStr(); });
      if (trained) return;
      try { new Notification('⏰ 该练今天的主项了', { body: '今天还没训练——打开健身教练，10 分钟就够' }); } catch (e) {}
      saveK('fit_remind_fired', todayStr());
    }, 30000);
    var t = remindLoop._t; if (t && t.unref) t.unref();
  }

  function healthForm() {
    var d = S.healthDraft || {};
    var numF = function (k, label, ph, step) {
      /* 骨密度 T 值 0 是合法值，不能用 || 兜底吞成空串 */
      var vv = (d[k] || d[k] === 0) ? String(d[k]) : '';
      return '<div style="flex:1;min-width:0"><div style="font-size:11px;color:#7a838e;margin-bottom:3px">' + label + '</div><input class="fld" type="number" inputmode="decimal" step="' + (step || '1') + '" data-k="' + k + '" value="' + vv + '" placeholder="' + ph + '"></div>';
    };
    return '<div class="card ha-form"><div class="form-t" style="margin:0 0 8px">🩺 身体数据分析器 <span class="more">数据仅存本机</span></div>' +
      '<div style="font-size:11.5px;color:#7a838e;line-height:1.7;margin:0 0 10px">粘贴体检报告文字可自动提取指标；也可以手动填。身高体重必填，其余选填。<b style="font-weight:600">识别到哪几项就分析哪几项</b>——报告里没有的项目会自动跳过，不会出现空条目，也不影响其他指标。</div>' +
      '<div class="form-t">📋 粘贴体检报告文字（可选）</div>' +
      '<textarea id="reportPaste" rows="4" style="width:100%;box-sizing:border-box;border:1px solid rgba(127,127,127,.25);border-radius:10px;padding:8px;font-size:12px;background:var(--bg);color:var(--ink)" placeholder="把报告里的数值部分复制进来，如：身高 172 体重 65 收缩压 118 舒张压 75 脉搏 72 尿酸 350 空腹血糖 5.2 …"></textarea>' +
      '<div class="btn ghost" data-a="healthParse" style="margin-top:6px;text-align:center;font-size:12px">🔎 自动提取指标</div>' +
      '<div class="form-t" style="margin-top:12px">⚧ 性别 / 🎂 年龄</div><div class="flds"><input class="fld" type="number" inputmode="numeric" data-k="age" value="' + (d.age || '') + '" placeholder="年龄（岁）" style="flex:1">' + chipRowSel(['男', '女'], 'gender', d.gender, 'hform') + '</div>' +
      '<div class="form-t">📏 身高（cm）/ ⚖️ 体重（kg）</div><div class="flds">' + numF('height', '身高 cm', '175', '0.1') + numF('weight', '体重 kg', '70', '0.1') + '</div>' +
      '<div class="form-t">🏃 日常活动量 / 🎯 目标（可覆盖）</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + chipRowSel(['久坐', '轻度', '中度', '高强度'], 'activity', d.activity, 'hform') + chipRowSel(['减脂', '增肌', '维持'], 'goal', d.goal, 'hform') + '</div>' +
      '<div class="form-t">❤️ 血压与心率（选填）</div><div class="flds">' + numF('sys', '收缩压', '114') + numF('dia', '舒张压', '70') + numF('hr', '静息心率', '70') + '</div>' +
      '<div class="form-t">🧪 化验指标（选填）</div><div class="flds">' + numF('ua', '尿酸 μmol/L', '350') + numF('glu', '空腹血糖', '5.0', '0.1') + numF('ggt', 'GGT U/L', '30') + '</div>' +
      '<div class="form-t">🩸 血脂四项（选填 · 报告里有才填）</div><div class="flds">' + numF('tc', '总胆固醇', '5.0', '0.01') + numF('tg', '甘油三酯', '1.2', '0.01') + '</div>' +
      '<div class="flds">' + numF('hdl', '高密度 HDL', '1.3', '0.01') + numF('ldl', '低密度 LDL', '3.0', '0.01') + '</div>' +
      '<div class="form-t">📊 体成分 / 🦴 骨密度（选填）</div><div class="flds">' + numF('bfp', '体脂率 %', '20', '0.1') + numF('bmd', '骨密度 T 值', '0', '0.1') + '</div>' +
      '<div class="form-t">📅 检查日期（选填）</div><div class="flds"><input class="fld" type="date" data-k="examDate" value="' + (d.examDate || '') + '"></div>' +
      '<div class="btn" data-a="healthSave" style="margin-top:10px;text-align:center">✅ 分析并应用到方案</div>' +
      '<div class="btn ghost" data-a="healthCancel" style="margin-top:6px;text-align:center;font-size:12px">取消</div></div>';
  }
  function healthCard() {
    if (S.healthOpen) return healthForm();
    var head = '<div class="card pf-card"><div class="form-t" style="margin:0 0 8px">🩺 身体数据分析器 <span class="more">' + (PROFILE.examDate ? '体检 ' + PROFILE.examDate : '数据仅存本机') + '</span></div>';
    if (!S.health) {
      return head + '<div style="font-size:11.5px;color:#7a838e;line-height:1.7;margin:4px 0 10px">填入身高体重、血压心率、尿酸血糖等指标（或直接粘贴体检报告文字自动提取），点「分析」后<b>自动生成</b>专属训练计划与饮食方案——无需再去别页手填。数据只保存在这台设备，不上传、不进代码。</div>' +
        '<div class="btn" data-a="healthOpen" style="text-align:center">🔍 开始分析我的数据</div></div>';
    }
    var bmiTxt = PROFILE.bmi < 18.5 ? '偏瘦' : PROFILE.bmi < 24 ? '正常' : PROFILE.bmi < 28 ? '超重' : '肥胖';
    var html = head + '<div class="pf-row"><div class="pf-b"><div class="n">' + PROFILE.height + '</div><div class="l">身高 cm</div></div>' +
      '<div class="pf-b"><div class="n">' + PROFILE.weight + '</div><div class="l">体重 kg</div></div>' +
      '<div class="pf-b"><div class="n">' + PROFILE.bmi + '</div><div class="l">BMI ' + bmiTxt + '</div></div>' +
      '<div class="pf-b"><div class="n">' + PROFILE.weightGoal + '</div><div class="l">目标 kg</div></div></div>' +
      '<div style="font-size:11px;color:#7a838e;margin:6px 0 4px;line-height:1.6">方向：' + PROFILE.goal + ' · 每日饮水 ' + (PROFILE.water / 1000).toFixed(1) + 'L · 理想体重约 ' + PROFILE.idealWeight + 'kg<br>' + (S.plan ? '✅ 训练计划与饮食方案已按以上数据自动生成，下方入口可直接查看' : '⚠️ 训练计划尚未生成——打开「计划」页即可按以上数据补齐') + '</div>';
    /* 可选指标：报告里识别到哪几项就显示哪几项，一项都没有则整块不出现 */
    var hChips = [], LV_C = { ok: '#0fb98c', edge: '#e08a00', high: '#e05a4e', low: '#e05a4e' }, LV_A = { ok: '✓', edge: '↑', high: '↑', low: '↓' }, LV_N = { ok: '正常', edge: '边缘', high: '偏高', low: '偏低' };
    var chipOne = function (label, val, unit, lv) {
      return '<span style="font-size:11px;padding:3px 8px;border-radius:8px;background:' + LV_C[lv] + '1a;color:' + LV_C[lv] + ';font-weight:600">' +
        esc(label) + ' ' + val + (unit || '') + ' ' + LV_A[lv] + ' ' + LV_N[lv] + '</span>';
    };
    var lp0 = PROFILE.lipid;
    if (lp0) {
      if (lp0.tcLv) hChips.push(chipOne('总胆固醇', lp0.tc, '', lp0.tcLv));
      if (lp0.tgLv) hChips.push(chipOne('甘油三酯', lp0.tg, '', lp0.tgLv));
      if (lp0.hdlLv) hChips.push(chipOne('HDL', lp0.hdl, '', lp0.hdlLv));
      if (lp0.ldlLv) hChips.push(chipOne('LDL', lp0.ldl, '', lp0.ldlLv));
    }
    if (PROFILE.bfp) hChips.push(chipOne('体脂率', PROFILE.bfp, '%', PROFILE.bfpLv));
    if (PROFILE.bmd != null) {
      var tLv = PROFILE.bmd <= -2.5 ? 'high' : PROFILE.bmd < -1 ? 'edge' : 'ok';
      hChips.push(chipOne('骨密度 T 值', PROFILE.bmd, '', tLv));
    }
    if (hChips.length) html += '<div style="font-size:12.5px;font-weight:600;margin:8px 0 4px">📋 体检指标</div><div style="display:flex;flex-wrap:wrap;gap:6px">' + hChips.join('') + '</div>';
    if (PROFILE.trainTips && PROFILE.trainTips.length) {
      html += '<div style="font-size:12.5px;font-weight:600;margin:8px 0 0">💪 锻炼建议</div>';
      html += PROFILE.trainTips.map(function (t) {
        return '<div style="display:flex;gap:8px;padding:8px 0;border-top:1px solid rgba(127,127,127,.12)">' +
          '<span style="font-size:15px">' + t.i + '</span><div><div style="font-size:12.5px;font-weight:500">' + esc(t.t) + '</div>' +
          '<div style="font-size:11.5px;color:#7a838e;line-height:1.7;margin-top:2px">' + esc(t.d) + '</div></div></div>';
      }).join('');
      html += '<div style="display:flex;gap:8px;margin-top:6px"><div class="btn ghost" data-a="tab" data-v="plan" style="flex:1;text-align:center;font-size:12px">📋 查看训练计划</div><div class="btn ghost" data-a="tab" data-v="diet" style="flex:1;text-align:center;font-size:12px">🥗 查看饮食计划</div></div>';
    }
    html += '<div style="font-size:12.5px;font-weight:600;margin:8px 0 0">🥗 饮食与恢复建议</div>';
    html += PROFILE.tips.map(function (t) {
      return '<div style="display:flex;gap:8px;padding:8px 0;border-top:1px solid rgba(127,127,127,.12)">' +
        '<span style="font-size:15px">' + t.i + '</span><div><div style="font-size:12.5px;font-weight:500">' + esc(t.t) + '</div>' +
        '<div style="font-size:11.5px;color:#7a838e;line-height:1.7;margin-top:2px">' + esc(t.d) + '</div></div></div>';
    }).join('');
    html += '<div style="display:flex;gap:8px;margin-top:10px"><div class="btn ghost" data-a="healthOpen" style="flex:1;text-align:center">↻ 重新分析</div><div class="btn ghost" data-a="healthClear" style="flex:1;text-align:center;color:#e05a4e">🗑 清除我的数据</div></div></div>';
    return html;
  }
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
      '<div class="bk-btns" style="margin-top:8px"><div class="btn danger' + (resetArm ? ' armed' : '') + '" data-a="resetData">' + (resetArm ? '⚠️ 再点一次确认清空' : '🗑 清空全部数据') + '</div></div>' +
      '<div style="text-align:center;font-size:10px;color:#b0b6bd;margin-top:10px">健身教练 Web · ' + APP_VER + '（若与最新版本不符 = 手机在吃旧缓存，强制刷新即可）</div>' +
      '<input type="file" id="impFile" accept="application/json" style="display:none"></div>';
    return healthCard() + heatmap() + remindCard() + trendHtml() + fitTestCard() + prTrendHtml() + weightCard() + radarHtml + volHtml + backup +
      '<div class="btn" style="margin:0 0 10px;text-align:center" data-a="weeklyReport">📊 生成周报分享图</div>' +
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
    openSheet('<div class="sh-h"><div class="sh-t">' + (act ? act.icon : '🏋️') + ' ' + esc(name) + '</div><span class="fav-btn" data-a="toggleFav" data-name="' + esc(name) + '">' + (S.favs.indexOf(name) >= 0 ? '⭐' : '☆') + '</span><div class="x" data-a="xSheet">✕</div></div>' +
      '<div class="sh-sub">' + sub + ' · ' + esc(musclesOf({ name: name })) + ' · ' + esc(act && act.equip ? act.equip : '徒手') + '</div>' +
      (act && act.gif ? '<div class="demo">' + mediaTag(act.gif, act.icon) + '</div>' : '') +
      overloadHint(name, act && act.type) +
      '<div class="cue-box">💡 ' + esc((act && act.cue) || '保持核心收紧，动作标准优先于数量') + '</div>' +
      stepsHtml +
      variantChips(name) +
      '<div class="sh-go btn ghost" data-a="similarAct" data-name="' + esc(name) + '">🔄 换个同类动作试试</div>');
  }
  /* 同类替换（#34）：同肌群 + 难度 ±1 + 器材可用 + 有 GIF 的候选，随机挑一个 */
  function similarAct(name) {
    var lib = NS.ACT_LIB[name]; if (!lib) { toast('该动作暂无分组信息'); return; }
    var cand = Object.keys(NS.ACT_LIB).filter(function (n) {
      if (n === name) return false;
      var l = NS.ACT_LIB[n];
      return l.g === lib.g && !l.dup && Math.abs((l.d || 2) - (lib.d || 2)) <= 1 &&
        NS.actionByName[n] && NS.actionByName[n].gif && equipOk(NS.actionByName[n]);
    });
    if (!cand.length) { toast('同类动作都用上了，没有可替换的'); return; }
    var pick = cand[Math.floor(Math.random() * cand.length)];
    sheetAct(pick);
    toast('已换成同类动作：' + pick);
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
  /* 记录饮食 sheet：24 道菜品一键 + 搜索 + 自定义热量 */
  function sheetFood(meal) {
    S._foodMeal = meal;
    var dishes = allDishes();
    var rows = dishes.map(function (t) {
      return '<div class="food-row" data-name="' + esc(t.n) + '" data-a="foodPick" data-n="' + esc(t.n) + '" style="display:flex;align-items:center;padding:9px 4px;border-bottom:1px solid rgba(127,127,127,.12);cursor:pointer">' +
        '<span style="font-size:9px;color:#fff;background:var(--gd);border-radius:999px;padding:1px 7px;margin-right:8px;flex:none">' + t.tag + '</span>' +
        '<span style="font-size:12.5px;font-weight:600">' + esc(t.n) + '</span><span style="margin-left:auto;font-size:11px;color:var(--sub)">' + t.kcal + ' 千卡</span></div>';
    }).join('');
    openSheet('<div class="sh-h"><div class="sh-t">🍽 记录' + mealLabel(meal) + '</div><div class="x" data-a="xSheet">✕</div></div>' +
      '<input id="foodSearch" class="fld" placeholder="🔍 搜索菜品" style="width:100%;margin:0 0 6px">' +
      '<div id="foodList" style="max-height:300px;overflow-y:auto">' + rows + '</div>' +
      '<div class="form-t" style="margin:12px 0 6px">吃的没在库里？手动记一条</div>' +
      '<div style="display:flex;gap:8px"><input id="foodCn" class="fld" placeholder="名称，如 外卖" style="flex:2"><input id="foodCk" class="fld" type="number" inputmode="numeric" placeholder="千卡" style="flex:1"></div>' +
      '<div class="btn" data-a="foodCustom" style="margin-top:8px;text-align:center;padding:9px 0">＋ 加入' + mealLabel(meal) + '</div>');
  }
  function sheetRec(i) {    var r = S.records[i];
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
    clearResume();
    spStop();
    speak('训练完成，本次消耗约 ' + kcal + ' 千卡，完成 ' + done + ' 个动作');
    renderW();
  }
  function stopT() { if (WT) { clearInterval(WT); WT = null; } }
  /* 续练快照（#26）：中途退出时保存进度，首页可恢复 */
  function saveResume() {
    if (!W || W.phase === 'done' || !W.detail.length) return;
    var ni = W.i + (W.phase === 'rest' ? 1 : 0);
    if (ni >= W.seq.length) return;
    try { localStorage.setItem('fit_resume', JSON.stringify({
      seq: W.seq, firstMain: W.firstMain, title: W.title, icon: W.icon, kcal: W.kcal,
      bg: W.bg, tag: W.tag, rest: W.rest, ni: ni, detail: W.detail, done: W.detail.length, ts: Date.now()
    })); } catch (e) {}
  }
  function clearResume() { try { localStorage.removeItem('fit_resume'); } catch (e) {} }
  function resumeRun() {
    var r = loadK('fit_resume', null);
    if (!r || !r.seq || !r.seq.length) { toast('没有可恢复的训练'); return; }
    clearResume();
    startW(r.seq, r.title, r.icon, r.kcal, r.bg, r.tag, r.rest, null);
    W.firstMain = r.firstMain || 0;
    W.warmAck = r.ni >= W.firstMain;
    W.i = Math.max(0, Math.min(r.ni, r.seq.length - 1));
    W.detail = r.detail || [];
    renderW();
  }
  function closeW() {
    // 退出保护（#25）：有实质进度时先确认，防误触丢进度
    if (W && W.phase !== 'done' && W.phase !== 'ready' && W.detail.length > 0) {
      W._prev = { phase: W.phase, rem: W.rem };
      W.phase = 'confirmExit';
      renderW();
      return;
    }
    doCloseW();
  }
  function resumePrev() {
    if (W && W._prev) { W.phase = W._prev.phase; W.rem = W._prev.rem; W._prev = null; renderW(); }
    else if (W) enterAct();
  }
  function doCloseW() {
    saveResume();
    stopT(); keepAwake(false); W = null;
    $('#wko').classList.add('hide');
    S.tab = 'record'; renderShell();
  }
  /* 撤销（#27）：组间休息时可回退刚完成的动作重做 */
  function undoLast() {
    if (!W || !W.detail.length) return;
    W.detail.pop();
    W.i = Math.max(0, W.i - 1);
    if (W.i < W.firstMain) W.warmAck = false;
    enterAct();
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
        (W.rpeVoted ? '<div class="d-rec" style="background:#e8f7f2;color:#0b8a6a">✅ 反馈已记录，下次计划将参考本次感受</div>'
          : '<div style="font-size:12.5px;color:#9aa4ad;margin:10px 0 6px">这次训练感觉如何？（帮助引擎调整下次强度）</div>' +
            '<div style="display:flex;gap:8px;justify-content:center;width:100%">' +
            '<div class="wk-big" data-a="rpeVote" data-v="easy" style="width:96px;height:44px;font-size:13px;border-radius:12px;background:#e8f7f2;color:#0b8a6a">😌 轻松</div>' +
            '<div class="wk-big" data-a="rpeVote" data-v="ok" style="width:96px;height:44px;font-size:13px;border-radius:12px;background:#eef2f6;color:#3a424b">🙂 刚好</div>' +
            '<div class="wk-big" data-a="rpeVote" data-v="hard" style="width:96px;height:44px;font-size:13px;border-radius:12px;background:#fdeeea;color:#c0392b">😵 很累</div></div>') +
        '<div class="wk-ctrl" style="width:100%"><div class="wk-big" data-a="recDetail" data-i="0" style="width:150px;height:54px;font-size:14px">查看明细 ▸</div>' +
        '<div class="wk-mini" data-a="closeW">完成</div></div></div>';
    } else if (W.phase === 'confirmExit') {
      body = '<div class="wk-top"><div class="wk-title">' + esc(W.title) + '</div></div>' +
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 30px;text-align:center">' +
        '<div style="font-size:46px;margin-bottom:10px">⏸</div>' +
        '<div class="wk-act-name" style="margin-bottom:8px">训练进行中</div>' +
        '<div style="font-size:12.5px;color:#9aa4ad;line-height:1.8;margin-bottom:20px">已完成 ' + W.detail.length + ' / ' + W.seq.length + ' 个动作<br>退出后首页可「继续上次训练」恢复进度</div>' +
        '<div class="wk-big" data-a="resumePrev" style="width:180px;height:58px;border-radius:999px;font-size:16px">继续训练 ▸</div>' +
        '<div class="wk-mini" data-a="confirmExit" style="margin-top:16px;color:#ff7b6b">确认退出</div></div>';
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
      var optsHtml = (W.phase === 'rest') ? '<div class="wk-rest-opts">' +
        (W.detail.length ? '<div class="o" data-a="undoAct">↩ 撤销</div>' : '') +
        '<div class="o" data-a="restLess">−5s</div><div class="o" data-a="restMore">+10s</div><div class="o on" data-a="skipRest">跳过</div></div>' : '';
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
    var lp = mealFlags().indexOf('低嘌呤') >= 0;
    if (goal === '增肌') return [
      { c: '牛肉 + 糙米 + 彩椒', t: '优质蛋白 + 慢碳 + 维C促铁，增肌黄金三角' },
      { c: '鸡蛋 + 全麦面包 + 牛油果', t: '完整氨基酸 + 好脂肪，训练后恢复友好' },
      lp ? { c: '鸡胸 + 红薯 + 西兰花', t: '低嘌呤优质蛋白 + 慢碳，护尿酸也够增肌' }
        : { c: '三文鱼 + 红薯 + 西兰花', t: 'Omega-3 抗炎 + 慢碳 + 纤维，助合成' }
    ];
    if (goal === '维持') return [
      { c: '豆腐 + 杂粮 + 时蔬', t: '植物蛋白与谷物互补，清淡均衡' },
      { c: '鸡胸 + 藜麦 + 牛油果', t: '完全蛋白 + 好脂肪，饱腹不长胖' },
      lp ? { c: '鸡蛋 + 糙米 + 番茄', t: '低嘌呤完整蛋白 + 抗氧化物，日常稳态' }
        : { c: '鱼 + 糙米 + 番茄', t: '低脂优质蛋白 + 抗氧化物，日常稳态' }
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
  /* 常备食材（#39）：全集取自四餐库的全部食材，勾选后餐单优先按已有配 */
  function collectFoods() {
    var seen = {}, out = [];
    [BF, LUN, DIN, SNK].forEach(function (arr) { arr.forEach(function (t) { t.parts.forEach(function (p) {
      if (!seen[p.n]) { seen[p.n] = 1; out.push(p.n); }
    }); }); });
    return out;
  }
  var ALLFOODS = collectFoods();
  /* ===== 常备食材归一化（v29）=====
     菜品库把同一物写成了多个别名（鸡蛋/水煮蛋、鸡胸肉/鸡丁/去皮鸡腿…），
     用户勾不动也对不齐 → 归成组名：勾一次整组通过，缺料判断也用组名。
     注：米饭/糙米饭/杂粮饭不合并（粗精细不同，热量与 GI 也不同）。 */
  var FOOD_ALIAS = {
    '水煮蛋': '鸡蛋',
    '鸡胸肉': '鸡肉', '鸡丁': '鸡肉', '去皮鸡腿': '鸡肉',
    '脱脂牛奶': '牛奶',
    '嫩豆腐': '豆腐',
    '橄榄油': '食用油', '豆油': '食用油', '麻油': '食用油', '油': '食用油',
    '时蔬': '蔬菜', '蔬菜': '蔬菜', '青菜': '蔬菜', '混合蔬菜': '蔬菜', '生菜番茄': '蔬菜',
    '麦片': '燕麦'
  };
  /* 厨房基础调味料：默认家里就有，不计入"缺料"，无需勾选 */
  var PANTRY_IGNORE = ['食用油', '照烧汁', '番茄酱', '低脂酸奶蘸'];
  function normFood(n) { return FOOD_ALIAS[n] || n; }
  /* 可勾选的常备食材（归一化去重 + 剔除调味料）→ 从 51 个碎条目降到能扫一眼勾完 */
  var PANTRY_OPTS = (function () {
    var seen = {}, out = [];
    ALLFOODS.forEach(function (f) {
      var g = normFood(f);
      if (PANTRY_IGNORE.indexOf(g) >= 0 || seen[g]) return;
      seen[g] = 1; out.push(g);
    });
    return out;
  })();
  /* 老数据兼容：历史勾选可能存的是别名，载入时归一化去重 */
  S.pantry = (function () {
    var seen = {}, out = [];
    (S.pantry || []).forEach(function (f) { var g = normFood(f); if (!seen[g]) { seen[g] = 1; out.push(g); } });
    return out;
  })();
  /* ============ Keep 式热量预算 + 按餐记录（#40）：推荐菜一键记入，预算随训练消耗闭环 ============ */
  var MEALS = [['bf', '早餐', '🌅'], ['lunch', '午餐', '☀️'], ['dinner', '晚餐', '🌙'], ['snack', '加餐', '🍪']];
  function mealLabel(k) { for (var i = 0; i < MEALS.length; i++) if (MEALS[i][0] === k) return MEALS[i][1]; return k; }
  function dayLog() {
    var t = todayStr();
    var dl = S.dietLog[t];
    if (!dl || !dl.items) { dl = { items: [] }; S.dietLog[t] = dl; }
    return dl;
  }
  function logKcal(dl) { return dl.items.reduce(function (a, x) { return a + (x.kcal || 0); }, 0); }
  function todayBurn() {
    var t = todayStr();
    return S.records.filter(function (r) { return r.date === t; }).reduce(function (a, r) { return a + (r.kcal || 0); }, 0);
  }
  function saveDietLog() { saveK('fit_dietlog', S.dietLog); }
  function allDishes() {
    var out = [];
    [BF, LUN, DIN, SNK].forEach(function (arr, i) { arr.forEach(function (t) { out.push({ n: t.n, kcal: t.kcal, tag: MEALS[i][1] }); }); });
    return out;
  }
  function findDish(n) {
    var pools = [BF, LUN, DIN, SNK];
    for (var i = 0; i < pools.length; i++) {
      var hit = pools[i].filter(function (t) { return t.n === n; })[0];
      if (hit) return hit;
    }
    return null;
  }
  function addFoodItem(meal, n, kcal) {
    dayLog().items.push({ id: '' + Date.now() + Math.floor(Math.random() * 999), meal: meal, n: n, kcal: Math.round(kcal) });
    saveDietLog();
  }
  function budgetRing(eaten, budget) {
    var pct = budget > 0 ? Math.min(1, eaten / budget) : 0;
    var r = 52, C = 2 * Math.PI * r;
    var left = Math.round(budget - eaten), over = left < 0;
    var col = over ? '#e05a4e' : '#1FD6A8';
    return '<svg width="118" height="118" viewBox="0 0 120 120" style="flex:none">' +
      '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="rgba(127,127,127,.18)" stroke-width="10"/>' +
      '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (C * pct).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 60 60)"/>' +
      '<text x="60" y="57" text-anchor="middle" font-size="16" font-weight="800" fill="currentColor">' + eaten + '</text>' +
      '<text x="60" y="74" text-anchor="middle" font-size="9" fill="currentColor" opacity=".55">已吃 / ' + budget + '</text>' +
      '</svg>';
  }
  function pantryMiss(meal, pantry) {
    if (!pantry || !pantry.length) return [];
    var seen = {}, out = [];
    meal.parts.forEach(function (p) {
      var g = normFood(p.n);
      if (PANTRY_IGNORE.indexOf(g) >= 0) return; /* 调味料不算缺 */
      if (pantry.indexOf(g) < 0 && !seen[g]) { seen[g] = 1; out.push(g); }
    });
    return out;
  }
  /* ===== 体检指标 → 餐单选品筛选（v28）=====
     lowPurine：硬排除高嘌呤菜品（虾蟹贝/内脏/浓汤等）；lowGI：软优先粗粮主食。 */
  function mealFlags() { return (PROFILE && PROFILE.dietFlags) || []; }
  var HIGH_PURINE_KW = ['虾', '海鲜', '蟹', '贝', '蛤', '生蚝', '牡蛎', '内脏', '猪肝', '鸡肝', '腰花', '肥肠', '浓汤', '肉汤', '火锅', '啤酒', '沙丁鱼', '凤尾鱼', '鱼籽', '鱿鱼', '章鱼', '带鱼', '鱼露', '虾皮'];
  function dishText(it) { return it.n + ' ' + (it.parts || []).map(function (x) { return x.n; }).join(' '); }
  function isHighPurine(it) { var t = dishText(it); return HIGH_PURINE_KW.some(function (k) { return t.indexOf(k) >= 0; }); }
  function isHighGI(it) {
    var t = dishText(it);
    if (/糙米|杂粮|藜麦|荞麦|燕麦|全麦|紫薯|红薯/.test(t)) return false; /* 粗粮主食先豁免（"糙米饭"含"米饭"） */
    return /米饭|白粥|白面包|糯米|土豆泥|含糖|蜂蜜|糖浆/.test(t);
  }
  function pickMeal(arr, target, pantry, flags) {
    flags = flags || mealFlags();
    var base = arr;
    if (flags.indexOf('低嘌呤') >= 0) {
      var clean = arr.filter(function (t) { return !isHighPurine(t); });
      if (clean.length) base = clean; /* 池子够则硬排除；全被排掉才退回原池 */
    }
    if (flags.indexOf('低GI') >= 0) {
      var low = base.filter(function (t) { return !isHighGI(t); });
      if (low.length) base = low; /* 有粗粮主食可选时优先 */
    }
    arr = base;
    var pool = arr.filter(function (t) { return Math.abs(t.kcal - target) <= 80; });
    /* 窗口内没有候选（热量目标高于菜品库上限时常见）→ 取最接近的几道轮换，
       而不是锁死"最接近的那一道"（旧逻辑会让「换一批」永远同一道，看着像乱规划）。
       热量缺口由份量自适应（mealScale）补齐，见 todayMeals。 */
    if (!pool.length) {
      var sorted = arr.slice().sort(function (a, b) { return Math.abs(a.kcal - target) - Math.abs(b.kcal - target); });
      pool = sorted.slice(0, Math.min(4, sorted.length));
    }
    if (pantry && pantry.length) {
      /* 严格按常备食材配：先在热量窗口内找全备的；找不到就放宽热量窗口找全备的；再不行取缺得最少的 */
      var full = pool.filter(function (t) { return pantryMiss(t, pantry).length === 0; });
      if (full.length) return full[Math.floor(Math.random() * full.length)];
      var wide = arr.filter(function (t) { return Math.abs(t.kcal - target) <= 180 && pantryMiss(t, pantry).length === 0; });
      if (wide.length) return wide[Math.floor(Math.random() * wide.length)];
      var ranked = pool.slice().sort(function (a, b) { return pantryMiss(a, pantry).length - pantryMiss(b, pantry).length; });
      var best = pantryMiss(ranked[0], pantry).length;
      var cand = ranked.filter(function (t) { return pantryMiss(t, pantry).length === best; });
      return cand[Math.floor(Math.random() * cand.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function chipRowSel(arr, key, sel, aName) {
    return '<div class="chips">' + arr.map(function (v) {
      return '<span class="chip ' + (sel === v ? 'on' : '') + '" data-a="' + aName + '" data-k="' + key + '" data-v="' + v + '">' + v + '</span>';
    }).join('') + '</div>';
  }
  function mealCard(title, pct, meal, badges, pantry, mealKey, scale, loggedK, tagTxt) {
    scale = scale || 1;
    var miss = pantryMiss(meal, pantry);
    var parts = meal.parts.map(function (x) {
      var isMiss = miss.indexOf(x.n) >= 0;
      return '<div class="mc-p">' + (isMiss ? '<span style="color:#e08a00">⚠️</span> ' : '') + esc(normFood(x.n)) + (x.a ? ' <span class="mc-a">' + esc(scaleAmt(x.a, scale)) + '</span>' : '') + '</div>';
    }).join('');
    var bd = '';
    if (badges && badges.length) {
      bd = '<div class="mc-bd">' + badges.map(function (r) {
        return '<span class="bd ' + (r.t === 'good' ? 'g' : 'w') + '">' + (r.t === 'good' ? '✓ 宜搭 ' : '⚠ 注意 ') + esc(r.a) + '+' + esc(r.b) + '</span>';
      }).join('') + '</div>';
    }
    if (miss.length) bd += '<div class="mc-bd"><span class="bd w">🧺 缺 ' + miss.length + ' 项食材：' + esc(miss.join('、')) + '</span></div>';
    var logTag = loggedK > 0 ? '<span style="font-size:10px;color:#0fb98c;background:rgba(15,185,140,.13);border-radius:6px;padding:1px 6px;margin-left:6px">✓ 已记入 ' + loggedK + ' 千卡</span>' : '';
    var scaleTag = tagTxt || (scale > 1 ? '<span style="font-size:10px;color:#0fb98c;background:rgba(15,185,140,.13);border-radius:6px;padding:1px 6px;margin-left:6px">按目标加量 ×' + scale + '</span>' : '');
    var addBtn = mealKey ? '<div class="btn ghost" data-a="foodQuick" data-meal="' + mealKey + '" data-k="' + esc(meal.n) + '" style="margin-top:8px;text-align:center;padding:8px 0;font-size:12px">' + (loggedK > 0 ? '＋ 补记' : '＋ 吃了就记入') + title + '</div>' : '';
    return '<div class="meal-card"><div class="mc-h"><span class="mc-t">' + title + '</span>' + logTag + scaleTag + '<span class="mc-pct">' + pct + '%</span><span class="mc-k">' + Math.round(meal.kcal * scale) + ' 千卡</span></div>' + parts + bd + addBtn + '</div>';
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
  /* 今日餐单解析：饮食页与首页 teaser 共用；当日持久化 fit_daymeal */
  function pantryKey() { return S.pantry.slice().sort().join(','); }
  function todayMeals() {
    var d = S.diet;
    if (!d) return null;
    var today = todayStr();
    var pk = pantryKey(), fk = mealFlags().join('+'); /* 常备食材 + 体检筛选双重签名 */
    var b = bmr(d), td = tdee(b, d.activity), tgt = targetKcal(td, d.goal);
    var dayK = d.training ? tgt + 150 : tgt;
    var shares = { bf: Math.round(dayK * 0.25), lunch: Math.round(dayK * 0.35), dinner: Math.round(dayK * 0.30) };
    var snackTgt = Math.max(60, Math.round(dayK * 0.10)); /* 加餐固定占 10%，与三餐一起凑满 dayK */
    var bf, lunch, dinner, snack;
    if (S.dayMeal && S.dayMeal.date === today && S.dayMeal.goal === d.goal && S.dayMeal.pantry === pk && (S.dayMeal.flags || '') === fk) {
      /* 当日餐单持久化（date+goal+常备食材+体检筛选四重签名）：任一变化即按新条件重配 */
      bf = BF.filter(function (t) { return t.n === S.dayMeal.bf; })[0] || pickMeal(BF, shares.bf, S.pantry);
      lunch = LUN.filter(function (t) { return t.n === S.dayMeal.lunch; })[0] || pickMeal(LUN, shares.lunch, S.pantry);
      dinner = DIN.filter(function (t) { return t.n === S.dayMeal.dinner; })[0] || pickMeal(DIN, shares.dinner, S.pantry);
      snack = SNK.filter(function (t) { return t.n === S.dayMeal.snack; })[0] || pickMeal(SNK, 150, S.pantry);
    } else {
      bf = pickMeal(BF, shares.bf, S.pantry); lunch = pickMeal(LUN, shares.lunch, S.pantry); dinner = pickMeal(DIN, shares.dinner, S.pantry);
      snack = pickMeal(SNK, snackTgt, S.pantry);
      S.dayMeal = { date: today, goal: d.goal, pantry: pk, flags: fk, bf: bf.n, lunch: lunch.n, dinner: dinner.n, snack: snack.n };
      saveK('fit_daymeal', S.dayMeal);
    }
    /* 份量自适应（v29）：菜品库单份热量有上限，热量目标更高时按 目标÷单份 放大份量，
       让每餐真正吃够（餐卡显示 ×N 量与放大后的千卡），而不是固定给一份、总量差一大截。 */
    var tg = { bf: shares.bf, lunch: shares.lunch, dinner: shares.dinner, snack: snackTgt };
    var scales = { bf: mealScale(bf, tg.bf), lunch: mealScale(lunch, tg.lunch), dinner: mealScale(dinner, tg.dinner), snack: mealScale(snack, tg.snack) };
    return { bf: bf, lunch: lunch, dinner: dinner, snack: snack, dayK: dayK, scales: scales, targets: tg };
  }
  /* 目标÷单份热量 → 份量倍数；不到 5% 不加量，封顶 2.2 倍（再多不现实） */
  function mealScale(meal, target) {
    var s = target / meal.kcal;
    if (!isFinite(s) || s < 1.05) return 1;
    return Math.min(2.2, Math.round(s * 10) / 10);
  }
  /* 按倍数放大份量文本："150g"→"285g"、"2个"→"4个"、"60g(干)"→"114g(干)"；无定量（如"时蔬"）不动 */
  function scaleAmt(a, s) {
    if (!a || s === 1) return a;
    var m = String(a).match(/^([\d.]+)(.*)$/);
    if (!m) return a;
    var v = parseFloat(m[1]) * s, u = m[2];
    if (/^(g|ml)/.test(u)) v = Math.round(v / 5) * 5;
    else if (/个|片|张|根|块|勺|杯/.test(u)) v = Math.max(1, Math.round(v));
    else v = Math.round(v * 10) / 10;
    return v + u;
  }
  function vDietResult() {
    var d = S.diet;
    var today = todayStr();
    var b = bmr(d), td = tdee(b, d.activity), tgt = targetKcal(td, d.goal);
    var dayK = d.training ? tgt + 150 : tgt;
    var m = macroSplit(dayK, d.weight, d.goal, d.training);
    var tot = m.pk + m.ck + m.fk || 1;
    var tm = todayMeals();
    var bf = tm.bf, lunch = tm.lunch, dinner = tm.dinner, snack = tm.snack, sc = tm.scales || {};
    var water = Math.max(Math.round(d.weight * 35), PROFILE.water);
    /* Keep 式热量预算：预算 = 目标热量 + 今日实际训练消耗；已吃 = 当日按餐记录之和 */
    var dl = dayLog();
    var eaten = logKcal(dl);
    var burn = todayBurn();
    var budget = dayK + burn;
    var left = Math.round(budget - eaten);
    /* v34 已吃驱动：记了餐之后，未记的餐按"剩余预算"动态配份量（选品当天不变，只调份量） */
    var eatenBy = { bf: 0, lunch: 0, dinner: 0, snack: 0 };
    dl.items.forEach(function (x) { if (eatenBy[x.meal] != null) eatenBy[x.meal] += (x.kcal || 0); });
    var tgB = tm.targets || {};
    var remainR = Math.max(0, budget - eaten);
    var adScale = {};
    var openK = [];
    if (eaten > 0) {
      var baseSum = 0;
      MEALS.forEach(function (m) { if (!eatenBy[m[0]]) { openK.push(m[0]); baseSum += (tgB[m[0]] || 0); } });
      if (openK.length && baseSum > 0) {
        var dishOf = { bf: bf, lunch: lunch, dinner: dinner, snack: snack };
        openK.forEach(function (k) {
          var raw = (remainR * (tgB[k] || 0) / baseSum) / (dishOf[k].kcal || 1);
          adScale[k] = Math.max(0.6, Math.min(2.2, Math.round(raw * 10) / 10));
        });
      }
    }
    var scales = {
      bf: adScale.bf != null ? adScale.bf : sc.bf,
      lunch: adScale.lunch != null ? adScale.lunch : sc.lunch,
      dinner: adScale.dinner != null ? adScale.dinner : sc.dinner,
      snack: adScale.snack != null ? adScale.snack : sc.snack
    };
    var scaleTagFor = function (k) {
      if (adScale[k] == null) return '';
      var s = adScale[k], base = sc[k] || 1;
      if (remainR <= 0) return '<span style="font-size:10px;color:#e05a4e;background:rgba(224,90,78,.12);border-radius:6px;padding:1px 6px;margin-left:6px">预算已吃完 · 建议减量 ×' + s + '</span>';
      return '<span style="font-size:10px;color:' + (s >= base ? '#0fb98c' : '#e08a00') + ';background:rgba(127,127,127,.1);border-radius:6px;padding:1px 6px;margin-left:6px">按剩余预算' + (s >= base ? '加量' : '减量') + ' ×' + s + '</span>';
    };
    var budgetCard = '<div class="card"><div class="form-t" style="margin:0 0 6px">🔥 今日热量预算</div>' +
      '<div style="display:flex;align-items:center;gap:14px">' + budgetRing(eaten, budget) +
      '<div style="flex:1;min-width:0"><div style="font-size:26px;font-weight:900;color:' + (left < 0 ? '#e05a4e' : 'var(--ink)') + '">' + (left < 0 ? '超 ' + (-left) : '还能吃 ' + left) + '</div>' +
      '<div style="font-size:11px;color:#7a838e;margin-top:2px">千卡' + (left < 0 ? ' · 已超出今日预算' : ' · 距离预算还有余额') + '</div>' +
      '<div style="font-size:10.5px;color:#8d959e;margin-top:6px;line-height:1.6">预算 ' + budget + ' = 目标 ' + dayK + (burn ? ' + 今日训练已消耗 ' + burn : '') + '<br>吃了就记（下方每餐 ＋），预算实时扣减</div></div></div></div>';
    /* 按餐记录实际饮食（替代旧布尔打卡） */
    var mealLogHtml = '<div class="card"><div class="form-t" style="margin:0 0 4px">🍽 今日吃了什么</div>' +
      MEALS.map(function (m2) {
        var its = dl.items.filter(function (x) { return x.meal === m2[0]; });
        var sum = its.reduce(function (a, x) { return a + (x.kcal || 0); }, 0);
        var rows = its.map(function (x) {
          return '<div style="display:flex;align-items:center;padding:7px 2px;border-bottom:1px solid rgba(127,127,127,.1)"><span style="font-size:12.5px">' + esc(x.n) + '</span><span style="margin-left:auto;font-size:11px;color:var(--sub)">' + x.kcal + ' 千卡<span data-a="foodDel" data-id="' + x.id + '" style="color:#e05a4e;cursor:pointer;padding:0 2px 0 8px">✕</span></span></div>';
        }).join('');
        return '<div style="margin:8px 0 2px"><div style="display:flex;align-items:center"><b style="font-size:12.5px">' + m2[2] + ' ' + m2[1] + '</b>' +
          '<span style="margin-left:auto;font-size:11px;color:var(--sub)">' + (its.length ? sum + ' 千卡' : '未记录') + '</span>' +
          '<span class="chip sm" data-a="addFood" data-meal="' + m2[0] + '" style="margin-left:8px;cursor:pointer">＋ 记录</span></div>' + rows + '</div>';
      }).join('') + '</div>';
    var goalTxt = d.goal === '减脂' ? '热量缺口，建议配合训练与充足蛋白以保留肌肉' : d.goal === '增肌' ? '热量盈余，保证蛋白摄入与力量训练刺激' : '维持当前体重，均衡搭配即可';
    /* 身体档案联动：按目标给出方案说明（数据来自本机分析器，无档案则不显示） */
    var personalDietTip = d.goal === '增肌'
      ? '<div class="card" style="font-size:11.5px;color:#4a525c;line-height:1.75;background:#f5f9f7">🎯 <b>你的增重方案</b>：每天吃 ' + tgt + ' 千卡（比消耗多约 300），蛋白质 ' + m.protein + 'g（' + (m.protein / d.weight).toFixed(1) + 'g/kg）。' + (PROFILE.water ? '<br>💧 每天喝够 ' + (water / 1000).toFixed(1) + 'L 水。' : '') + (PROFILE.lowPurine ? '<br>🥚 蛋白优先鸡蛋、牛奶、乳清、鸡胸；少吃动物内脏、浓肉汤，不饮酒。' : '') + '</div>'
      : '';
    // 热量闭环（#16）：把训练消耗汇入饮食预算视角——展示本周训练消耗，训练日已 +150 千卡
    var cutoff7 = Date.now() - 7 * 86400000;
    var wkR = S.records.filter(function (r) { return new Date(r.date + 'T00:00:00').getTime() >= cutoff7; });
    var wkK = wkR.reduce(function (a, r) { return a + (r.kcal || 0); }, 0);
    var trainCard = '<div class="card train-loop"><div class="form-t" style="margin:0 0 6px">🏃 训练消耗（热量闭环）</div>' +
      '<div class="vol-row"><div class="vol-b"><div class="n">' + wkK + '</div><div class="l">近 7 天消耗(千卡)</div></div>' +
      '<div class="vol-b"><div class="n">' + wkR.length + '</div><div class="l">训练次数</div></div>' +
      '<div class="vol-b"><div class="n">+' + burn + '</div><div class="l">今日已计入预算</div></div></div>' +
      '<div style="font-size:10.5px;color:#a0a6ad;margin-top:6px">今天练掉 ' + burn + ' 千卡已实时加进上方预算——练得多，当天能吃的也多，吃练闭环。</div></div>';
    /* 常备食材卡（#39）：勾选后餐单优先按已有食材配 */
    var pantryChips = PANTRY_OPTS.map(function (f) {
      return '<span class="chip ' + (S.pantry.indexOf(f) >= 0 ? 'on' : '') + '" data-a="pantryTgl" data-n="' + esc(f) + '">' + esc(f) + '</span>';
    }).join('');
    var pantryHtml = '<div class="card" style="margin-bottom:10px"><div class="form-t" style="margin:0 0 8px">🧺 我的常备食材 <span class="more" data-a="pantryAll" style="cursor:pointer">' + (S.pantry.length ? '全选 / 清空' : '一键全选') + '</span></div>' +
      '<div class="chips">' + pantryChips + '</div>' +
      '<div style="font-size:10.5px;color:#8d959e;margin-top:6px;line-height:1.7">' + (S.pantry.length
        ? '✅ 已勾 ' + S.pantry.length + ' 项 · 下方餐单<b>只从你勾的食材里配</b>（油盐酱醋等调味料默认有，不用勾）；实在凑不齐才缺几样并标 ⚠️'
        : '⚠️ 还没勾食材 → 当前是<b>全库随机推荐</b>，跟你家里有什么无关。勾上你常备的几样，餐单就只按这些来配（调味料不用勾）') + '</div>' +
      (S.pantry.length ? '<div class="btn" style="margin-top:8px;text-align:center;padding:9px 0" data-a="pantryRegen">按常备食材重新配餐 ⟳</div>' : '') + '</div>';
    return '' +
      '<div class="card diet-sum">' +
      '<div class="ds-row"><div class="ds-b"><div class="n">' + b + '</div><div class="l">基础代谢 BMR</div></div>' +
      '<div class="ds-b"><div class="n">' + td + '</div><div class="l">每日消耗 TDEE</div></div></div>' +
      '<div class="ds-target"><span class="ds-k">' + dayK + '</span> 千卡/天 · ' + (d.training ? '训练日' : '休息日') + ' · ' + esc(d.goal) + '</div>' +
      (S.dietAuto ? '<div style="font-size:10.5px;color:#8d959e;margin-top:6px">📱 本方案按默认资料自动生成，点底部「重新填写资料」可改成你的身高体重</div>' : '') + '</div>' +
      (function () {
        var fl = mealFlags();
        if (!fl.length) return '';
        var ps = [];
        if (fl.indexOf('低嘌呤') >= 0) ps.push('低嘌呤优先：已避开虾蟹贝、内脏、浓肉汤类菜品');
        if (fl.indexOf('低GI') >= 0) ps.push('低 GI 优先：粗粮/全麦主食排前，白米饭类退后');
        return '<div class="card" style="margin-bottom:10px;font-size:11.5px;color:#4a525c;line-height:1.75;background:#f5f9f7">🧪 <b>餐单已按你的体检指标筛选</b><br>' + ps.join('<br>') +
          '<div style="font-size:10.5px;color:#8d959e;margin-top:4px">依据本机「身体数据分析器」的指标，清除数据后即恢复默认选品</div></div>';
      })() +
      '<div class="card"><div class="form-t" style="margin:0 0 8px">🥗 三大营养素配比</div>' +
      '<div class="macro-bar"><i class="mp p" style="width:' + Math.round(m.pk / tot * 100) + '%"></i><i class="mp c" style="width:' + Math.round(m.ck / tot * 100) + '%"></i><i class="mp f" style="width:' + Math.round(m.fk / tot * 100) + '%"></i></div>' +
      '<div class="macro-leg"><span><b style="color:#0fb98c">' + m.protein + 'g</b> 蛋白 ' + Math.round(m.pk / tot * 100) + '%</span>' +
      '<span><b style="color:#f0a23a">' + m.carb + 'g</b> 碳水 ' + Math.round(m.ck / tot * 100) + '%</span>' +
      '<span><b style="color:#6a78d6">' + m.fat + 'g</b> 脂肪 ' + Math.round(m.fk / tot * 100) + '%</span></div>' +
      '<div style="font-size:11px;color:#a0a6ad;margin-top:8px">💧 建议饮水 ' + water + ' ml/天（约 ' + Math.round(water / 250) + ' 杯）</div></div>' +
      '<div class="diff-seg" style="margin:10px 0 6px"><span class="dl">当日类型</span>' +
      '<div class="o' + (d.training ? '' : ' on') + '" data-a="dietTrain" data-v="0">休息日</div>' +
      '<div class="o' + (d.training ? ' on' : '') + '" data-a="dietTrain" data-v="1">训练日</div></div>' +
      budgetCard +
      mealLogHtml +
      pantryHtml +
      '<div class="h-sec">今日推荐 <span class="more" data-a="dietRegen" style="cursor:pointer">换一批 ⟳</span><span style="font-size:10px;color:#8d959e;margin-left:6px">吃了点「一键记入」就进预算</span></div>' +
      '<div style="font-size:11px;color:#7a838e;margin:-2px 6px 8px;line-height:1.7">' +
      (S.pantry.length ? '🧺 按你勾的 <b>' + S.pantry.length + '</b> 项常备食材配餐' : '🧺 <span style="color:#e08a00">未勾常备食材 → 当前全库推荐</span>：在上方「我的常备食材」勾几样，餐单就只按你有的配（调味料不用勾）') +
      (eaten > 0 && openK.length ? '<br>🍽 今天已记 ' + eaten + ' 千卡 · 还剩 ' + remainR + ' 千卡，<b>没记的餐已按剩余预算动态配份量</b>' : (eaten > 0 ? '<br>🍽 今天已记 ' + eaten + ' 千卡 · 预算还剩 ' + remainR + ' 千卡' : '')) + '</div>' +
      mealCard('早餐', 25, bf, mealFindings(bf), S.pantry, 'bf', scales.bf, eatenBy.bf, scaleTagFor('bf')) + mealCard('午餐', 35, lunch, mealFindings(lunch), S.pantry, 'lunch', scales.lunch, eatenBy.lunch, scaleTagFor('lunch')) + mealCard('晚餐', 30, dinner, mealFindings(dinner), S.pantry, 'dinner', scales.dinner, eatenBy.dinner, scaleTagFor('dinner')) + mealCard('加餐', 10, snack, mealFindings(snack), S.pantry, 'snack', scales.snack, eatenBy.snack, scaleTagFor('snack')) +
      trainCard +
      vDietPair() +
      '<div class="card" style="font-size:11.5px;color:#7a838e;line-height:1.6;background:#f5f7f8">📌 ' + goalTxt + '。餐单为参考样例，按热量目标搭配中式食材；如有代谢疾病或特殊饮食需求，请遵营养师/医嘱。</div>' +
      personalDietTip +
      '<div class="gen-btn btn ghost" data-a="dietEdit">↻ 重新填写资料</div>';
  }
  /* 零摩擦：无方案时按默认资料自动生成（今日餐单立即可见），表单仅主动"重新填写"时出现 */
  function ensureDiet() {
    if (!S.diet) {
      S.diet = Object.assign({}, S.dietDraft, { training: false });
      saveK('fit_diet', S.diet);
      S.dietAuto = true;
    }
    return S.diet;
  }
  function vDiet() {
    if (!S.dietFormOpen) ensureDiet();
    if (S.dietFormOpen) return vDietForm();
    return vDietResult();
  }

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
    if (p.venueNote) lines.push('📍 ' + p.venueNote);
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
    var payload = { v: 1, exportedAt: new Date().toISOString(), best: S.best, records: S.records, plan: S.plan, diet: S.diet, dietPair: S.dietPair, pantry: S.pantry, wGoal: S.wGoal, fitness: S.fitness, rpeLog: S.rpeLog, dietLog: S.dietLog, health: S.health };
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
        if (p.pantry) { S.pantry = p.pantry; saveK('fit_pantry', S.pantry); }
        if (p.wGoal !== undefined) { S.wGoal = p.wGoal; saveK('fit_wgoal', S.wGoal); }
        if (p.fitness) { S.fitness = p.fitness; saveK('fit_fitness', S.fitness); }
        if (p.rpeLog) { S.rpeLog = p.rpeLog; saveK('fit_rpe', S.rpeLog); }
        if (p.health) { S.health = p.health; saveK('fit_health', S.health); PROFILE = analyzeHealth(S.health); }
        if (p.dietLog) { S.dietLog = p.dietLog; saveK('fit_dietlog', S.dietLog); }
        S.dayMeal = null; saveK('fit_daymeal', null);
        alert('已导入备份：动作纪录 ' + Object.keys(S.best).length + ' 项，训练记录 ' + S.records.length + ' 条');
        renderShell();
      } catch (e) { alert('导入失败：文件格式不正确'); }
    };
    reader.readAsText(file);
  }

  var resetArm = 0;
  function resetData() {
    var now = Date.now();
    if (!resetArm || now - resetArm > 5000) {
      resetArm = now;
      toast('⚠️ 将清空训练/饮食/体重/徽章数据，5 秒内再点一次确认');
      renderShell();
      setTimeout(function () { if (resetArm && Date.now() - resetArm >= 5000) { resetArm = 0; renderShell(); } }, 5100);
      return;
    }
    ['fit_best', 'fit_records', 'fit_plan', 'fit_weight', 'fit_dietlog', 'fit_diet', 'fit_badges', 'fit_pantry', 'fit_daymeal', 'fit_rpe', 'fit_fitness', 'fit_wgoal', 'fit_health'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    S.best = {}; S.records = []; S.plan = null; S.weekIdx = 0;
    S.weights = {}; S.dietLog = {}; S.diet = null; S.badges = {}; S.health = null;
    resetArm = 0;
    toast('🗑 已清空全部数据，即将刷新');
    setTimeout(function () { location.reload(); }, 900);
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
    if (a === 'resetData') { resetData(); return; }
    if (a === 'toggleTheme') { S.theme = S.theme === 'dark' ? 'light' : 'dark'; saveK('fit_theme', S.theme); applyTheme(); renderShell(); return; }
    if (a === 'toggleFav') {
      var nm = el.getAttribute('data-name');
      var ix = S.favs.indexOf(nm);
      if (ix >= 0) S.favs.splice(ix, 1); else S.favs.push(nm);
      saveK('fit_favs', S.favs);
      toast(ix >= 0 ? '已取消收藏' : '⭐ 已收藏，动作库可按收藏筛选');
      sheetAct(nm);
      return;
    }
    if (a === 'resumeRun') { resumeRun(); return; }
    if (a === 'resumeDismiss') { clearResume(); renderShell(); toast('已忽略上次进度'); return; }
    if (a === 'confirmExit') { doCloseW(); return; }
    if (a === 'resumePrev') { resumePrev(); return; }
    if (a === 'undoAct') { undoLast(); return; }
    if (a === 'sharePlan') { sharePlan(); return; }
    /* 体重 / 饮食打卡 */
    if (a === 'weightSave') {
      var wi = $('#wgtIn'), wv = wi ? Number(wi.value) : 0;
      if (!wv || wv < 20 || wv > 400) { toast('请输入合理体重 (20-400 kg)'); return; }
      S.weights[todayStr()] = Math.round(wv * 10) / 10; saveK('fit_weight', S.weights);
      var wg = $('#wgoalIn');
      if (wg && wg.value && Number(wg.value) >= 20 && Number(wg.value) <= 400) {
        S.wGoal = Math.round(Number(wg.value) * 10) / 10; saveK('fit_wgoal', S.wGoal);
        toast('⚖️ 已记录 ' + S.weights[todayStr()] + ' kg · 🎯 目标 ' + S.wGoal + ' kg');
      } else toast('⚖️ 已记录 ' + S.weights[todayStr()] + ' kg');
      renderView(); return;
    }
    /* RPE 疲劳反馈（#31） */
    if (a === 'rpeVote') { rpeVote(v); return; }
    /* 同类替换（#34） */
    if (a === 'similarAct') { similarAct(el.dataset.name); return; }
    /* 体能测试（#35） */
    if (a === 'fitTestSave') {
      var fp = Number(($('#ftPush') || {}).value) || 0, fl = Number(($('#ftPlank') || {}).value) || 0, fs = Number(($('#ftSquat') || {}).value) || 0;
      if (!fp && !fl && !fs) { toast('至少填一项指标'); return; }
      S.fitness.push({ date: todayStr(), pushup: fp || null, plank: fl || null, squat: fs || null });
      S.fitness = S.fitness.slice(-24); saveK('fit_fitness', S.fitness);
      renderView(); toast('🏋️ 体测已记录，坚持每月测一次看进步'); return;
    }
    /* 周报分享图（#33） */
    if (a === 'weeklyReport') { weeklyReport(); return; }
    /* 训练提醒（#37） */
    if (a === 'remindToggle') {
      if (!S.remind || !S.remind.on) {
        if (!('Notification' in window)) { toast('当前浏览器不支持通知'); return; }
        Notification.requestPermission().then(function (p) {
          if (p === 'granted') { toast('通知权限已获取'); remindLoop(); renderView(); }
          else toast('未授权通知，提醒将不可用');
        });
        S.remind = { on: true, time: (S.remind && S.remind.time) || '19:30' };
      } else { S.remind.on = false; toast('提醒已关闭'); }
      saveK('fit_remind', S.remind); renderView(); return;
    }
    if (a === 'remindSave') {
      var rt = $('#remindTime');
      S.remind = { on: S.remind ? S.remind.on : false, time: (rt && rt.value) || '19:30' };
      saveK('fit_remind', S.remind); toast('⏰ 提醒时间已设为 ' + S.remind.time); return;
    }
    /* Keep 式按餐记录（#40） */
    if (a === 'addFood') { sheetFood(el.dataset.meal); return; }
    if (a === 'foodQuick') {
      var dq = findDish(el.dataset.k);
      if (dq) {
        var tmq = todayMeals();
        var scq = (tmq && tmq.scales && tmq.scales[el.dataset.meal]) || 1;
        var kq = Math.round(dq.kcal * scq); /* v34 修复：份量加量 ×N 时按真实吃下的热量记，不再只记单份 */
        addFoodItem(el.dataset.meal, dq.n, kq);
        toast('✅ 已记入' + mealLabel(el.dataset.meal) + '：' + dq.n + '（' + kq + ' 千卡' + (scq > 1 ? ' · 含加量 ×' + scq : '') + '）');
        renderView();
      }
      return;
    }
    if (a === 'foodPick') {
      var dp = findDish(el.dataset.n);
      if (dp) { addFoodItem(S._foodMeal, dp.n, dp.kcal); closeSheet(); toast('✅ 已记录 ' + dp.n + '（' + dp.kcal + ' 千卡）'); renderView(); }
      return;
    }
    if (a === 'foodDel') {
      var dlx = dayLog();
      dlx.items = dlx.items.filter(function (x) { return x.id !== el.dataset.id; });
      saveDietLog(); renderView(); return;
    }
    if (a === 'foodCustom') {
      var cn = $('#foodCn'), ck2 = $('#foodCk');
      var nm = ((cn && cn.value) || '').trim(), kv = Number(ck2 && ck2.value) || 0;
      if (!nm) { toast('请先填写吃了什么'); return; }
      if (kv <= 0) { toast('请填写热量（千卡）'); return; }
      addFoodItem(S._foodMeal, nm, kv); closeSheet(); toast('✅ 已记录 ' + nm + '（' + kv + ' 千卡）'); renderView();
      return;
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
      var wasManual = !!S.plan.manual;
      S.plan = generatePlan({ goal: S.form.goal, days: S.form.day, length: S.form.length, level: rpeBiasLevel(S.form.level), venue: S.form.venue === '🏋️ 健身房' ? 'gym' : 'home' }, histForPlan());
      if (wasManual) S.plan.manual = true;
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
      S.plan = generatePlan({ goal: S.form.goal, days: S.form.day, length: S.form.length, level: rpeBiasLevel(S.form.level), venue: S.form.venue === '🏋️ 健身房' ? 'gym' : 'home' }, histForPlan());
      S.plan.manual = true;
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
    /* 身体数据分析器 */
    if (a === 'healthOpen') {
      S.healthOpen = true;
      S.healthDraft = S.health ? JSON.parse(JSON.stringify(S.health)) : { gender: '男', age: 28, height: 175, weight: 70, activity: '中度' };
      renderView(); return;
    }
    if (a === 'healthCancel') { S.healthOpen = false; renderView(); return; }
    if (a === 'hform') { if (S.healthDraft) { S.healthDraft[k] = v; } renderView(); return; }
    if (a === 'healthParse') {
      var ta = $('#reportPaste');
      var got = ta ? parseReport(ta.value || '') : {};
      var nk = 0;
      Object.keys(got).forEach(function (kk) { S.healthDraft[kk] = got[kk]; nk++; });
      renderView();
      toast(nk ? '✅ 提取到 ' + nk + ' 项指标，请核对数值' : '没提取到指标，试试复制报告数值部分或手动填写');
      return;
    }
    if (a === 'healthSave') {
      var hd = S.healthDraft || {};
      if (!hd.height || !hd.weight) { toast('至少填写身高和体重'); return; }
      S.health = hd; saveK('fit_health', hd);
      PROFILE = analyzeHealth(hd);
      S.diet = { gender: PROFILE.gender, age: PROFILE.age, height: PROFILE.height, weight: PROFILE.weight, activity: PROFILE.activity, goal: PROFILE.goal, training: !!(S.diet && S.diet.training) };
      saveK('fit_diet', S.diet); S.dayMeal = null; saveK('fit_daymeal', null);
      S.wGoal = PROFILE.weightGoal; saveK('fit_wgoal', S.wGoal);
      /* 自动生成训练计划：参数由体检数据推导（目标/周频次/水平封顶），时长与场景沿用表单现值 */
      S.form.goal = PROFILE.planGoal || (PROFILE.goal === '维持' ? '保持健康' : PROFILE.goal);
      if (PROFILE.levelCap) S.form.level = PROFILE.levelCap;
      if (PROFILE.planDays) S.form.day = PROFILE.planDays;
      var want = { goal: S.form.goal, days: S.form.day, length: S.form.length, level: rpeBiasLevel(S.form.level), venue: S.form.venue === '🏋️ 健身房' ? 'gym' : 'home' };
      var same = S.plan && S.plan.goal === want.goal && S.plan.days === want.days && S.plan.length === want.length && S.plan.level === want.level && S.plan.venue === want.venue;
      var trainMsg = '';
      if (!same) {
        S.plan = generatePlan(want, histForPlan());
        S.plan.fromHealth = true;
        if (S.recoveryOn) applyRecovery(S.plan);
        S.weekIdx = 0; saveK(KP, S.plan);
        trainMsg = ' · 训练计划已生成（每周 ' + want.days + ' 练 · ' + want.goal + '）';
      }
      if (!Object.keys(S.weights).length && PROFILE.examDate) { S.weights[PROFILE.examDate] = PROFILE.weight; saveK('fit_weight', S.weights); }
      S.healthOpen = false;
      renderView(); toast('✅ 已按你的数据生成训练计划与饮食方案' + (same ? '（计划参数未变，保留原进度）' : trainMsg) + (PROFILE.levelCap ? ' · 血压偏高，强度已调至新手档' : '')); return;
    }
    if (a === 'healthClear') { S.health = null; saveK('fit_health', null); S.healthDraft = null; S.dayMeal = null; saveK('fit_daymeal', null); PROFILE = analyzeHealth({ gender: '男', age: 28, height: 175, weight: 70, activity: '中度', goal: '减脂' }); S.healthOpen = false; renderView(); toast('已清除身体数据，餐单恢复默认选品'); return; }
    if (a === 'saveDiet') { S.diet = Object.assign({}, S.dietDraft, { training: false, custom: true }); S.dayMeal = null; S.dietFormOpen = false; S.dietAuto = false; saveK('fit_diet', S.diet); saveK('fit_daymeal', null); renderView(); toast('✅ 方案已生成，已按你的资料重配今日餐单'); return; }
    if (a === 'dietEdit') { S.dietDraft = Object.assign({}, S.diet); S.dietFormOpen = true; renderView(); return; }
    if (a === 'dietTrain') { if (S.diet) { S.diet.training = (v === '1'); saveK('fit_diet', S.diet); renderView(); } return; }
    if (a === 'dietRegen') { S.dayMeal = null; saveK('fit_daymeal', null); renderView(); return; }
    /* 常备食材（#39） */
    if (a === 'pantryTgl') {
      var fn = el.dataset.n, ix2 = S.pantry.indexOf(fn);
      if (ix2 >= 0) S.pantry.splice(ix2, 1); else S.pantry.push(fn);
      saveK('fit_pantry', S.pantry); renderView(); return;
    }
    if (a === 'pantryAll') {
      S.pantry = S.pantry.length >= PANTRY_OPTS.length ? [] : PANTRY_OPTS.slice();
      saveK('fit_pantry', S.pantry); renderView(); return;
    }
    if (a === 'pantryRegen') { S.dayMeal = null; saveK('fit_daymeal', null); renderView(); toast('🧺 已按常备食材重新配餐'); return; }
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
      var HANUM = { age: 1, height: 1, weight: 1, sys: 1, dia: 1, hr: 1, ua: 1, glu: 1, ggt: 1, tc: 1, tg: 1, hdl: 1, ldl: 1, bfp: 1, bmd: 1 };
      if (t.closest && t.closest('.ha-form')) {
        /* 空输入保持为空：骨密度 T 值 0 是合法值，不能被 Number('') 污染成 0 */
        if (S.healthDraft) S.healthDraft[k] = HANUM[k] ? (t.value === '' ? '' : (Number(t.value) || 0)) : t.value;
        return;
      }
      S.dietDraft[k] = HANUM[k] ? (Number(t.value) || 0) : t.value;
    }
    /* 动作库搜索：DOM 实时过滤，不重渲染避免丢焦点 */
    if (t && t.id === 'actSearch') {
      var q = (t.value || '').trim();
      S.actQ = q;
      var n = 0;
      app.querySelectorAll('.act-row').forEach(function (r) {
        var hit = !q || (r.getAttribute('data-name') || '').indexOf(q) >= 0;
        r.style.display = hit ? '' : 'none';
        if (hit) n++;
      });
      var em = app.querySelector('#actEmpty');
      if (em) { em.style.display = n ? 'none' : ''; em.innerHTML = '<div class="e-ic">🔍</div>没找到「' + esc(q) + '」，换个关键词试试'; }
    }
    /* 饮食记录 sheet 搜索：DOM 实时过滤，不重渲染避免丢焦点 */
    if (t && t.id === 'foodSearch') {
      var q3 = (t.value || '').trim();
      var n3 = 0;
      app.querySelectorAll('.food-row').forEach(function (r) {
        var hit = !q3 || (r.getAttribute('data-name') || '').indexOf(q3) >= 0;
        r.style.display = hit ? '' : 'none';
        if (hit) n3++;
      });
      var fl = app.querySelector('#foodList');
      if (fl && !n3 && q3) {
        var empty = app.querySelector('#foodEmpty');
        if (!empty) { empty = document.createElement('div'); empty.id = 'foodEmpty'; fl.parentNode.insertBefore(empty, fl.nextSibling); }
        empty.innerHTML = '<div style="text-align:center;font-size:11px;color:#a0a6ad;padding:10px 0">没找到「' + esc(q3) + '」，用下方手动记一条</div>';
      } else { var em3 = app.querySelector('#foodEmpty'); if (em3) em3.innerHTML = ''; }
    }
  });
  app.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.id === 'impFile') { importData(t.files && t.files[0]); t.value = ''; }
  });

  renderShell();
  remindLoop();
})();
