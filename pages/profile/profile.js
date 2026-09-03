const app = getApp();
const stats = require('../../utils/stats.js');

Page({
  data: {
    userName: '训练者',
    level: 1,
    levelName: '健身萌新',
    streak: 0,
    totalMin: 0,
    menus: [
      { name: '身体数据', icon: '📏', page: '/pages/body/body' },
      { name: '我的计划', icon: '📋' },
      { name: '训练偏好', icon: '⚙️' },
      { name: '关于练练', icon: '💡' }
    ]
  },

  onShow() {
    const records = app.globalData.records || [];
    let totalMin = 0;
    records.forEach(r => { totalMin += r.duration; });
    const level = totalMin >= 300 ? 4 : totalMin >= 150 ? 3 : totalMin >= 60 ? 2 : 1;
    const levelName = ['健身萌新', '健身新手', '自律达人', '健身老炮', '肌肉教练'][level - 1] || '健身萌新';
    this.setData({
      userName: app.globalData.userName,
      streak: stats.computeStreak(records),
      totalMin,
      level,
      levelName
    });
  },

  openMenu(e) {
    const page = e.currentTarget.dataset.page;
    if (page) wx.navigateTo({ url: page });
  }
});
