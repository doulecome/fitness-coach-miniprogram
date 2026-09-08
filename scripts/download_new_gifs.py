# 下载 24 个新动作的 ExerciseDB 真人 GIF 到 docs/media/<media_id>.gif
import json, urllib.request, os, time

d = json.load(open('scripts/dset/exercises.json', encoding='utf-8'))
by_id = {e.get('media_id'): e for e in d}

PROXY = 'http://127.0.0.1:60522'
HOSTS = [
    'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/',
    'https://gcore.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/',
    'https://fastly.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/',
    'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/',
]

# zh -> media_id (来自 discover_new.py)
TARGETS = {
    '高位下拉': 'RVwzP10', '坐姿划船': 'fUBheHs', '反向飞鸟': 'sTfvVsG',
    '前平举': 'TFA88iB', '俯身侧平举': 'v1qBec9', '阿诺德推举': 'Xy4jlWA',
    '弹力带肩推': 'peAeMR3', '上斜哑铃卧推': 'jHAnWmT', '双杠臂屈伸': 'ezTvXcr',
    '哑铃弯举': 'q6y3OhV', '集中弯举': 'kmVVAfu', '哑铃颈后臂屈伸': '5uFK1xr',
    '仰卧臂屈伸': 'iZop9xO', '弹力带下压': 'gAwDzB3', '罗马尼亚硬拉': 'wQ2c4XD',
    '臀推': 'Pjbc0Kt', '髋外展': '7WaDzyL', '相扑深蹲': 'dzz6BiV',
    '俯卧腿弯举': '17lJ1kr', '平板支撑': 'hCjGsRQ', '自行车卷腹': 'tZkGYZ9',
    'V字起身': 'H6ETwO9', '侧卷腹': 'q2ADGqV', '拳击空击': 'hoXt6wv',
}

ok, fail = [], []
for zh, mid in TARGETS.items():
    e = by_id.get(mid)
    gif_url = e.get('gif_url') if e else None
    if not gif_url:
        fail.append((zh, mid, 'no-gif_url')); continue
    done = False
    for h in HOSTS:
        url = h + gif_url
        for _ in range(4):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                req.set_proxy(PROXY, 'http'); req.set_proxy(PROXY, 'https')
                data = urllib.request.urlopen(req, timeout=30).read()
                if data[:3] == b'GIF' and len(data) > 2000:
                    open('docs/media/%s.gif' % mid, 'wb').write(data)
                    ok.append((zh, mid, len(data))); done = True; break
            except Exception as ex:
                time.sleep(1.2)
        if done: break
    if not done:
        fail.append((zh, mid, gif_url))

print('=== downloaded %d/24 ===' % len(ok))
for x in ok: print('  OK', x)
print('=== failed %d ===' % len(fail))
for x in fail: print('  FAIL', x)
