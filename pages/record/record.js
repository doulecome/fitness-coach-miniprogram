const app = getApp();
const stats = require('../../utils/stats.js');
const data = require('../../utils/data.js');

// 若你有后端可在此填入「微信运动数据解密」接口，留空则走手动录入降级
// 解密需要 session_key（来自 wx.login 换取的 code），服务端用 AES-128-CBC 解密 encryptedData
const WERUN_DECRYPT_URL = '';

function dateStr(d) { return stats.dateStr(d); }

function loadSteps() {
  return wx.getStorageSync('werun_steps') || [];
}

// 近 7 天步数（含今天），用于柱状图
function last7Steps() {
  const all = loadSteps();
  const map = {};
  all.forEach(s => { map[s.date] = s.steps; });
  const arr = [];
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = dateStr(d);
    arr.push({ label: labels[d.getDay()], date: ds, steps: map[ds] || 0 });
  }
  const max = Math.max(1, ...arr.map(a => a.steps));
  arr.forEach(a => { a.pct = Math.round((a.steps / max) * 100); });
  return arr;
}

// 动作名 -> {icon, type, value} 索引（进步卡取图标与目标量）
function buildActIdx() {
  const idx = {};
  data.courses.forEach(c => c.actions.forEach(a => {
    if (!idx[a.name]) idx[a.name] = a;
  }));
  return idx;
}

// 从 action_best 构建「动作进步」列表：spark 曲线 + 较上轮趋势 + 目标对照
function buildProgress() {
  const best = wx.getStorageSync('action_best') || {};
  const idx = buildActIdx();
  const out = [];
  Object.keys(best).forEach(name => {
    const r = best[name];
    const act = idx[name];
    // 只展示仍在课程中使用、且为计数(reps)的动作；time 动作与已下架动作不计成绩
    if (!act || act.type !== 'reps') return;
    const seq = (r.hist && r.hist.length) ? r.hist : [r.last];
    const max = Math.max.apply(null, seq);
    const n = seq.length;
    const lastV = seq[n - 1];
    const prevV = n > 1 ? seq[n - 2] : null;
    let trend = 'new', trendTxt = '首次记录';
    if (prevV !== null) {
      const d = lastV - prevV;
      if (d > 0) { trend = 'up'; trendTxt = '较上轮 +' + d; }
      else if (d < 0) { trend = 'down'; trendTxt = '较上轮 ' + d; }
      else { trend = 'flat'; trendTxt = '与上轮持平'; }
    }
    const bars = seq.slice(-12).map(v => ({
      v,
      h: v >= max ? 100 : Math.max(14, Math.round((v / max) * 100)),
      hi: v >= max // 是否追平个人最佳
    }));
    out.push({
      name,
      icon: act.icon,
      goal: act.value,
      best: r.best,
      last: lastV,
      count: r.count,
      lastDate: r.lastDate || '',
      trend,
      trendTxt,
      bars
    });
  });
  // 最近练过的优先；同日期按最佳成绩降序（稳定）
  out.sort((a, b) => {
    if (a.lastDate !== b.lastDate) return a.lastDate < b.lastDate ? 1 : -1;
    return b.best - a.best;
  });
  return out.slice(0, 8); // 最多展示最近练过的 8 个动作
}

// 记录明细 -> 弹层行（含达标/未达/跳过判定）
function buildDetailRows(detail, actIdx) {
  return (detail || []).map(d => {
    const act = actIdx[d.name];
    const targetTxt = (d.type === 'time' ? d.target + ' 秒' : '目标 ' + d.target + ' 次');
    let state = 'ok', stTxt = '';
    if (!d.actual) {
      state = 'skip';
      stTxt = '跳过';
    } else if (d.type === 'time') {
      state = d.actual >= d.target ? 'ok' : 'miss';
      stTxt = d.actual >= d.target ? '✓ 完成' : '未完成';
    } else if (d.actual >= d.target) {
      state = d.actual > d.target ? 'over' : 'ok';
      stTxt = d.actual > d.target ? '+' + (d.actual - d.target) + ' ✓' : '达标 ✓';
    } else {
      state = 'miss';
      stTxt = d.actual + ' / ' + d.target;
    }
    return {
      icon: act ? act.icon : '🏋️',
      name: d.name,
      targetTxt,
      state,
      stTxt
    };
  });
}

Page({
  data: {
    records: [],
    totalMin: 0,
    totalKcal: 0,
    streak: 0,
    monthTrained: 0,
    count: 0,
    week: ['一', '二', '三', '四', '五', '六', '日'],
    calendar: { cells: [], monthLabel: '' },
    // 动作进步
    progress: [],
    // 微信运动
    werunToday: 0,
    weekSteps: [],
    showStepInput: false,
    stepInput: '',
    // 记录明细弹层
    showRecDetail: false,
    recDetail: null
  },

  onShow() {
    const records = app.globalData.records || [];
    let totalMin = 0;
    let totalKcal = 0;
    const monthSet = new Set();
    const ym = stats.dateStr(new Date()).slice(0, 7);
    records.forEach(r => {
      totalMin += r.duration;
      totalKcal += r.kcal;
      if (r.date.slice(0, 7) === ym) monthSet.add(r.date);
    });

    const steps = loadSteps();
    const today = dateStr(new Date());
    const todayObj = steps.find(s => s.date === today);

    this.setData({
      records,
      totalMin,
      totalKcal,
      streak: stats.computeStreak(records),
      monthTrained: monthSet.size,
      count: records.length,
      calendar: stats.buildMonthGrid(records),
      progress: buildProgress(),
      werunToday: todayObj ? todayObj.steps : 0,
      weekSteps: last7Steps()
    });
  },

  goTrain() {
    wx.switchTab({ url: '/pages/train/train' });
  },

  noop() {},

  // 打开某次记录的当次动作明细（目标 vs 实际复盘）
  openRec(e) {
    const i = Number(e.currentTarget.dataset.i);
    const r = this.data.records[i];
    if (!r) return;
    const actIdx = buildActIdx();
    const rows = buildDetailRows(r.detail, actIdx);
    this.setData({
      recDetail: {
        name: r.name,
        date: r.date,
        done: r.done,
        total: r.total,
        rows,
        legacy: !(r.detail && r.detail.length)
      },
      showRecDetail: true
    });
  },

  closeRecDetail() {
    this.setData({ showRecDetail: false, recDetail: null });
  },

  // 同步微信运动：优先走官方接口，无后端则降级为手动录入
  syncWeRun() {
    const that = this;
    wx.getWeRunData({
      success(res) {
        // res.encryptedData / res.iv 需服务端用 session_key 解密才是真实步数
        if (WERUN_DECRYPT_URL) {
          wx.login({
            success(lo) {
              wx.request({
                url: WERUN_DECRYPT_URL,
                method: 'POST',
                data: {
                  code: lo.code,
                  encryptedData: res.encryptedData,
                  iv: res.iv
                },
                success(r) {
                  if (r.data && r.data.stepInfoList) {
                    that.saveSteps(r.data.stepInfoList);
                  } else {
                    that.fallbackInput();
                  }
                },
                fail() { that.fallbackInput(); }
              });
            },
            fail() { that.fallbackInput(); }
          });
        } else {
          wx.showModal({
            title: '微信运动已授权',
            content: '步数需在服务端解密（需配置 WERUN_DECRYPT_URL）。当前先手动录入今日步数？',
            confirmText: '手动录入',
            success(m) { if (m.confirm) that.setData({ showStepInput: true }); }
          });
        }
      },
      fail() {
        wx.showModal({
          title: '无法获取微信运动',
          content: '请确认已授权微信运动，或在微信中开启。也可手动录入今日步数。',
          confirmText: '手动录入',
          success(m) { if (m.confirm) that.setData({ showStepInput: true }); }
        });
      }
    });
  },

  // 服务端返回 stepInfoList: [{date, step}] 批量写入
  saveSteps(list) {
    const all = loadSteps();
    list.forEach(it => {
      const ds = dateStr(new Date(it.timestamp * 1000));
      const idx = all.findIndex(s => s.date === ds);
      if (idx >= 0) all[idx].steps = it.step;
      else all.push({ date: ds, steps: it.step });
    });
    wx.setStorageSync('werun_steps', all);
    this.onShow();
  },

  fallbackInput() {
    this.setData({ showStepInput: true });
  },

  onStepInput(e) {
    this.setData({ stepInput: e.detail.value });
  },

  closeStep() {
    this.setData({ showStepInput: false, stepInput: '' });
  },

  confirmStep() {
    const v = parseInt(this.data.stepInput, 10);
    if (!v || v <= 0) {
      wx.showToast({ title: '请输入有效步数', icon: 'none' });
      return;
    }
    const all = loadSteps();
    const today = dateStr(new Date());
    const idx = all.findIndex(s => s.date === today);
    if (idx >= 0) all[idx].steps = v;
    else all.push({ date: today, steps: v });
    wx.setStorageSync('werun_steps', all);
    this.setData({ showStepInput: false, stepInput: '' });
    this.onShow();
    wx.showToast({ title: '已记录', icon: 'success' });
  },

  clearAll() {
    const that = this;
    wx.showModal({
      title: '清空记录',
      content: '确定删除全部训练记录吗？此操作不可恢复。',
      success(res) {
        if (res.confirm) {
          wx.removeStorageSync('workout_records');
          wx.removeStorageSync('action_best');
          app.globalData.records = [];
          that.setData({ records: [], totalMin: 0, totalKcal: 0, streak: 0, monthTrained: 0, count: 0, progress: [] });
        }
      }
    });
  }
});
