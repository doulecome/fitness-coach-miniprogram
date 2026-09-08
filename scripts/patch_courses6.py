# -*- coding: utf-8 -*-
"""第六批：把 18 个动作(8孤儿+10新)插入对应课程 actions 数组。单进程一次读改写，按 name 去重。"""
import re

PATH = 'utils/data.js'
s = open(PATH, encoding='utf-8').read()

# (course_id, name, icon, type, value)
INS = [
    # 孤儿(已接 gif/ACT_LIB/ACTION_CUE，仅缺课程)
    ('upupper', '哑铃划船', '🏋️', 'reps', 12),
    ('upupper', '高位下拉', '🔽', 'reps', 12),
    ('upupper', '哑铃侧平举', '💪', 'reps', 15),
    ('chest',   '哑铃飞鸟', '🕊️', 'reps', 12),
    ('arms',    '双杠臂屈伸', '💪', 'reps', 10),
    ('glute',   '站姿提踵', '🦶', 'reps', 20),
    ('abs',     '平板支撑', '🧘', 'time', 45),
    ('hiit',    '跳蹲', '🦘', 'reps', 15),
    # 新动作(10)
    ('upupper', '坐姿绳索划船', '🪢', 'reps', 15),
    ('arms',    '绳索三头下压', '🔥', 'reps', 15),
    ('glute',   '腿弯举', '🦵', 'reps', 15),
    ('glute',   '杠铃臀桥', '🍑', 'reps', 12),
    ('abs',     '侧平板', '🧘', 'time', 30),
    ('hiit',    '杰克波比', '🔥', 'reps', 10),
    ('cardio',  '滑雪步', '⛷️', 'reps', 20),
    ('yoga',    '靠墙小腿拉伸', '🧱', 'time', 30),
    ('yoga',    '胸肌拉伸', '💪', 'time', 30),
    ('yoga',    '下背拉伸', '🧘', 'time', 30),
]

# 预先确认：全局是否已存在这些 name(避免重复插入)
existing = set(re.findall(r"name:\s*'([^']+)'", s))

for cid, name, icon, typ, val in INS:
    if name in existing:
        print('SKIP (already in some course):', name)
        continue
    # 定位该课程块：id: 'CID' 之后第一个 actions: [
    start = s.index("id: '%s'" % cid)
    a_idx = s.index('actions: [', start)
    # 找该 actions 数组的闭合 ] (4空格缩进 + ])
    end = s.index('\n    ]', a_idx)
    line = "      { name: '%s', icon: '%s', type: '%s', value: %s },\n" % (name, icon, typ, val)
    s = s[:end] + line + s[end:]
    print('INSERT ->', cid, name)
    existing.add(name)

open(PATH, 'w', encoding='utf-8').write(s)
print('\n完成。已插入课程动作。')
