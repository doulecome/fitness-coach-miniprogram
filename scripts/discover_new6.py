import json, re

d = json.load(open('scripts/dset/exercises.json', encoding='utf-8'))
gm = open('utils/gif_map.js', encoding='utf-8').read()
used = set(re.findall(r'media/([A-Za-z0-9]+)\.gif', gm))

# 已存在的动作中文名（避免重复收录同名动作）
data_js = open('utils/data.js', encoding='utf-8').read()
existing_names = set(re.findall(r"actionByName\['([^']+)'\]", data_js))
# ACT_LIB 也含动作名
existing_names |= set(re.findall(r"^\s*'([^']+)':\s*\{\s*g:", data_js, re.M))

cands = []
for e in d:
    mid = e.get('media_id')
    if not mid or mid in used:
        continue
    gif = e.get('gif_url') or ''
    if 'videos/' not in gif:
        continue
    st = (e.get('instruction_steps') or {}).get('zh') or []
    if len(st) < 5:
        continue
    name = e.get('name')
    if name in existing_names:
        continue
    cands.append({
        'name': name,
        'media_id': mid,
        'gif': gif,
        'steps': len(st),
        'equipment': e.get('equipment'),
        'primary_muscles': e.get('primary_muscles'),
        'category': e.get('category'),
    })

print('unused valid candidates:', len(cands))
# 按 equipment/肌肉 粗分，方便选类
from collections import Counter
print('\n=== equipment distribution ===')
for k, v in Counter(c.get('equipment') for c in cands).most_common():
    print(f'  {k}: {v}')

# 输出成 json 供后续挑选
json.dump(cands, open('scripts/new6_candidates.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('\nsaved scripts/new6_candidates.json')
