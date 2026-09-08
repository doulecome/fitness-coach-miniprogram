# 第二批 14 个新动作 GIF 下载（直连优先，代理 60522 兜底）
import json, urllib.request, os, time, socket

d = json.load(open('scripts/dset/exercises.json', encoding='utf-8'))
by_id = {e.get('media_id'): e for e in d}

PROXY = 'http://127.0.0.1:60522'
HOSTS = [
    'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/',
    'https://fastly.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/',
    'https://gcore.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/',
    'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/',
]
TARGETS = {
    '派克俯卧撑': 'sVvXT5J', '单臂俯卧撑': 'MUic5zN', '反向划船': 'bZGHsAZ',
    '俯身臂屈伸': 'W6PxUkg', '斜托弯举': 'P2lNrGL', '单腿硬拉': 'gEyURal',
    '过头深蹲': 'gfk9kD4', '坐姿提踵': 'Ie9UGty', '反向卷腹': 'nCU1Ekp',
    '负重卷腹': 's8nrDXF', '熊爬': '0Yz8WdV', '坐姿前屈': 'yRYyfdA',
    '颈部拉伸': 'oQRJYkC', '举腿卷腹': 'PQ2AtC3',
}

def fetch(url):
    last = None
    for h in HOSTS:
        for attempt in range(3):
            try:
                req = urllib.request.Request(h + url, headers={'User-Agent': 'Mozilla/5.0'})
                try:
                    req.set_proxy(PROXY, 'http'); req.set_proxy(PROXY, 'https')
                except Exception:
                    pass
                data = urllib.request.urlopen(req, timeout=40).read()
                if data[:3] == b'GIF' and len(data) > 2000:
                    return data
                last = 'bad-content(%d)' % len(data)
            except Exception as ex:
                last = repr(ex)
                time.sleep(1.0)
    return None

ok, fail = [], []
for zh, mid in TARGETS.items():
    e = by_id.get(mid); gif_url = e.get('gif_url') if e else None
    if not gif_url:
        fail.append((zh, mid, 'no-gif_url')); continue
    data = fetch(gif_url)
    if data:
        open('docs/media/%s.gif' % mid, 'wb').write(data)
        ok.append((zh, mid, len(data)))
    else:
        fail.append((zh, mid, gif_url))
print('=== downloaded %d/14 ===' % len(ok))
for x in ok: print('  OK', x)
print('=== failed %d ===' % len(fail))
for x in fail: print('  FAIL', x)
