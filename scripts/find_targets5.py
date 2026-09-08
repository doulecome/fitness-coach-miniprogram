# -*- coding: utf-8 -*-
"""第五批精选: 给定 (中文名, [英文关键词], 期望分组), 在数据集中找最佳匹配,
验证有 GIF + 中文分步 + media_id 未占用, 输出可直接接线的候选表。"""
import json, re, os

DS = 'scripts/dset/exercises.json'
GM = 'utils/gif_map.js'

d = json.load(open(DS, encoding='utf-8'))

# 已用 media_id
gm = open(GM, encoding='utf-8').read()
used = set(re.findall(r'media/([A-Za-z0-9]+)\.gif', gm))

# 建索引: 名小写 -> 条目 (保留所有同名候选)
byName = {}
for e in d:
    k = str(e.get('name') or '').lower().strip()
    byName.setdefault(k, []).append(e)

def pick(keywords):
    # 精确优先, 再模糊; 返回第一个有 GIF + zh>=5 且 media_id 未用的
    for kw in keywords:
        kl = kw.lower().strip()
        # 精确
        if kl in byName:
            for e in byName[kl]:
                if ok(e): return e
        # 模糊 (最短)
        cands = []
        for e in d:
            n = str(e.get('name') or '').lower()
            if kl in n: cands.append(e)
        cands.sort(key=lambda x: len(str(x.get('name') or '')))
        for e in cands:
            if ok(e): return e
    return None

def ok(e):
    mid = e.get('media_id')
    if not mid or mid in used: return False
    if 'videos/' not in (e.get('gif_url') or ''): return False
    st = (e.get('instruction_steps') or {}).get('zh') or []
    if len(st) < 5: return False
    return True

# (中文名, 期望分组, [英文关键词])
TARGETS = [
    # stretch 拉伸 (薄, 补瑜伽/静态拉伸)
    ('婴儿式', 'stretch', ['child pose', 'childs pose']),
    ('猫牛式', 'stretch', ['cat cow', 'cat-cow']),
    ('眼镜蛇式', 'stretch', ['cobra stretch', 'cobra pose']),
    ('下犬式', 'stretch', ['downward dog', 'downward-facing dog']),
    ('鸽子式', 'stretch', ['pigeon stretch', 'pigeon pose']),
    ('站姿小腿拉伸', 'stretch', ['standing calf stretch', 'standing soleus stretch']),
    ('站姿股四头肌拉伸', 'stretch', ['standing quadriceps stretch', 'standing quad stretch']),
    ('坐姿脊柱扭转', 'stretch', ['seated spinal twist', 'seated twist']),
    ('青蛙式', 'stretch', ['frog stretch', 'frog pose']),
    # cardio 有氧 (薄, 补 plyo)
    ('箱跳', 'cardio', ['box jump']),
    ('踢臀跳', 'cardio', ['butt kick', 'butt kicker']),
    ('原地慢跑', 'cardio', ['jog in place', 'running in place']),
    ('侧滑步', 'cardio', ['lateral shuffle']),
    ('收腹跳', 'cardio', ['tuck jump']),
    ('横向跳跃', 'cardio', ['lateral jump']),
    # pull 拉
    ('杠铃耸肩', 'pull', ['barbell shrug']),
    ('杠铃颈后臂屈伸', 'push', ['barbell pullover', 'dumbbell pullover']),
    ('T杠划船', 'pull', ['t-bar row', 't bar row']),
    ('器械划船', 'pull', ['machine row', 'seated machine row']),
    # push 推
    ('杠铃肩上推举', 'push', ['barbell overhead press', 'barbell shoulder press', 'military press']),
    ('借力推举', 'push', ['push press']),
    ('绳索夹胸', 'push', ['cable fly', 'cable chest fly']),
    ('哑铃地板卧推', 'push', ['dumbbell floor press', 'floor press']),
    # core 核心
    ('悬垂屈膝举腿', 'core', ['hanging knee raise', 'hanging knee tuck']),
    ('健腹轮', 'core', ['ab wheel rollout', 'ab wheel', 'abs wheel']),
    ('鸟狗式', 'core', ['bird dog']),
    ('绳索卷腹', 'core', ['cable crunch']),
    ('伐木式', 'core', ['wood chop', 'cable wood chop']),
    # legs 腿
    ('腿举', 'legs', ['leg press']),
    ('哈克深蹲', 'legs', ['hack squat']),
    ('腿伸展', 'legs', ['leg extension']),
    ('墙式静蹲', 'legs', ['wall sit', 'wall squat']),
    ('手枪蹲', 'legs', ['pistol squat']),
]

hits = []
misses = []
for zh, g, kws in TARGETS:
    e = pick(kws)
    if e:
        mid = e['media_id']
        rel = e['gif_url'].split('videos/')[-1]
        hits.append((zh, g, e['name'], mid, rel, len((e.get('instruction_steps') or {}).get('zh') or [])))
    else:
        misses.append((zh, g, kws))

print('\n=== 命中 %d 个 (可直接接线) ===' % len(hits))
for zh, g, en, mid, rel, st in hits:
    print('  %-8s [%-7s] %-38s %s  %s steps=%d' % (zh, g, en, mid, rel, st))
print('\n=== 未命中 %d 个 ===' % len(misses))
for zh, g, kws in misses:
    print('  %-8s [%-7s] %s' % (zh, g, kws))

json.dump([{'zh':zh,'g':g,'en':en,'mid':mid,'rel':rel,'steps':st} for zh,g,en,mid,rel,st in hits],
          open('scripts/new5_targets.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
print('\n已写入 scripts/new5_targets.json')
