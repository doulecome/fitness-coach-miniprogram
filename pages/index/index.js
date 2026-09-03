const app = getApp();
const { courses } = require('../../utils/data.js');
const { todayPlan } = require('../../utils/plan.js');

// 距开始日的完整周数 → 当前处于第几周（4 周循环：W1→W4 后回到 W1）
function weekIndexOf(startDate) {
  try {
    const start = new Date(startDate);
    const now = new Date();
    const days = Math.floor((now - start) / 86400000);
    if (!(days >= 0)) return 0;
    return Math.floor(days / 7) % 4;
  } catch (e) { return 0; }
}
function todayISO() {
  const d = new Date(), m = '0' + (d.getMonth() + 1), dd = '0' + d.getDate();
  return d.getFullYear() + '-' + m.slice(-2) + '-' + dd.slice(-2);
}

Page({
  data: {
    userName: '训练者',
    greeting: '你好',
    streak: 0,
    totalMin: 0,
    totalKcal: 0,
    recommend: [],
    today: null, // 今日计划卡：null=无计划；{rest,wd,week,icon,typeName,duration,nActs}
    goals: [
      { name: '减脂', icon: '🔥' },
      { name: '增肌', icon: '💪' },
      { name: '拉伸', icon: '🧘' },
      { name: '核心', icon: '⚡' }
    ]
  },

  onShow() {
    const h = new Date().getHours();
    let g = '你好';
    if (h < 6) g = '凌晨好';
    else if (h < 12) g = '早上好';
    else if (h < 18) g = '下午好';
    else g = '晚上好';

    const records = app.globalData.records || [];
    let totalMin = 0;
    let totalKcal = 0;
    const dates = new Set();
    records.forEach(r => {
      totalMin += r.duration;
      totalKcal += r.kcal;
      dates.add(r.date);
    });

    // —— 今日计划卡：读取 v4 计划，自动定位当前周，算出今天该练/该休 ——
    let today = null;
    let plan = null;
    try { plan = wx.getStorageSync('ai_plan'); } catch (e) {}
    if (plan && plan.v === 4 && Array.isArray(plan.weeks)) {
      let start = '';
      try { start = wx.getStorageSync('ai_plan_start'); } catch (e) {}
      if (!start) { start = todayISO(); try { wx.setStorageSync('ai_plan_start', start); } catch (e) {} }
      const weekIdx = weekIndexOf(start);
      const day = todayPlan(plan, weekIdx); // 永不抛：内部按 wd 找当天
      if (day && day.wd) {
        today = day.rest
          ? { rest: true, wd: day.wd, week: weekIdx + 1 }
          : { rest: false, wd: day.wd, week: weekIdx + 1, icon: day.icon, typeName: day.typeName, duration: day.duration, nActs: day.nActs };
      }
    }

    this.setData({
      greeting: g,
      userName: app.globalData.userName,
      streak: dates.size,
      totalMin,
      totalKcal,
      today,
      recommend: courses.slice(0, 5)
    });
  },

  goTrain() {
    wx.switchTab({ url: '/pages/train/train' });
  },

  goPlan() {
    wx.navigateTo({ url: '/pages/plan/plan' });
  },

  // 首页今日计划卡：直接按「今天该练的处方」开练（与计划页 goRun 同构）
  startPlanToday() {
    const today = this.data.today;
    if (!today || today.rest) {
      wx.showToast({ title: today && today.rest ? '💤 今天是休息日' : '请先在「计划」页生成训练计划', icon: 'none' });
      return;
    }
    let plan = null;
    try { plan = wx.getStorageSync('ai_plan'); } catch (e) {}
    if (!plan || plan.v !== 4) return;
    let start = '';
    try { start = wx.getStorageSync('ai_plan_start'); } catch (e) {}
    const weekIdx = weekIndexOf(start);
    const day = todayPlan(plan, weekIdx);
    if (!day || day.rest) return;
    const course = {
      id: '__plan__',
      name: '第' + today.week + '周 · ' + day.typeName,
      icon: day.icon,
      duration: day.duration,
      kcal: day.kcal,
      level: plan.level || '进阶',
      fromPlan: true,
      actions: day.seq
    };
    try { wx.setStorageSync('plan_run', { course }); } catch (e) {}
    wx.navigateTo({ url: '/pages/workout/workout?courseId=__plan__&fromPlan=1' });
  },

  startCourse(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/workout/workout?courseId=' + id });
  }
});
