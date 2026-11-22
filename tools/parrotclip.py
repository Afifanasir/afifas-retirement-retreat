"""Key magenta; remove the clip's static branch using its empty-branch frame as a plate. usage: parrotclip.py frames out th plate_index"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from key import key
src, out, th, pi = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
files = sorted(f for f in os.listdir(src) if f.endswith('.png'))
raw = [np.asarray(Image.open(os.path.join(src, f)).convert('RGB')).astype(int) for f in files]
plate = raw[pi]
branch = ndimage.binary_dilation(key(plate.astype(np.uint8), 'magenta')[..., 3] > 10, iterations=3)
fr = []
for r in raw:
    a = key(r.astype(np.uint8), 'magenta')
    diff = np.abs(r - plate).max(-1)
    bird = diff > 60
    bird = ndimage.binary_opening(bird, iterations=1)
    a[branch & ~bird] = 0
    lab, n = ndimage.label(a[..., 3] > 40)
    if n:
        sz = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
        a[~np.isin(lab, 1 + np.nonzero(sz >= sz.max() * 0.2)[0])] = 0
    fr.append(a)
al = np.stack([f[..., 3] > 40 for f in fr]).any(0)
ys, xs = np.nonzero(al); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
# perch line = top of the branch in the plate, in sheet coords (for registering feet to the tree branch)
by, bx = np.nonzero(branch[y0:y1, x0:x1]); perch = float(np.percentile(by, 5)) / (y1 - y0)
s = th / (y1 - y0); fw, fh = round((x1 - x0) * s), th
cols = 8; rows = (len(fr) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * fw, rows * fh))
for i, f in enumerate(fr):
    sheet.paste(Image.fromarray(f[y0:y1, x0:x1]).resize((fw, fh), Image.LANCZOS), ((i % cols) * fw, (i // cols) * fh))
sheet.save(out + '.webp', quality=88, method=6)
json.dump({'frames': len(fr), 'cols': cols, 'fw': fw, 'fh': fh, 'perch': round(perch, 4)}, open(out + '.json', 'w'))
print(os.path.basename(out), len(fr), fw, fh, 'perch', round(perch, 3))
