const stats = require('../../utils/stats.js');

function bmiCategory(bmi) {
  if (bmi < 18.5) return { category: '偏瘦', color: '#4A90E2', tip: '体重偏低，注意均衡营养、适度增肌。' };
  if (bmi < 24) return { category: '正常', color: '#1FD6A8', tip: '体型很棒，保持规律训练与健康饮食。' };
  if (bmi < 28) return { category: '偏胖', color: '#FFB020', tip: '略有富余，建议增加有氧、控制热量。' };
  return { category: '肥胖', color: '#FF5C77', tip: '建议制定减脂计划，循序渐进。' };
}

Page({
  data: {
    height: '',
    weight: '',
    bmi: null,
    category: '',
    color: '#9AA0A6',
    tip: '',
    trend: [],
    records: []
  },

  onShow() {
    this.load();
  },

  load() {
    const list = wx.getStorageSync('body_records') || [];
    list.sort((a, b) => a.ts - b.ts);
    const latest = list[list.length - 1];
    let bmi = null, category = '', color = '#9AA0A6', tip = '';
    if (latest && latest.height && latest.weight) {
      const h = latest.height / 100;
      bmi = +(latest.weight / (h * h)).toFixed(1);
      const c = bmiCategory(bmi);
      category = c.category;
      color = c.color;
      tip = c.tip;
    }
    // 最近 7 次体重趋势
    const recent = list.slice(-7);
    const weights = recent.map(r => r.weight);
    const min = Math.min.apply(null, weights);
    const max = Math.max.apply(null, weights);
    const range = (max - min) || 1;
    const trend = recent.map(r => ({
      date: r.date.slice(5),
      weight: r.weight,
      h: Math.round(((r.weight - min) / range) * 100) + '%'
    }));
    this.setData({
      records: list.slice().reverse(),
      bmi,
      category,
      color,
      tip,
      trend,
      height: latest ? '' + latest.height : '',
      weight: ''
    });
  },

  onHeight(e) {
    this.setData({ height: e.detail.value });
  },

  onWeight(e) {
    this.setData({ weight: e.detail.value });
  },

  save() {
    const h = parseFloat(this.data.height);
    const w = parseFloat(this.data.weight);
    if (!h || !w || h < 100 || h > 250 || w < 30 || w > 200) {
      wx.showToast({ title: '请填写有效身高体重', icon: 'none' });
      return;
    }
    const list = wx.getStorageSync('body_records') || [];
    const today = stats.dateStr(new Date());
    const exist = list.find(r => r.date === today);
    if (exist) {
      exist.height = h;
      exist.weight = w;
    } else {
      list.push({ ts: Date.now(), date: today, height: h, weight: w });
    }
    wx.setStorageSync('body_records', list);
    this.setData({ weight: '' });
    this.load();
    wx.showToast({ title: '已记录', icon: 'success' });
  },

  clearBody() {
    const that = this;
    wx.showModal({
      title: '清空身体数据',
      content: '确定删除全部身体数据吗？',
      success(res) {
        if (res.confirm) {
          wx.removeStorageSync('body_records');
          that.load();
        }
      }
    });
  }
});
