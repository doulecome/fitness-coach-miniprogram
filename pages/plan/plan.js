const { generatePlan } = require('../../utils/plan.js');

const GOALS = ['减脂', '增肌', '塑形', '拉伸放松', '保持健康'];
const DAYS = [3, 4, 5, 6];
const LENGTHS = [15, 30, 45];
const LEVELS = ['新手', '进阶', '老手'];
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']; // 0=周一..6=周日

Page({
  data: {
    goals: GOALS,
    days: DAYS,
    lengths: LENGTHS,
    levels: LEVELS,
    weekLabels: WEEK_LABELS,
    goal: '减脂',
    day: 4,
    length: 30,
    level: '新手',
    restDays: [], // 自定义休息日下标（0=周一..6=周日）
    restOn: [false, false, false, false, false, false, false],
    generated: false,
    plan: null,
    // 当前展示的周（周期内 0-3）
    weekIndex: 0,
    weekTabs: [],
    weekTip: '',
    planWeek: [],      // 当前周 7 天视图（每天含完整 acts/seq）
    summaryDays: 0,
    summaryMin: 0,
    summaryKcal: 0,
    customTotal: 0,
    todayCourse: null, // 今日卡片 {name,typeName,duration,rest}
    todayDayIdx: -1,
    daySheet: { show: false }
  },

  onLoad() {
    let saved = null;
    try { saved = wx.getStorageSync('ai_plan'); } catch (e) {}
    // v4 之前生成的计划结构已不兼容（旧=排课表，新=动态编排训练），引导重新生成
    if (saved && saved.v !== 4) {
      try { wx.removeStorageSync('ai_plan'); } catch (e) {}
      try { wx.removeStorageSync('ai_plan_start'); } catch (e) {}
      saved = null;
      wx.showToast({ title: '旧版计划已升级，请重新生成', icon: 'none' });
    }
    if (saved) this.applyPlan(saved, 0);
  },

  restDayText(restDays) {
    if (!restDays || !restDays.length) return '';
    return '已按你的休息日安排：' + restDays.map(i => '周' + WEEK_LABELS[i]).join('、');
  },

  // 应用计划并展示第 weekIdx 周
  applyPlan(plan, weekIdx) {
    if (plan.restDayText == null) plan.restDayText = this.restDayText(plan.restDays);
    const idx = Math.min(Math.max(weekIdx || 0, 0), 3);
    const w = plan.weeks[idx];
    const jsDay = new Date().getDay(); // 0=周日
    const tIdx = jsDay === 0 ? 6 : jsDay - 1;
    const today = w.week[tIdx];
    this.setData({
      generated: true,
      plan,
      weekIndex: idx,
      weekTabs: plan.weeks.map((x, i) => ({ i, label: x.label, days: x.days })),
      weekTip: plan.weeks[idx].tip,
      planWeek: w.week,
      summaryDays: w.days,
      summaryMin: w.totalMin,
      summaryKcal: w.totalKcal,
      customTotal: plan.customTotal || 0,
      todayDayIdx: today && !today.rest ? tIdx : -1,
      todayCourse: today ? { name: today.typeName, icon: today.icon, typeName: today.typeName, duration: today.duration, rest: today.rest } : null,
      daySheet: { show: false }
    });
  },

  choose(e) {
    const { field, value } = e.currentTarget.dataset;
    this.setData({ [field]: value });
  },

  toggleRest(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const set = new Set(this.data.restDays);
    if (set.has(idx)) set.delete(idx); else set.add(idx);
    const arr = [...set].sort((a, b) => a - b);
    const restOn = this.data.weekLabels.map((_, i) => arr.includes(i));
    this.setData({ restDays: arr, restOn });
  },

  clearRest() {
    this.setData({ restDays: [], restOn: [false, false, false, false, false, false, false] });
  },

  regenerate() {
    this.setData({ generated: false, daySheet: { show: false } });
  },

  build() {
    const { goal, day, length, level, restDays } = this.data;
    const hist = wx.getStorageSync('action_best') || null;
    const plan = generatePlan({ goal, days: day, length, level, restDays }, hist);
    plan.restDayText = this.restDayText(plan.restDays);
    try { wx.setStorageSync('ai_plan', plan); } catch (e) {}
    // 记录计划开始日：首页据此自动定位"当前处于第几周"（W1→W4 循环）
    const _d = new Date(), _m = '0' + (_d.getMonth() + 1), _dd = '0' + _d.getDate();
    try { wx.setStorageSync('ai_plan_start', _d.getFullYear() + '-' + _m.slice(-2) + '-' + _dd.slice(-2)); } catch (e) {}
    this.applyPlan(plan, 0);
    if (plan.adjusted) {
      wx.showToast({ title: `已按休息日定为${plan.days}训练天`, icon: 'none' });
    } else if (plan.customTotal) {
      wx.showToast({ title: `已按你的成绩定制 ${plan.customTotal} 个动作`, icon: 'none' });
    } else {
      wx.showToast({ title: '已生成 4 周动态训练计划', icon: 'success' });
    }
  },

  // 切换查看第几周
  switchWeek(e) {
    const i = Number(e.currentTarget.dataset.i);
    if (i === this.data.weekIndex) return;
    this.applyPlan(this.data.plan, i);
  },

  // 把某训练日的执行序列写入 plan_run（跟练页直接按序开练），跳转
  goRun(day) {
    if (!day || day.rest) return;
    const wk = this.data.weekIndex + 1;
    const course = {
      id: '__plan__',
      name: '第' + wk + '周 · ' + day.typeName,
      icon: day.icon,
      duration: day.duration,
      kcal: day.kcal,
      level: this.data.plan.level,
      fromPlan: true,
      actions: day.seq
    };
    try { wx.setStorageSync('plan_run', { course }); } catch (e) {}
    wx.navigateTo({ url: '/pages/workout/workout?courseId=__plan__&fromPlan=1' });
  },

  // 点击某训练日 -> 查看当日完整训练（处方 + 组数 + 教练按语）
  openDay(e) {
    const i = Number(e.currentTarget.dataset.i);
    const day = this.data.planWeek[i];
    if (!day || day.rest) {
      wx.showToast({ title: '💤 休息日，让身体恢复', icon: 'none' });
      return;
    }
    const hist = wx.getStorageSync('action_best') || {};
    const rows = day.acts.map(a => ({
      name: a.name,
      icon: a.icon,
      round: a.round,
      type: a.type,
      target: a.target,
      unit: a.unit,
      tag: a.fin ? '收尾' : (a.cool ? '冷身' : '主项'),
      fromHist: !!(hist[a.name] && hist[a.name].best),
      last: (hist[a.name] && hist[a.name].last) || 0,
      cue: a.cue || ''
    }));
    this.setData({
      daySheet: {
        show: true,
        i,
        wd: day.wd,
        typeName: day.typeName,
        icon: day.icon,
        muscle: day.muscle,
        duration: day.duration,
        kcal: day.kcal,
        nSeq: day.nActs,
        warm: day.warm,
        coach: day.coach,
        custom: day.custom,
        rows
      }
    });
  },

  closeSheet() {
    this.setData({ 'daySheet.show': false });
  },

  noop() {},

  // 弹层内点某动作：轻提示要点（长按看 cue）
  showCue(e) {
    const cue = e.currentTarget.dataset.cue;
    if (cue) wx.showToast({ title: cue, icon: 'none', duration: 2200 });
  },

  // 处方弹层：开始训练
  startSheet() {
    const s = this.data.daySheet;
    if (!s.show) return;
    const day = this.data.planWeek[s.i];
    this.closeSheet();
    if (day && !day.rest) this.goRun(day);
  },

  startToday() {
    const day = this.data.planWeek[this.data.todayDayIdx];
    if (!day || day.rest) { wx.showToast({ title: '💤 今天是休息日', icon: 'none' }); return; }
    this.goRun(day);
  },

  // 周视图卡片上的「开练」按钮
  quickRun(e) {
    const i = Number(e.currentTarget.dataset.i);
    const day = this.data.planWeek[i];
    if (!day || day.rest) {
      wx.showToast({ title: '💤 休息日，让身体恢复', icon: 'none' });
      return;
    }
    this.goRun(day);
  }
});
