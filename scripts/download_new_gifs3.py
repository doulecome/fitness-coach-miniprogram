#!/usr/bin/env python3
# 第三批 GIF 下载：17 个候选 -> docs/media/<media_id>.gif
import os, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, 'docs/media')
os.makedirs(MEDIA, exist_ok=True)

# (media_id, gif_url 后缀 videos/NNN-XXX.gif)
ENTRIES = [
    ('A9qxk2F', 'videos/3294-A9qxk2F.gif'),   # 弓箭手俯卧撑
    ('wigSg76', 'videos/1273-wigSg76.gif'),   # 击掌俯卧撑
    ('t8iSghb', 'videos/0054-t8iSghb.gif'),   # 箭步蹲
    ('py1HSzx', 'videos/1410-py1HSzx.gif'),   # 侧弓步
    ('VaP75jl', 'videos/0078-VaP75jl.gif'),   # 反向箭步蹲
    ('XlZ4lAC', 'videos/0044-XlZ4lAC.gif'),   # 早安式
    ('aXtJhlg', 'videos/0431-aXtJhlg.gif'),   # 哑铃台阶训练
    ('r7cT9YD', 'videos/0014-r7cT9YD.gif'),   # 俄罗斯转体
    ('9c6T1YX', 'videos/2466-9c6T1YX.gif'),   # 登山者
    ('AR0ig3o', 'videos/0456-AR0ig3o.gif'),   # 仰卧起坐
    ('KhHJ338', 'videos/0664-KhHJ338.gif'),   # 俯卧撑转侧平板
    ('0JtKWum', 'videos/1201-0JtKWum.gif'),   # 波比跳
    ('99rWm7w', 'videos/1511-99rWm7w.gif'),   # 腘绳肌拉伸
    ('tFGKm99', 'videos/1564-tFGKm99.gif'),   # 股四头肌拉伸
    ('2LQkNPW', 'videos/1559-2LQkNPW.gif'),   # 髋屈肌拉伸
    ('km0sQC0', 'videos/0988-km0sQC0.gif'),   # 弹力带单臂划船
    ('9JprnPh', 'videos/0999-9JprnPh.gif'),   # 单腿提踵
]

BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/'
PROXIES = [None, 'http://127.0.0.1:8898', 'http://127.0.0.1:7897']

def fetch(url, proxy):
    handlers = []
    if proxy:
        from urllib.request import ProxyHandler
        handlers.append(ProxyHandler({'https': proxy, 'http': proxy}))
    import urllib.request as ur
    op = ur.build_opener(*handlers) if handlers else ur.build_opener()
    req = ur.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return op.open(req, timeout=40).read()

ok = 0
for mid, suf in ENTRIES:
    url = BASE + suf
    dst = os.path.join(MEDIA, mid + '.gif')
    data = None
    for p in PROXIES:
        try:
            data = fetch(url, p)
            if data and data[:3] == b'GIF' and len(data) > 2000:
                break
            data = None
        except Exception as e:
            continue
    if data:
        open(dst, 'wb').write(data)
        print('OK   %s  %d bytes' % (mid, len(data)))
        ok += 1
    else:
        print('FAIL %s  %s' % (mid, url))
print('\n下载完成: %d/%d' % (ok, len(ENTRIES)))
sys.exit(0 if ok == len(ENTRIES) else 1)
