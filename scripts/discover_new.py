# 候选新动作发现：确认每个动作在 exercises-dataset 里是否有 media_id + gif_url + 中文分步
import json, sys

d = json.load(open('scripts/dset/exercises.json', encoding='utf-8'))
by_name = {}
for e in d:
    k = str(e.get('name', '')).lower().strip()
    if k and k not in by_name:
        by_name[k] = e

def find(zh, kws):
    # 精确
    for kw in kws:
        ex = by_name.get(kw.lower().strip())
        if ex: return ex
    # 模糊：含任一关键词，挑最短且有中文内容的
    cands = []
    for e in d:
        n = str(e.get('name', '')).lower()
        for kw in kws:
            if kw and kw in n:
                cands.append(e); break
    cands.sort(key=lambda x: len(str(x.get('name', ''))))
    for e in cands:
        steps = (e.get('instruction_steps') or {}).get('zh') or []
        desc = (e.get('instructions') or {}).get('zh') or ''
        if steps or desc:
            return e
    return None

# zh名 -> 英文关键词（同 build_zh.js 风格）
CAND = {
    '高位下拉': ['lat pulldown', 'pulldown', 'pull down', 'pull-down'],
    '坐姿划船': ['seated row', 'cable row', 'seated cable row'],
    '单臂哑铃划船': ['one arm dumbbell row', 'single arm row', 'one-arm row'],
    '反向飞鸟': ['reverse fly', 'rear delt fly', 'rear deltoid'],
    '前平举': ['front raise', 'front dumbbell raise'],
    '俯身侧平举': ['bent over lateral raise', 'bent-over lateral raise', 'rear lateral raise'],
    '阿诺德推举': ['arnold press', 'arnold dumbbell press'],
    '弹力带肩推': ['resistance band shoulder press', 'band shoulder press', 'band overhead press'],
    '上斜哑铃卧推': ['incline dumbbell press', 'incline chest press'],
    '双杠臂屈伸': ['dips', 'chest dips', 'bodyweight dips'],
    '哑铃弯举': ['dumbbell curl', 'bicep curl'],
    '集中弯举': ['concentration curl'],
    '哑铃颈后臂屈伸': ['overhead triceps extension', 'dumbbell overhead triceps'],
    '仰卧臂屈伸': ['lying triceps extension', 'skull crusher', 'supine triceps'],
    '弹力带下压': ['resistance band triceps pushdown', 'band triceps pushdown', 'triceps pushdown'],
    '罗马尼亚硬拉': ['romanian deadlift', 'r dl'],
    '臀推': ['hip thrust'],
    '侧卧抬腿': ['side lying leg raise', 'side leg raise', 'lateral leg raise'],
    '髋外展': ['hip abduction', 'side lying hip abduction', 'seated hip abduction'],
    '相扑深蹲': ['sumo squat', 'sumo deadlift'],
    '俯卧腿弯举': ['lying leg curl', 'prone leg curl', 'leg curl'],
    '平板支撑': ['plank', 'forearm plank'],
    '自行车卷腹': ['bicycle crunch', 'bicycle abdominal'],
    'V字起身': ['v-up', 'v sit up', 'v sit-up'],
    '侧卷腹': ['side crunch', 'oblique crunch'],
    '猫牛式': ['cat cow', 'cat-cow'],
    '下犬式': ['downward dog', 'downward-facing dog'],
    '婴儿式': ["child's pose", 'child pose'],
    '鸽子式': ['pigeon pose', 'pigeon stretch'],
    '后踢腿': ['butt kickers', 'butt kick', 'heel kick'],
    '原地慢跑': ['jog in place', 'march in place', 'jogging in place'],
    '拳击空击': ['shadow boxing', 'boxing'],
    '单腿臀桥': ['single leg glute bridge', 'one leg glute bridge'],
}

rows = []
missing = []
for zh, kws in CAND.items():
    e = find(zh, kws)
    if not e:
        missing.append(zh); continue
    steps = (e.get('instruction_steps') or {}).get('zh') or []
    desc = (e.get('instructions') or {}).get('zh') or ''
    rows.append((zh, e.get('name'), e.get('media_id'), e.get('gif_url'), len(steps), bool(desc)))

print('== AVAILABLE (%d) ==' % len(rows))
for r in rows:
    print('%s | %s | id=%s | gif=%s | steps=%d desc=%s' % r)
print()
print('== MISSING (%d) ==' % len(missing))
print(', '.join(missing))
