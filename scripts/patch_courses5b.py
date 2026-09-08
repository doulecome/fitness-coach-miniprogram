# -*- coding: utf-8 -*-
"""把 18 个新动作按「逐个缺失才插入」接入各课程（单进程读写，避免竞态与漏插）。"""
P = 'utils/data.js'
s = open(P, encoding='utf-8').read()

# (anchor 末行, [新动作行...]) 末行即该课程 actions 数组最后一个元素
COURSES = [
    ("      { name: '四足深蹲拉伸', icon: '🐾', type: 'time', value: 30 }", [
        "{ name: '坐姿脊柱扭转', icon: '🧘', type: 'time', value: 40 }",
        "{ name: '青蛙式', icon: '🐸', type: 'time', value: 40 }",
        "{ name: '站姿小腿拉伸', icon: '🦵', type: 'time', value: 40 }",
        "{ name: '肱三头肌拉伸', icon: '💪', type: 'time', value: 30 }",
    ]),
    ("      { name: '垂悬举腿', icon: '🪝', type: 'reps', value: 12 }", [
        "{ name: '悬垂屈膝举腿', icon: '🪝', type: 'reps', value: 12 }",
        "{ name: '绳索转体', icon: '🎯', type: 'reps', value: 16 }",
        "{ name: '壶铃风车', icon: '🔔', type: 'reps', value: 10 }",
    ]),
    ("      { name: '杠铃硬拉', icon: '🏋️', type: 'reps', value: 12 },\n      { name: '杠铃前蹲', icon: '🏋️', type: 'reps', value: 12 }", [
        "{ name: '壶铃风车', icon: '🔔', type: 'reps', value: 10 }",
        "{ name: '腿举', icon: '🦵', type: 'reps', value: 15 }",
        "{ name: '哈克深蹲', icon: '🏋️', type: 'reps', value: 12 }",
        "{ name: '腿伸展', icon: '🦵', type: 'reps', value: 16 }",
        "{ name: '手枪蹲', icon: '🦵', type: 'reps', value: 8 }",
    ]),
    ("      { name: '跳蹲', icon: '🦘', type: 'reps', value: 14 }", [
        "{ name: '箱跳', icon: '📦', type: 'reps', value: 16 }",
    ]),
    ("      { name: '冲刺跑', icon: '🏃', type: 'time', value: 30 }", [
        "{ name: '箱跳', icon: '📦', type: 'reps', value: 16 }",
    ]),
    ("      { name: '击掌俯卧撑', icon: '👏', type: 'reps', value: 10 }", [
        "{ name: '杠铃肩上推举', icon: '🏋️', type: 'reps', value: 10 }",
        "{ name: '地板卧推', icon: '🏋️', type: 'reps', value: 12 }",
    ]),
    ("      { name: '弓箭手引体', icon: '🏹', type: 'reps', value: 6 }", [
        "{ name: '杠铃耸肩', icon: '🤷', type: 'reps', value: 16 }",
        "{ name: 'T杠划船', icon: '🏋️', type: 'reps', value: 12 }",
        "{ name: '杠铃上拉', icon: '🏋️', type: 'reps', value: 12 }",
        "{ name: '杠铃肩上推举', icon: '🏋️', type: 'reps', value: 10 }",
        "{ name: '借力推举', icon: '🏋️', type: 'reps', value: 10 }",
    ]),
    ("      { name: '弹力带面拉', icon: '🎯', type: 'reps', value: 15 }", [
        "{ name: '杠铃耸肩', icon: '🤷', type: 'reps', value: 16 }",
        "{ name: 'T杠划船', icon: '🏋️', type: 'reps', value: 12 }",
        "{ name: '杠铃上拉', icon: '🏋️', type: 'reps', value: 12 }",
        "{ name: '杠铃肩上推举', icon: '🏋️', type: 'reps', value: 10 }",
        "{ name: '借力推举', icon: '🏋️', type: 'reps', value: 10 }",
        "{ name: '地板卧推', icon: '🏋️', type: 'reps', value: 12 }",
        "{ name: '腿举', icon: '🦵', type: 'reps', value: 15 }",
        "{ name: '哈克深蹲', icon: '🏋️', type: 'reps', value: 12 }",
        "{ name: '腿伸展', icon: '🦵', type: 'reps', value: 16 }",
    ]),
]

total = 0
for anchor, news in COURSES:
    missing = [ln for ln in news if ("name: '%s'" % ln.split("'")[1]) not in s]
    if not missing:
        print('SKIP (all present):', anchor.strip()[:30])
        continue
    old = anchor + "\n    ]"
    if old not in s:
        print('WARN anchor missing:', anchor.strip()[:30]); continue
    block = ",\n".join("      " + ln for ln in missing)
    repl = anchor + ",\n" + block + "\n    ]"
    s = s.replace(old, repl, 1)
    total += len(missing)
    print('INSERTED %d into %s' % (len(missing), anchor.strip()[:30]))

open(P, 'w', encoding='utf-8').write(s)
print('共插入 %d 个动作行' % total)
