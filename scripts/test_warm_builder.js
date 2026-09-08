// 无头冒烟：热身独立屏 + 自定义训练 builder
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'site_app.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
const { window } = dom;
const { document } = window;

function ck(name, cond) { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) process.exitCode = 1; }
function q(s) { return document.querySelector(s); }
function qa(s) { return document.querySelectorAll(s); }
function click(sel) { const e = q(sel); if (!e) throw new Error('no element: ' + sel); e.click(); }

// 同步驱动跟练：skipReady 后进循环，finishAct(act 阶段)/skipRest(rest 阶段) 直到出现 beginMain(热身完成过渡屏)
function driveToWarmDone(max) {
  click('[data-a="skipReady"]');
  for (let i = 0; i < (max || 30); i++) {
    if (q('[data-a="beginMain"]')) return true;
    if (q('[data-a="finishAct"]')) click('[data-a="finishAct"]');
    else if (q('[data-a="skipRest"]')) click('[data-a="skipRest"]');
    else break;
  }
  return !!q('[data-a="beginMain"]');
}

try {
  // —— 热身独立屏（课程路径） ——
  click('[data-a="tab"][data-v="train"]');
  ck('train tab rendered', !!q('.course-grid'));
  click('.course-card'); // 打开第一门课 sheet
  ck('course sheet opened', !!q('[data-a="runCourse"]'));
  click('[data-a="runCourse"]');
  ck('workout overlay visible', q('#wko') && !q('#wko').classList.contains('hide'));
  ck('warm countdown ready screen', !!q('#wnum'));
  const warmOK = driveToWarmDone(40);
  ck('热身完成过渡屏出现(beginMain)', warmOK);
  ck('过渡屏有「开始正式训练」', !!q('[data-a="beginMain"]'));
  ck('热身过渡屏展示自适应热身动作chips(核心课=5)', qa('.wk-warm .wk-wc').length === 5);
  click('[data-a="beginMain"]');
  ck('进入正式训练(主项 act)', !!q('[data-a="finishAct"]') || !!q('.wk-act-name'));

  // 关闭跟练，清掉计时器（v13+ 退出保护：有进度时先进确认屏）
  click('[data-a="closeW"]');
  if (q('[data-a="confirmExit"]')) click('[data-a="confirmExit"]');
  ck('workout closed', q('#wko').classList.contains('hide'));

  // —— 自定义训练 builder ——
  click('[data-a="tab"][data-v="train"]');
  click('[data-a="seg"][data-v="custom"]');
  ck('builder view rendered', !!q('.bld-go'));
  ck('builder groups shown', qa('.bld-g').length >= 4);
  // 选两个动作（均在动作库且有 gif）
  click('[data-a="bldToggle"][data-name="深蹲"]');
  click('[data-a="bldToggle"][data-name="卷腹"]');
  ck('selected 2 shown in footer', /已选\s*<b>2<\/b>/.test(q('.bld-foot').innerHTML));
  // 组数 +1
  click('[data-a="bldRound"][data-v="1"]');
  ck('rounds bumped to 4', /<b>4<\/b>/.test(q('.bld-rd').innerHTML));
  click('[data-a="bldStart"]');
  ck('builder workout started', q('#wko') && !q('#wko').classList.contains('hide'));
  const bOK = driveToWarmDone(40);
  ck('builder 也走热身过渡屏', bOK);
  click('[data-a="beginMain"]');
  ck('builder 进入主项', !!q('[data-a="finishAct"]') || !!q('.wk-act-name'));
  // 主项应是所选动作之一（深蹲/卷腹），验证 builder 真的把勾选动作编进了训练
  const actName = q('.wk-act-name') ? q('.wk-act-name').textContent : '';
  ck('主项来自勾选动作(深蹲/卷腹)', actName.indexOf('深蹲') >= 0 || actName.indexOf('卷腹') >= 0);
  click('[data-a="closeW"]');
  if (q('[data-a="confirmExit"]')) click('[data-a="confirmExit"]');

  ck('no fatal error', true);
} catch (e) {
  console.log('FAIL exception: ' + e.message);
  console.log(e.stack);
  process.exitCode = 1;
}
