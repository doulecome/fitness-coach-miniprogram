# -*- coding: utf-8 -*-
"""第五批 GIF 下载: 18 个新动作。直连 jsdelivr 优先, 代理兜底。"""
import json, os, urllib.request

DS_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/'
PROXIES = ['http://127.0.0.1:8898', 'http://127.0.0.1:7897']
OUT = 'docs/media'

# (中文名, media_id, gif_url相对路径)
SEL = [
    ('坐姿脊柱扭转','S1JXDAG','videos/1011-S1JXDAG.gif'),
    ('青蛙式','2Dk4xQV','videos/2571-2Dk4xQV.gif'),
    ('站姿小腿拉伸','bJYHBIN','videos/1373-bJYHBIN.gif'),
    ('肱三头肌拉伸','Z5YStHW','videos/0643-Z5YStHW.gif'),
    ('杠铃耸肩','dG7tG5y','videos/0095-dG7tG5y.gif'),
    ('T杠划船','BgljGjd','videos/1349-BgljGjd.gif'),
    ('杠铃上拉','i6LWjok','videos/0073-i6LWjok.gif'),
    ('杠铃肩上推举','CggQhII','videos/0587-CggQhII.gif'),
    ('借力推举','I4KkPdl','videos/0528-I4KkPdl.gif'),
    ('地板卧推','vtusOWT','videos/0065-vtusOWT.gif'),
    ('箱跳','iPm26QU','videos/1374-iPm26QU.gif'),
    ('悬垂屈膝举腿','03lzqwk','videos/0011-03lzqwk.gif'),
    ('绳索转体','aVs3BR3','videos/0243-aVs3BR3.gif'),
    ('壶铃风车','9Tkqa9O','videos/0554-9Tkqa9O.gif'),
    ('腿举','V07qpXy','videos/2287-V07qpXy.gif'),
    ('哈克深蹲','5VCj6iH','videos/0046-5VCj6iH.gif'),
    ('腿伸展','my33uHU','videos/0585-my33uHU.gif'),
    ('手枪蹲','nqs5HGV','videos/1759-nqs5HGV.gif'),
]

def fetch(url, timeout=40):
    try:
        return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=timeout).read()
    except Exception as e:
        pass
    for px in PROXIES:
        try:
            proxy=urllib.request.ProxyHandler({'https':px,'http':px})
            op=urllib.request.build_opener(proxy)
            return op.open(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=timeout).read()
        except Exception as e:
            pass
    raise RuntimeError('all fetch failed: '+url)

os.makedirs(OUT, exist_ok=True)
ok=0; fail=0
for zh, mid, rel in SEL:
    url=DS_BASE+rel
    try:
        data=fetch(url)
        if data[:3]==b'GIF' and len(data)>2000:
            open('%s/%s.gif'%(OUT,mid),'wb').write(data)
            print('OK  %-8s %s (%d bytes)'%(zh, mid, len(data))); ok+=1
        else:
            print('BAD %-8s %s (len=%d header=%r)'%(zh, mid, len(data), data[:3])); fail+=1
    except Exception as e:
        print('ERR %-8s %s -> %s'%(zh, mid, e)); fail+=1
print('\n下载完成: OK=%d FAIL=%d'%(ok,fail))
