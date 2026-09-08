# -*- coding: utf-8 -*-
"""一次性把 18 个新动作接入各课程 actions 数组（单进程读写，避免并行编辑竞态）。
已在文件中的动作(如 upupper 已插入)自动跳过，不会重复。"""
import io

P = 'utils/data.js'
s = open(P, encoding='utf-8').read()

# (anchor 末行, 需插入的 actions 文本)
PAIRS = [
    ("      { name: '四足深蹲拉伸', icon: '🐾', type: 'time', value: 30 }\n    ]",
     "      { name: '四足深蹲拉伸', icon: '🐾', type: 'time', value: 30 },\n"
     "      { name: '坐姿脊柱扭转', icon: '🧘', type: 'time', value: 40 },\n"
     "      { name: '青蛙式', icon: '🐸', type: 'time', value: 40 },\n"
     "      { name: '站姿小腿拉伸', icon: '🦵', type: 'time', value: 40 },\n"
     "      { name: '肱三头肌拉伸', icon: '💪', type: 'time', value: 30 }\n    ]"),
    ("      { name: '垂悬举腿', icon: '🪝', type: 'reps', value: 12 }\n    ]",
     "      { name: '垂悬举腿', icon: '🪝', type: 'reps', value: 12 },\n"
     "      { name: '悬垂屈膝举腿', icon: '🪝', type: 'reps', value: 12 },\n"
     "      { name: '绳索转体', icon: '🎯', type: 'reps', value: 16 },\n"
     "      { name: '壶铃风车', icon: '🔔', type: 'reps', value: 10 }\n    ]"),
    ("      { name: '杠铃硬拉', icon: '🏋️', type: 'reps', value: 12 },\n      { name: '杠铃前蹲', icon: '🏋️', type: 'reps', value: 12 }\n    ]",
     "      { name: '杠铃硬拉', icon: '🏋️', type: 'reps', value: 12 },\n      { name: '杠铃前蹲', icon: '🏋️', type: 'reps', value: 12 },\n"
     "      { name: '壶铃风车', icon: '🔔', type: 'reps', value: 10 },\n"
     "      { name: '腿举', icon: '🦵', type: 'reps', value: 15 },\n"
     "      { name: '哈克深蹲', icon: '🏋️', type: 'reps', value: 12 },\n"
     "      { name: '腿伸展', icon: '🦵', type: 'reps', value: 16 },\n"
     "      { name: '手枪蹲', icon: '🦵', type: 'reps', value: 8 }\n    ]"),
    ("      { name: '跳蹲', icon: '🦘', type: 'reps', value: 14 }\n    ]",
     "      { name: '跳蹲', icon: '🦘', type: 'reps', value: 14 },\n"
     "      { name: '箱跳', icon: '📦', type: 'reps', value: 16 }\n    ]"),
    ("      { name: '冲刺跑', icon: '🏃', type: 'time', value: 30 }\n    ]",
     "      { name: '冲刺跑', icon: '🏃', type: 'time', value: 30 },\n"
     "      { name: '箱跳', icon: '📦', type: 'reps', value: 16 }\n    ]"),
    ("      { name: '击掌俯卧撑', icon: '👏', type: 'reps', value: 10 }\n    ]",
     "      { name: '击掌俯卧撑', icon: '👏', type: 'reps', value: 10 },\n"
     "      { name: '杠铃肩上推举', icon: '🏋️', type: 'reps', value: 10 },\n"
     "      { name: '地板卧推', icon: '🏋️', type: 'reps', value: 12 }\n    ]"),
    ("      { name: '弓箭手引体', icon: '🏹', type: 'reps', value: 6 }\n    ]",
     "      { name: '弓箭手引体', icon: '🏹', type: 'reps', value: 6 },\n"
     "      { name: '杠铃耸肩', icon: '🤷', type: 'reps', value: 16 },\n"
     "      { name: 'T杠划船', icon: '🏋️', type: 'reps', value: 12 },\n"
     "      { name: '杠铃上拉', icon: '🏋️', type: 'reps', value: 12 },\n"
     "      { name: '杠铃肩上推举', icon: '🏋️', type: 'reps', value: 10 },\n"
     "      { name: '借力推举', icon: '🏋️', type: 'reps', value: 10 }\n    ]"),
    ("      { name: '弹力带面拉', icon: '🎯', type: 'reps', value: 15 }\n    ]",
     "      { name: '弹力带面拉', icon: '🎯', type: 'reps', value: 15 },\n"
     "      { name: '杠铃耸肩', icon: '🤷', type: 'reps', value: 16 },\n"
     "      { name: 'T杠划船', icon: '🏋️', type: 'reps', value: 12 },\n"
     "      { name: '杠铃上拉', icon: '🏋️', type: 'reps', value: 12 },\n"
     "      { name: '杠铃肩上推举', icon: '🏋️', type: 'reps', value: 10 },\n"
     "      { name: '借力推举', icon: '🏋️', type: 'reps', value: 10 },\n"
     "      { name: '地板卧推', icon: '🏋️', type: 'reps', value: 12 },\n"
     "      { name: '腿举', icon: '🦵', type: 'reps', value: 15 },\n"
     "      { name: '哈克深蹲', icon: '🏋️', type: 'reps', value: 12 },\n"
     "      { name: '腿伸展', icon: '🦵', type: 'reps', value: 16 }\n    ]"),
]

applied = 0
for anchor, repl in PAIRS:
    # 取插入块里「新增」动作名做存在性判断，避免重复插入
    import re
    names_in_repl = re.findall(r"name: '([^']+)'", repl)
    names_in_anchor = re.findall(r"name: '([^']+)'", anchor)
    new_names = [n for n in names_in_repl if n not in names_in_anchor]
    first = new_names[0]
    if ("name: '%s'" % first) in s:
        # 已存在于课程中（可能 upupper 已插入），跳过该课程
        print('SKIP (already in course):', first)
        continue
    if anchor not in s:
        print('WARN anchor not found:', first)
        continue
    s = s.replace(anchor, repl, 1)
    applied += 1
    print('APPLIED:', first)

open(P, 'w', encoding='utf-8').write(s)
print('已完成 %d 处课程插入' % applied)
