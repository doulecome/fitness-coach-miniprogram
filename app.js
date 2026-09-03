App({
  globalData: {
    userName: '训练者',
    records: []
  },

  onLaunch() {
    const records = wx.getStorageSync('workout_records') || [];
    this.globalData.records = records;

    const name = wx.getStorageSync('user_name');
    if (name) this.globalData.userName = name;
  },

  // 保存一次训练记录（倒序存储）
  addRecord(record) {
    const records = wx.getStorageSync('workout_records') || [];
    records.unshift(record);
    wx.setStorageSync('workout_records', records);
    this.globalData.records = records;
  }
});
