const app = getApp();
const { courses } = require('../../utils/data.js');

Page({
  data: {
    userName: '训练者',
    greeting: '你好',
    streak: 0,
    totalMin: 0,
    totalKcal: 0,
    recommend: [],
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

    this.setData({
      greeting: g,
      userName: app.globalData.userName,
      streak: dates.size,
      totalMin,
      totalKcal,
      recommend: courses.slice(0, 5)
    });
  },

  goTrain() {
    wx.switchTab({ url: '/pages/train/train' });
  },

  goPlan() {
    wx.navigateTo({ url: '/pages/plan/plan' });
  },

  startCourse(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/workout/workout?courseId=' + id });
  }
});
