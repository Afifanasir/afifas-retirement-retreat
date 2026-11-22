"""Chroma-key a PNG (or a folder of frames) -> trimmed RGBA PNG.
usage: key.py in.png out.png [green|magenta] [notrim]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def key(rgb, screen='green'):
    c = rgb.astype(np.float32)
    R, G, B = c[..., 0], c[..., 1], c[..., 2]
    if screen == 'green':
        d = G - np.maximum(R, B)          # how much greener than the other channels
        bright = G
    else:  # magenta: R and B high, G low
        d = np.minimum(R, B) - G
        bright = np.minimum(R, B)
    k = np.clip((d - 70) / 80, 0, 1) * np.clip((bright - 120) / 60, 0, 1)  # 1 = pure screen
    k[ndimage.binary_opening(k > 0.98, iterations=1) == 0] *= 0.999       # drop single-pixel holes
    a = 1 - k
    edge = ndimage.binary_dilation(k > 0.02, iterations=3) & (a > 0)
    # despill only near the screen so natural greens/pinks inside the art stay untouched
    if screen == 'green':
        lim = np.maximum(R, B) + 12
        G2 = np.where(edge, np.minimum(G, lim), G)
        c = np.dstack([R, G2, B])
    else:
        lim = G + 12
        c = np.dstack([np.where(edge, np.minimum(R, lim + (R - B).clip(0)), R), G, np.where(edge, np.minimum(B, lim), B)])
    a[a < 0.03] = 0
    out = np.dstack([c.clip(0, 255), a * 255]).astype(np.uint8)
    out[a == 0] = 0
    # keep only components of meaningful size (kills keyed noise specks)
    lab, n = ndimage.label(a > 0.2)
    if n > 1:
        sz = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
        tiny = np.isin(lab, 1 + np.nonzero(sz < max(60, sz.max() * 0.0005))[0])
        out[tiny] = 0
    return out


if __name__ == '__main__':
    src, dst = sys.argv[1:3]
    screen = sys.argv[3] if len(sys.argv) > 3 else 'green'
    out = key(np.asarray(Image.open(src).convert('RGB')), screen)
    if 'notrim' not in sys.argv:
        ys, xs = np.nonzero(out[..., 3])
        out = out[max(0, ys.min() - 2):ys.max() + 3, max(0, xs.min() - 2):xs.max() + 3]
    Image.fromarray(out).save(dst, optimize=True)
    print(dst.split('/')[-1], out.shape[1], out.shape[0])
