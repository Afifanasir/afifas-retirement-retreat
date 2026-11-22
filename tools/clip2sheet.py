"""Higgsfield clip -> keyed transparent sprite sheet (grid) + json.
usage: clip2sheet.py frames_dir out_prefix screen(green|magenta) target_h"""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from key import key

src, out, screen, th = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
frames = [key(np.asarray(Image.open(os.path.join(src, f)).convert('RGB')), screen)
          for f in sorted(os.listdir(src)) if f.endswith('.png')]
if 'notop' in sys.argv:  # drop frames where the subject leaves the top of the camera frame
    frames = [f for f in frames if not (f[:4, :, 3] > 30).any()]
al = np.stack([f[..., 3] > 30 for f in frames]).any(0)       # union box: frames stay registered to each other
ys, xs = np.nonzero(al)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
s = th / (y1 - y0)
fw, fh = round((x1 - x0) * s), th
cols = min(len(frames), 8)
rows = (len(frames) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * fw, rows * fh))
for i, f in enumerate(frames):
    im = Image.fromarray(f[y0:y1, x0:x1]).resize((fw, fh), Image.LANCZOS)
    sheet.paste(im, ((i % cols) * fw, (i // cols) * fh))
sheet.save(out + '.webp', quality=88, method=6)
json.dump({'frames': len(frames), 'cols': cols, 'fw': fw, 'fh': fh,
           'box': [int(x0), int(y0), int(x1), int(y1)]}, open(out + '.json', 'w'))
print(os.path.basename(out), len(frames), 'frames', fw, 'x', fh, f'{os.path.getsize(out + ".webp") // 1024}KB')
