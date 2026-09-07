# 把 ExerciseDB 真人 GIF 的背景统一成浅色 (#f5f6f8)，消除"动作示范底色不统一"。
# 原理：每张 GIF 背景是烧进像素的纯色（非透明），按"边框环中位数"检测背景色，
#       将距离背景 < TOL 的像素统一刷成目标浅底；主体（肤色/衣服）远离背景色，基本不动。
# 产物：docs/media/<id>.gif 与 preview/media/<id>.gif（网页版本地托管，避免改 gif_map 源文件）。
import urllib.request, io, os, re, math
from PIL import Image, ImageSequence

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_BASE = "https://cdn.jsdelivr.net/gh/sovanndevid/my-exercisedb@main/media/"
TARGET = (245, 246, 248)   # #f5f6f8 与网页 --bg 一致
TOL = 34                    # 背景色容差（欧氏距离）
SPEED = 1.8                 # 放慢播放约 1.8 倍，便于跟练看清动作
OUT_DIRS = [os.path.join(ROOT, "docs", "media"),
            os.path.join(ROOT, "preview", "media")]

def log(*a): print("[normalize]", *a)


def border_median(img):
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()
    edge = []
    for x in range(w):
        edge.append(px[x, 0]); edge.append(px[x, h - 1])
    for y in range(h):
        edge.append(px[0, y]); edge.append(px[w - 1, y])
    edge.sort()
    return edge[len(edge) // 2]


def recolor(img, bg):
    img = img.convert("RGB")
    px = img.load()
    w, h = img.size
    out = Image.new("RGB", (w, h), TARGET)
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2)
            opx[x, y] = TARGET if d < TOL else (r, g, b)
    return out


def download(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
            return urllib.request.urlopen(req, timeout=30).read()
        except Exception as e:
            last = e
    raise last


def main():
    gifmap = open(os.path.join(ROOT, "utils", "gif_map.js"), encoding="utf-8").read()
    pairs = re.findall(r'"([^"]+)":\s*"(https://[^"]+)"', gifmap)
    seen = {}
    for name, url in pairs:
        mid = url.rsplit("/", 1)[1]            # TFqbd8t.gif
        if mid in seen:
            continue
        seen[mid] = True
        log("processing", name, "->", mid)
        data = download(url)
        im = Image.open(io.BytesIO(data))
        orig = [fr.copy() for fr in ImageSequence.Iterator(im)]   # 复本：迭代器复用同一帧对象，list()会得重复引用
        bg = border_median(orig[0])
        log("  detected bg", bg)
        frames = [recolor(fr, bg) for fr in orig]
        # 逐帧时长 ×SPEED 放慢；0 时长按 60ms 兜底，下限 20ms 防过快
        durs = [max(int(round((fr.info.get("duration") or 60) * SPEED)), 20) for fr in orig]
        for d in OUT_DIRS:
            os.makedirs(d, exist_ok=True)
            out = os.path.join(d, mid)
            frames[0].save(out, save_all=True, append_images=frames[1:],
                           duration=durs, loop=0, disposal=2, optimize=True)
            log("  wrote", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main()
