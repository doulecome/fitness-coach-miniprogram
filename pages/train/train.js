const { courses, ANIM_TIP } = require('../../utils/data.js');

// 把动作按肌群聚合
function buildActionGroups() {
  const map = {};
  courses.forEach(c => {
    c.actions.forEach(a => {
      const m = c.muscle || c.cat;
      if (!map[m]) map[m] = [];
      map[m].push({
        name: a.name,
        icon: a.icon,
        type: a.type,
        value: a.value,
        course: c.name
      });
    });
  });
  return Object.keys(map).map(m => ({ muscle: m, list: map[m] }));
}

function suggestion(act) {
  if (act.type === 'reps') return '建议 3-4 组 × ' + act.value + ' 次，组间休息 30-45 秒';
  return '保持 ' + act.value + ' 秒，做 2-3 组，注意呼吸匀速';
}

Page({
  data: {
    tab: 'course',
    cats: ['全部', '减脂', '增肌', '核心', '拉伸'],
    activeCat: '全部',
    list: [],
    groups: [],
    // 动作详情弹层
    showDetail: false,
    detail: null,
    detailCue: '',
    detailTip: '',
    // 动作演示弹层
    showDemo: false,
    demoName: '',
    demoAnim: 'dynamic',
    demoTip: '',
    phaseIndex: 0,
    demoMedia: '',
    demoImgOk: false
  },

  onLoad() {
    this.filter('全部');
    this.setData({ groups: buildActionGroups() });
  },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  setCat(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ activeCat: cat });
    this.filter(cat);
  },

  filter(cat) {
    const list = cat === '全部' ? courses : courses.filter(c => c.cat === cat);
    this.setData({ list });
  },

  start(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/workout/workout?courseId=' + id });
  },

  openAction(e) {
    const ds = e.currentTarget.dataset;
    const act = { name: ds.name, icon: ds.icon, type: ds.type, value: Number(ds.value), course: ds.course };
    let cue = '';
    outer:
    for (const c of courses) {
      for (const a of c.actions) {
        if (a.name === act.name && a.cue) { cue = a.cue; break outer; }
      }
    }
    this.setData({ showDetail: true, detail: act, detailCue: cue, detailTip: suggestion(act) });
  },

  // 打开动作演示动画
  openDemo() {
    const act = this.data.detail;
    if (!act) return;
    let media = '';
    outer:
    for (const c of courses) {
      for (const a of c.actions) {
        if (a.name === act.name && (a.gif || a.media)) { media = a.gif || a.media.src; break outer; }
      }
    }
    this.setData({
      showDemo: true,
      demoName: act.name,
      demoAnim: act.anim || 'dynamic',
      demoTip: act.cue || ANIM_TIP[act.anim] || '',
      phaseIndex: act.anim === 'hold' ? 1 : 0,
      demoMedia: media,
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

  startDemoTimer(anim) {
    this.clearDemoTimer();
    if (anim === 'hold') return; // 静态保持不循环相位
    this._demoTimer = setInterval(() => {
      const next = (this.data.phaseIndex + 1) % 3;
      this.setData({ phaseIndex: next });
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
  },

  closeDetail() {
    this.setData({ showDetail: false, detail: null });
  },

  noop() {},

  startFromDetail() {
    const act = this.data.detail;
    const course = courses.find(c => c.name === act.course);
    this.setData({ showDetail: false, detail: null });
    if (course) wx.navigateTo({ url: '/pages/workout/workout?courseId=' + course.id });
  }
});
