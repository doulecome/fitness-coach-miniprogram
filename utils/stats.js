// 训练统计工具
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

// 本地 YYYY-MM-DD（避免 toISOString 的 UTC 偏移）
function dateStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function distinctDates(records) {
  const s = new Set();
  records.forEach(r => s.add(r.date));
  return s;
}

// 连续打卡天数：从今天往前数，今天没练则从昨天起算
function computeStreak(records) {
  const set = distinctDates(records);
  if (!set.size) return 0;
  let d = new Date();
  let key = dateStr(d);
  if (!set.has(key)) {
    d.setDate(d.getDate() - 1);
    key = dateStr(d);
    if (!set.has(key)) return 0;
  }
  let count = 0;
  while (set.has(key)) {
    count++;
    d.setDate(d.getDate() - 1);
    key = dateStr(d);
  }
  return count;
}

// 构建当月日历网格（周一为起始列）
function buildMonthGrid(records, base) {
  base = base || new Date();
  const set = distinctDates(records);
  const y = base.getFullYear();
  const m = base.getMonth();
  const first = new Date(y, m, 1).getDay(); // 0=周日
  const offset = (first + 6) % 7; // 转为周一起始的空格数
  const days = new Date(y, m + 1, 0).getDate();
  const todayKey = dateStr(new Date());
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push({ empty: true });
  for (let d = 1; d <= days; d++) {
    const k = y + '-' + pad(m + 1) + '-' + pad(d);
    cells.push({ empty: false, day: d, has: set.has(k), today: k === todayKey });
  }
  const monthLabel = y + '年' + (m + 1) + '月';
  return { cells, monthLabel };
}

module.exports = { dateStr, computeStreak, buildMonthGrid };
