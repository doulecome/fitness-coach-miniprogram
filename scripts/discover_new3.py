#!/usr/bin/env python3
# 第三批发现 v2：关键词模糊扫描数据集，列出"有 GIF + 中文分步 + 未入库"的真实条目。
import json, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = json.load(open(os.path.join(ROOT, 'scripts/dset/exercises.json'), encoding='utf-8'))
gif_map = open(os.path.join(ROOT, 'utils/gif_map.js'), encoding='utf-8').read()
used_ids = set(re.findall(r'media/([A-Za-z0-9]+)\.gif', gif_map))

by_name = {}
for e in DATA:
    nm = str(e.get('name', '')).strip().lower()
    if nm:
        by_name.setdefault(nm, e)

def ok(e):
    if not e: return False
    if not (e.get('gif_url') and e.get('media_id')): return False
    if e['media_id'] in used_ids: return False
    steps = (e.get('instruction_steps') or {}).get('zh') or []
    return len(steps) >= 4

# 中文名(目标类别) -> 关键词列表(任一命中即候选)
CONCEPTS = {
    '俯卧撑变式': ['push up', 'push-up'],
    '箭步蹲': ['lunge'],
    '划船': ['row'],
    '转体': ['twist', 'russian'],
    '登山者': ['mountain climber'],
    '平板': ['plank'],
    '死虫': ['dead bug', 'deadbug'],
    '鸟狗': ['bird dog'],
    '仰卧起坐': ['sit up', 'situp'],
    '开合跳': ['jumping jack', 'jump jack'],
    '波比': ['burpee'],
    '早安式': ['good morning'],
    '超人': ['superman'],
    '臀桥': ['glute bridge', 'hip bridge'],
    '拉伸-腘绳肌': ['hamstring'],
    '拉伸-股四头': ['quadriceps', 'quad stretch', 'standing quad'],
    '拉伸-肩': ['shoulder stretch'],
    '拉伸-髋屈肌': ['hip flexor'],
    '拉伸-腕': ['wrist stretch'],
    '台阶': ['step up', 'step-up'],
    '腿举': ['leg press'],
    '臀推': ['hip thrust'],
    '卷腹': ['crunch'],
    '抬腿': ['leg raise', 'leg lift'],
    '深蹲变式': ['squat'],
    '硬拉': ['deadlift'],
    '提踵': ['calf raise', 'calf raises'],
}

seen_ids = set()
for zh, kws in CONCEPTS.items():
    print('\n### %s' % zh)
    hits = []
    for e in DATA:
        nm = str(e.get('name', '')).lower()
        if any(k in nm for k in kws) and ok(e) and e['media_id'] not in seen_ids:
            hits.append(e)
    for e in hits[:4]:
        seen_ids.add(e['media_id'])
        print('  %-34s id=%-9s steps=%d gif=%s' % (e['name'], e['media_id'], len((e.get('instruction_steps') or {}).get('zh') or []), e['gif_url']))
    if not hits:
        print('  (无可用)')
