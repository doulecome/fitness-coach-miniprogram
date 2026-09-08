# -*- coding: utf-8 -*-
"""第六批(新动作部分): 下载 10 个新动作的 GIF。直连 jsdelivr 优先, 代理兜底。"""
import json, os, urllib.request

DS_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/'
PROXIES = ['http://127.0.0.1:8898', 'http://127.0.0.1:7897']
OUT = 'docs/media'

SEL = [
    ('坐姿绳索划船','hvV79Si','videos/0180-hvV79Si.gif'),
    ('绳索三头下压','qRZ5S1N','videos/1723-qRZ5S1N.gif'),
    ('腿弯举','nnmCTLN','videos/0582-nnmCTLN.gif'),
    ('杠铃臀桥','qKBpF7I','videos/1409-qKBpF7I.gif'),
    ('侧平板','VO2qeJg','videos/1775-VO2qeJg.gif'),
    ('滑雪步','5MRH8H2','videos/3671-5MRH8H2.gif'),
    ('杰克波比','mr7pkqP','videos/0501-mr7pkqP.gif'),
    ('靠墙小腿拉伸','m0tCHqc','videos/1377-m0tCHqc.gif'),
    ('胸肌拉伸','ykA5tU7','videos/1272-ykA5tU7.gif'),
    ('下背拉伸','QFmz6ch','videos/0690-QFmz6ch.gif'),
]

def fetch(url, timeout=40):
    try:
        return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=timeout).read()
    except Exception:
        pass
    for px in PROXIES:
        try:
            op = urllib.request.build_opener(urllib.request.ProxyHandler({'https':px,'http':px}))
            return op.open(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=timeout).read()
        except Exception:
            pass
    raise RuntimeError('all fetch failed: '+url)

os.makedirs(OUT, exist_ok=True)
ok=0; fail=0
for zh, mid, rel in SEL:
    url = DS_BASE+rel
    try:
        data = fetch(url)
        if data[:3]==b'GIF' and len(data)>2000:
            open('%s/%s.gif'%(OUT,mid),'wb').write(data)
            print('OK  %-8s %s (%d bytes)'%(zh, mid, len(data))); ok+=1
        else:
            print('BAD %-8s %s (len=%d header=%r)'%(zh, mid, len(data), data[:3])); fail+=1
    except Exception as e:
        print('ERR %-8s %s -> %s'%(zh, mid, e)); fail+=1
print('\n下载完成: OK=%d FAIL=%d'%(ok,fail))
