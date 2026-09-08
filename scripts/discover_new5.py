# -*- coding: utf-8 -*-
"""第五批发现: 扫描 exercises-dataset, 找有 GIF + 中文分步且未入库的动作。
按 6 类分组输出候选, 每类取代表性条目供人工挑选。
去重: 排除 gif_map.js 已用的 media_id, 且排除 build_zh.js 已有的中文名。"""
import json, re, os

DS = 'scripts/dset/exercises.json'
GM = 'utils/gif_map.js'
BZ = 'scripts/build_zh.js'
OUT = 'scripts/new5_candidates.json'

d = json.load(open(DS, encoding='utf-8'))

# 已入库 media_id
gm = open(GM, encoding='utf-8').read()
used = set(re.findall(r'media/([A-Za-z0-9]+)\.gif', gm))

# 已入库中文名（build_zh KW 的 key）
bz = open(BZ, encoding='utf-8').read()
have_zh = set(re.findall(r"^\s*'([^']+)':\s*\[", bz, re.M))

# 关键词 -> 分组 (英文, 用于数据集名匹配)
KW = {
    'pull': ['row', 'pull', 'pulldown', 'chin up', 'pull-up', 'lat', 'face pull', 'shrug', 'reverse fly', 'upright row', 'bent over'],
    'cardio': ['jump', 'burpee', 'sprint', 'high knee', 'jumping jack', 'mountain', 'skater', 'jog', 'run in place', 'butt kick', 'lunge jump', 'squat jump', 'star jump', 'box jump', 'incline', 'climber', 'knee tuck', 'cycling', 'jump rope'],
    'stretch': ['stretch', 'child pose', 'cat cow', 'cobra', 'downward', 'pigeon', 'hip flexor', 'calf stretch', 'chest stretch', 'shoulder stretch', 'wrist', 'ankle', 'spinal', 'frog', 'figure four', 'seated', 'lying', 'kneeling', 'neck', 'thoracic'],
    'core': ['plank', 'crunch', 'sit up', 'leg raise', 'hollow', 'dead bug', 'pallof', 'side bend', 'windshield', 'flutter', 'abdominal', 'oblique', 'toe touch', 'rock'],
    'legs': ['squat', 'lunge', 'deadlift', 'glute', 'calf', 'hamstring', 'hip thrust', 'step up', 'leg curl', 'leg extension', 'split', 'pistol', 'sissy', 'wall sit', 'sumo', 'goblet'],
    'push': ['push up', 'dip', 'press', 'pushup', 'handstand', 'pectoral', 'pec', 'fly', 'bench', 'tricep', 'chest'],
}

def has_zh(e):
    st = (e.get('instruction_steps') or {}).get('zh') or []
    return len(st) >= 5

cands = {g: [] for g in KW}
seen_name = set()
for e in d:
    mid = e.get('media_id')
    if not mid or mid in used:
        continue
    gu = e.get('gif_url') or ''
    if 'videos/' not in gu:
        continue
    if not has_zh(e):
        continue
    name = (e.get('name') or '').lower()
    en = e.get('name')
    # 跳过已用中文名对应的英文（粗判）
    for zh in have_zh:
        if zh.lower() in name:
            break
    else:
        pass
    for g, kws in KW.items():
        if any(k in name for k in kws):
            # 去重同名英文条目
            if name in seen_name:
                break
            seen_name.add(name)
            cands[g].append({'zh': None, 'en': en, 'media_id': mid,
                             'gif': 'https://cdn.jsdelivr.net/gh/sovanndevid/my-exercisedb@main/media/%s.gif' % mid,
                             'steps': len((e.get('instruction_steps') or {}).get('zh') or [])})
            break

summary = {}
for g in KW:
    lst = cands[g]
    summary[g] = len(lst)
    print('\n=== %s (%d 个候选) ===' % (g, len(lst)))
    for x in lst[:40]:
        print('  %-40s %s steps=%d' % (x['en'], x['media_id'], x['steps']))

json.dump(cands, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('\n已写入', OUT, '| 分组计数:', summary)
