# -*- coding: utf-8 -*-
"""第四批 GIF 下载: 19 个新动作。直连 jsdelivr 优先, 代理兜底。"""
import json, os, urllib.request, urllib.error

DS_BASE = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main/'
PROXIES = ['http://127.0.0.1:8898', 'http://127.0.0.1:7897']
OUT = 'docs/media'

# (中文名, media_id, gif_url相对路径)
SEL = [
    ('弹力带深蹲划船','w1NOByi','videos/1003-w1NOByi.gif'),
    ('弹力带坐姿转体划船','DKBwJrL','videos/0990-DKBwJrL.gif'),
    ('杠铃俯身划船','eZyBC3j','videos/0027-eZyBC3j.gif'),
    ('弹力带耸肩','trmte8s','videos/1018-trmte8s.gif'),
    ('弓箭手引体','72BC5Za','videos/3293-72BC5Za.gif'),
    ('跳绳','e1e76I2','videos/2612-e1e76I2.gif'),
    ('开合跳','HtfCpfi','videos/3223-HtfCpfi.gif'),
    ('跳蹲','LIlE5Tn','videos/0514-LIlE5Tn.gif'),
    ('剪刀跳','Eh2v5Iu','videos/3219-Eh2v5Iu.gif'),
    ('分腿跳','f9lVSSI','videos/3220-f9lVSSI.gif'),
    ('高抬腿弓步','J9zIWig','videos/3655-J9zIWig.gif'),
    ('冲刺跑','Qoujh3Q','videos/0858-Qoujh3Q.gif'),
    ('过顶胸肌拉伸','QoHIhPl','videos/1259-QoHIhPl.gif'),
    ('四足深蹲拉伸','qBcKorM','videos/1512-qBcKorM.gif'),
    ('交叉卷腹','rbu5UUb','videos/0262-rbu5UUb.gif'),
    ('弹力带抗旋转推','9pa4H5m','videos/0979-9pa4H5m.gif'),
    ('垂悬举腿','weoDEpH','videos/2963-weoDEpH.gif'),
    ('杠铃硬拉','ila4NZS','videos/0032-ila4NZS.gif'),
    ('杠铃前蹲','zG0zs85','videos/0042-zG0zs85.gif'),
]

def fetch(url, timeout=40):
    last=None
    handlers=[('direct',lambda: urllib.request.urlopen(url, timeout=timeout))]
    for px in PROXIES:
        handlers.append(('proxy %s'%px, lambda p=px: urllib.request.urlopen(
            urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=timeout)))
    # 直连先试
    try:
        return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=timeout).read()
    except Exception as e:
        last=e
    for px in PROXIES:
        try:
            proxy=urllib.request.ProxyHandler({'https':px,'http':px})
            op=urllib.request.build_opener(proxy)
            return op.open(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=timeout).read()
        except Exception as e:
            last=e
    raise last

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
