# 第二批评选：在已加 24 个之外，找仍缺失、且数据集里同时有 GIF + 中文分步的动作
import json

d = json.load(open('scripts/dset/exercises.json', encoding='utf-8'))
by_name = {}
for e in d:
    k = str(e.get('name', '')).lower().strip()
    if k and k not in by_name:
        by_name[k] = e

def find(zh, kws):
    for kw in kws:
        ex = by_name.get(kw.lower().strip())
        if ex: return ex
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

CAND = {
    '宽距俯卧撑': ['wide push up', 'wide grip push up'],
    '蜘蛛侠俯卧撑': ['spiderman push up', 'spider push up', 'spider-man push'],
    '派克俯卧撑': ['pike push up', 'pike press'],
    '单臂俯卧撑': ['one arm push up', 'one-arm pushup', 'single arm push'],
    '反向划船': ['inverted row', 'bodyweight row', 'supine row', 'incline row'],
    '俯身臂屈伸': ['triceps kickback', 'dumbbell kickback'],
    '斜托弯举': ['preacher curl', 'bicep preacher'],
    '单腿硬拉': ['single leg deadlift', 'one leg deadlift', 'single-leg rdl'],
    '过头深蹲': ['overhead squat'],
    '坐姿提踵': ['seated calf raise', 'seated calf'],
    '反向卷腹': ['reverse crunch'],
    '举腿卷腹': ['leg raise crunch', 'lying leg raise crunch'],
    '熊爬': ['bear crawl'],
    '横向滑步': ['lateral shuffle', 'side shuffle', 'side-to-side shuffle'],
    '坐姿前屈': ['seated forward fold', 'seated toe touch', 'seated hamstring stretch'],
    '站姿体侧拉伸': ['standing side stretch', 'side stretch'],
    '颈部拉伸': ['neck stretch'],
    '弹力带扩胸': ['band pull apart', 'resistance band pull apart', 'band face pull apart'],
    '上斜哑铃飞鸟': ['incline dumbbell fly'],
    '侧卧抬腿': ['side lying leg raise', 'side leg raise', 'lateral leg raise'],
    '单腿臀桥': ['single leg glute bridge', 'one leg glute bridge'],
    '跪姿俯卧撑': ['knee push up', 'kneeling push up', 'on knees push'],
    '卷腹变式': ['cable crunch', 'weighted crunch'],
    '平板支撑交替摸肩': ['shoulder tap plank', 'plank shoulder tap'],
    '深蹲侧抬腿': ['squat side kick', 'squat with side kick'],
}

rows, missing = [], []
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
print('\n== MISSING (%d) ==' % len(missing))
print(', '.join(missing))
