const { courses, ANIM_TIP } = require('../../utils/data.js');
const app = getApp();

// 动作成绩历史：记录每个计数动作实际完成次数，下次练同动作时对比（GoFit「渐进超负荷」式）
function loadHist() {
  return wx.getStorageSync('action_best') || {};
}
function saveHist(hist) {
  wx.setStorageSync('action_best', hist);
}

function vibrate(type) {
  try { wx.vibrateShort({ type: type || 'light' }); } catch (e) {}
}

Page({
  data: {
    course: null,
    index: 0,        // 当前动作下标（ready 阶段为 -1）
    total: 0,
    current: null,
    phase: 'ready',  // ready(3-2-1准备) | action | rest | done
    remaining: 0,    // 倒计时秒数
    progress: 0,     // 进度条百分比
    running: false,
    restSec: 10,     // 组间休息时长（训练中可切换）
    restOpts: [10, 20, 30, 60],
    repsActual: 0,   // 计数动作当前实际完成数（可 +/- 调整）
    histLine: '',    // 该动作上次/最佳成绩文案
    curImgOk: false, // 当前动作主图加载成功（失败回退 emoji）
    nextImgOk: false, // 休息卡下一动作 GIF 是否加载成功
    // 动作演示
    showDemo: false,
    demoName: '',
    demoAnim: 'dynamic',
    demoTip: '',
    phaseIndex: 0,
    demoMedia: '',
    demoImgOk: false,
    planNote: '' // 处方模式提示（从 AI 计划进入时，目标已按用户成绩定制）
  },

  timer: null,
  _detail: [],       // 本课每个动作完成明细 {name, target, actual}
  _recordCount: 0,   // 本课破纪录次数

  onLoad(options) {
    let statusBar = 20;
    try {
      const info = wx.getSystemInfoSync();
      statusBar = info.statusBarHeight || 20;
    } catch (e) {}

    let course = null;
    let planNote = '';
    // 处方模式（v4）：AI 计划直接把「组装好的当日训练」写进 plan_run.course
    // —— 动作序列、组数轮次、个性化目标都已在计划侧算好，跟练页原样执行
    if (options.fromPlan === '1') {
      const run = wx.getStorageSync('plan_run');
      if (run && run.course && Array.isArray(run.course.actions) && run.course.actions.length) {
        course = run.course;
        planNote = 'AI 计划训练 · 组数与目标已按你的成绩设定';
        wx.removeStorageSync('plan_run'); // 一次性消费，避免残留影响下次从别处开课
      }
    }
    if (!course) {
      course = courses.find(c => c.id === options.courseId);
      if (!course) {
        wx.navigateBack();
        return;
      }
      // 处方模式（v3 兼容）：从 AI 计划进入（fromPlan=1）时，用计划页算好的目标覆盖动作默认量
      if (options.fromPlan === '1') {
        const run = wx.getStorageSync('plan_run');
        if (run && run.courseId === course.id && Array.isArray(run.goals) && run.goals.length) {
          const copy = JSON.parse(JSON.stringify(course));
          const gmap = {};
          run.goals.forEach(g => { if (g && g.name && g.target) gmap[g.name] = Number(g.target); });
          copy.actions.forEach(a => { if (gmap[a.name]) a.value = gmap[a.name]; });
          course = copy;
          planNote = '计划处方模式 · 目标已按你的成绩设定';
          wx.removeStorageSync('plan_run');
        }
      }
    }
    const savedRest = wx.getStorageSync('user_rest_sec');
    wx.setNavigationBarTitle({ title: course.name });
    this._detail = [];
    this._recordCount = 0;
    this.setData({
      statusBar,
      course,
      planNote,
      total: course.actions.length,
      index: -1,
      current: null,
      phase: 'ready',
      remaining: 3,
      progress: 0,
      running: true,
      restSec: savedRest || 10,
      repsActual: 0,
      histLine: ''
    });
    // Keep 式：训练中保持屏幕常亮，避免锁屏打断计时
    wx.setKeepScreenOn({ keepScreenOn: true });
    this.startTimer();
  },

  calcProgress(index) {
    return Math.round(((index + 1) / this.data.total) * 100);
  },

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  startTimer() {
    this.clearTimer();
    this.setData({ running: true });
    this.timer = setInterval(() => this.tick(), 1000);
  },

  tick() {
    const { phase, current, index, total, course, restSec } = this.data;

    // 计数动作：等用户点「完成」，不自动倒计时
    if (phase === 'action' && current.type === 'reps') return;

    let remaining = this.data.remaining - 1;
    if (remaining > 0) {
      this.setData({ remaining, hurrying: remaining <= 3 });
      // 阶段快结束前给出节奏感（无语音时的触觉教练）
      if (phase === 'rest' && remaining === 3) vibrate('light');
      return;
    }
    this.setData({ hurrying: false });

    // 倒计时归零
    if (phase === 'ready') {
      // 准备结束，进入第一个动作
      this.enterAction(0);
    } else if (phase === 'action') {
      // time 动作完成
      if (index < total - 1) {
        this.pushDetail(current, current.value);
        this.goRest(index);
      } else {
        this.pushDetail(current, current.value);
        this.finish();
      }
    } else if (phase === 'rest') {
      // 休息结束 -> 下一个动作
      this.enterAction(index + 1);
    }
  },

  // 记录某动作的实际完成量（time 动作=计时满值；reps 动作=用户调整后的实际次数）
  pushDetail(act, actual) {
    this._detail.push({
      name: act.name,
      type: act.type,
      target: act.value,
      actual
    });
  },

  // 根据动作名读取历史成绩，构造展示文案
  buildHist(act) {
    const hist = loadHist();
    const rec = hist[act.name];
    if (!rec || act.type !== 'reps') return '';
    let line = '';
    if (rec.last) line += '上回 ' + rec.last + ' 次';
    if (rec.best) line += (line ? ' · ' : '') + '个人最佳 ' + rec.best + ' 次';
    return line;
  },

  // 计数动作完成时更新历史 + 判新纪录（hist: 每次成绩序列，供记录页画进步曲线；旧数据无 hist 时向后兼容初始化）
  commitBest(name, actual) {
    if (!name || !actual) return;
    const hist = loadHist();
    const rec = hist[name] || {};
    const last = actual;
    const best = Math.max(actual, rec.best || 0);
    const isRecord = best > (rec.best || 0);
    if (isRecord && rec.best) this._recordCount++;
    const seq = (rec.hist && rec.hist.length) ? rec.hist.slice() : (rec.count ? [rec.last] : []);
    seq.push(actual);
    if (seq.length > 30) seq.splice(0, seq.length - 30);
    hist[name] = {
      last, best,
      bestDate: (rec.best && !isRecord) ? rec.bestDate : new Date().toISOString().slice(0, 10),
      lastDate: new Date().toISOString().slice(0, 10),
      count: (rec.count || 0) + 1,
      hist: seq
    };
    saveHist(hist);
    return isRecord;
  },

  enterAction(idx) {
    const { course, total } = this.data;
    const act = course.actions[idx];
    const repsActual = act.type === 'reps' ? act.value : 0;
    this.setData({
      index: idx,
      phase: 'action',
      current: act,
      remaining: act.type === 'time' ? act.value : 0,
      repsActual,
      histLine: this.buildHist(act),
      progress: this.calcProgress(idx),
      running: true,
      curImgOk: !!(act.gif || act.media),
      nextImgOk: false,
      hurrying: false
    });
    vibrate('medium');
    this.startTimer();
  },

  goRest(idx) {
    const { restSec, total, course } = this.data;
    if (idx >= total - 1) {
      this.finish();
      return;
    }
    const next = course.actions[idx + 1];
    this.setData({
      phase: 'rest',
      remaining: restSec,
      running: true,
      hurrying: false,
      nextImgOk: !!(next.gif || (next.media && next.media.src))
    });
    this.startTimer();
  },

  // 主按钮：计时动作=暂停/继续，计数动作=完成
  onMain() {
    const { phase, current } = this.data;
    if (phase === 'ready') {
      // 等不及想直接开练：跳过准备
      this.enterAction(0);
    } else if (phase === 'action' && current.type === 'reps') {
      this.completeReps();
    } else if (phase === 'action') {
      this.toggle();
    } else if (phase === 'rest') {
      this.enterAction(this.data.index + 1);
    }
  },

  toggle() {
    if (this.data.running) {
      this.clearTimer();
      this.setData({ running: false });
    } else {
      this.startTimer();
    }
  },

  // 计数动作微调实际次数
  adjReps(e) {
    const delta = Number(e.currentTarget.dataset.d || 1);
    const { current, repsActual } = this.data;
    const next = Math.max(0, Math.min(repsActual + delta, current.value * 3));
    this.setData({ repsActual: next });
  },

  // 计数动作完成
  completeReps() {
    const { index, total, current, repsActual, histLine } = this.data;
    const isRecord = this.commitBest(current.name, repsActual);
    this.pushDetail(current, repsActual);
    if (isRecord && histLine) {
      wx.showToast({ title: '🎉 突破个人纪录 ' + repsActual, icon: 'none' });
    } else if (repsActual >= current.value * 1.1) {
      wx.showToast({ title: '超额完成，很猛！', icon: 'none' });
    }
    this.goRest(index);
  },

  // 切换组间休息时长（立即生效）
  setRest(e) {
    const sec = Number(e.currentTarget.dataset.sec || 10);
    wx.setStorageSync('user_rest_sec', sec);
    this.setData({ restSec: sec, remaining: this.data.phase === 'rest' ? sec : this.data.remaining });
  },

  // 跳过当前阶段
  skip() {
    const { phase, index, total, current } = this.data;
    if (phase === 'ready') {
      this.enterAction(0);
      return;
    }
    if (phase === 'action') {
      // 跳过动作也算「完成」（不记录成绩但占位）
      this.pushDetail(current, 0);
      this.goRest(index);
      return;
    }
    if (phase === 'rest') {
      this.enterAction(index + 1);
    }
  },

  restart() {
    const course = this.data.course;
    this.clearTimer();
    this._detail = [];
    this._recordCount = 0;
    this.setData({
      index: -1,
      phase: 'ready',
      current: null,
      remaining: 3,
      progress: 0,
      running: true,
      curImgOk: false
    });
    this.startTimer();
  },

  finish() {
    this.clearTimer();
    const { course } = this.data;
    const now = new Date();
    const date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const doneCount = this._detail.filter(d => d.actual > 0).length;
    app.addRecord({
      courseId: course.id,
      name: course.name,
      duration: course.duration,
      kcal: course.kcal,
      date,
      ts: now.getTime(),
      done: doneCount,
      total: course.actions.length,
      detail: this._detail
    });
    this.setData({
      phase: 'done',
      running: false,
      progress: 100,
      doneCount,
      recordCount: this._recordCount
    });
    vibrate('heavy');
  },

  back() {
    const { phase, index } = this.data;
    if (phase === 'done' || phase === 'ready' || (phase === 'action' && index === 0 && this._detail.length === 0)) {
      wx.navigateBack();
      return;
    }
    const that = this;
    wx.showModal({
      title: '退出训练？',
      content: '本次训练进度不会保存，确定要退出吗？',
      confirmText: '退出',
      confirmColor: '#E4573D',
      success(res) {
        if (res.confirm) {
          that.clearTimer();
          that.clearDemoTimer();
          wx.navigateBack();
        }
      }
    });
  },

  // 打开当前动作演示
  openDemo() {
    const act = this.data.current;
    if (!act) return;
    this.clearTimer();
    this.setData({
      showDemo: true,
      running: false,
      demoName: act.name,
      demoAnim: act.anim || 'dynamic',
      demoTip: act.cue || ANIM_TIP[act.anim] || '',
      phaseIndex: act.anim === 'hold' ? 1 : 0,
      demoMedia: act.gif || (act.media ? act.media.src : ''),
      demoImgOk: false
    });
    this.startDemoTimer(act.anim);
  },

  // 真实素材图加载成功 -> 隐藏 SVG 动画
  onDemoImgLoad() {
    this.setData({ demoImgOk: true });
  },
  // 真实素材图加载失败 -> 回退 SVG 动画
  onDemoImgError() {
    this.setData({ demoMedia: '', demoImgOk: false });
  },

  // 主界面动作真图加载成功/失败（失败回退 emoji 大图标）
  onCurImgLoad() {
    this.setData({ curImgOk: true });
  },
  onCurImgErr() {
    this.setData({ curImgOk: false });
  },

  // 休息卡「下一动作」预览图加载成功/失败
  onNextImgLoad() {
    this.setData({ nextImgOk: true });
  },
  onNextImgErr() {
    this.setData({ nextImgOk: false });
  },

  startDemoTimer(anim) {
    this.clearDemoTimer();
    if (anim === 'hold') return;
    this._demoTimer = setInterval(() => {
      this.setData({ phaseIndex: (this.data.phaseIndex + 1) % 3 });
    }, 600);
  },

  clearDemoTimer() {
    if (this._demoTimer) {
      clearInterval(this._demoTimer);
      this._demoTimer = null;
    }
  },

  closeDemo() {
    this.clearDemoTimer();
    this.setData({ showDemo: false, demoMedia: '', demoImgOk: false });
    // 演示关闭后若仍在训练中则恢复计时
    if (this.data.phase !== 'done') this.startTimer();
  },

  noop() {},

  goRecord() {
    wx.redirectTo({ url: '/pages/record/record' });
  },

  onShow() {
    wx.setKeepScreenOn({ keepScreenOn: true });
  },

  onHide() {
    // 页面隐藏（如切后台/看演示弹层）不关常亮
  },

  onUnload() {
    this.clearTimer();
    this.clearDemoTimer();
    wx.setKeepScreenOn({ keepScreenOn: false });
  }
});
