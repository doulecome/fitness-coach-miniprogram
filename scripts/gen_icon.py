# -*- coding: utf-8 -*-
# 生成 PWA 图标：绿底圆角 + 白色哑铃剪影，零依赖手写 PNG（zlib+struct）
import zlib, struct, os

def make_png(size, path):
    r = size * 0.19          # 圆角半径
    bar_w = size * 0.16      # 哑铃竖条宽
    bar_h = size * 0.50      # 竖条高
    rod_h = size * 0.10      # 横杆高
    cx = cy = size / 2
    G, W = (31, 214, 168), (255, 255, 255)
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0
        for x in range(size):
            # 圆角矩形 alpha
            ax = min(x, size - 1 - x); ay = min(y, size - 1 - y)
            if ax < r and ay < r:
                dx, dy = r - ax, r - ay
                inside = dx * dx + dy * dy <= r * r
            else:
                inside = True
            if not inside:
                row += bytes([0, 0, 0, 0]); continue
            # 哑铃形状判定
            in_rod = abs(y - cy) <= rod_h / 2 and abs(x - cx) <= size * 0.30
            in_bar = abs(y - cy) <= bar_h / 2 and (abs(x - (cx - size * 0.22)) <= bar_w / 2 or abs(x - (cx + size * 0.22)) <= bar_w / 2)
            c = W if (in_rod or in_bar) else G
            row += bytes([c[0], c[1], c[2], 255])
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print('written', path, os.path.getsize(path), 'bytes')

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'docs')
make_png(192, os.path.join(out, 'icon-192.png'))
make_png(512, os.path.join(out, 'icon-512.png'))
