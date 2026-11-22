"""raw Freesound CC0 files -> trimmed, loudness-matched one-shots and seamless loops in public/sfx + sfx.json"""
import json, os, subprocess, sys
import numpy as np
RAW, OUT = sys.argv[1], sys.argv[2]
SR = 44100

def decode(f, ch=1):
    b = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(RAW, f), '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(b, np.float32).reshape(-1, ch).copy()

def encode(x, name, kbps):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(x.shape[1]), '-i', '-',
                        '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', os.path.join(OUT, name)], input=x.astype(np.float32).tobytes(), check=True)

def fade(x, fin=.008, fout=.08):
    n1, n2 = int(fin * SR), min(int(fout * SR), len(x) // 2)
    x = x.copy(); x[:n1] *= np.linspace(0, 1, n1)[:, None]; x[len(x) - n2:] *= np.linspace(1, 0, n2)[:, None]; return x

def trim_silence(x, db=-42):
    # start right at the sound (30ms before the envelope reaches 30% of its peak) so hover feedback feels instant
    e = np.convolve(np.abs(x).max(1), np.ones(441) / 441, 'same')
    start = max(0, int(np.argmax(e > e.max() * 0.3)) - int(.03 * SR))
    th = e.max() * 10 ** (db / 20); idx = np.nonzero(e > th)[0]
    return x[start: idx[-1] + int(.04 * SR)] if len(idx) else x

def level(x, rms_db, peak_db=-1.5):
    # loudest 100ms window sets the level (perceived loudness of a short event), capped by peak
    w = int(.1 * SR); e = np.sqrt(np.convolve((x ** 2).mean(1), np.ones(w) / w, 'valid').max() + 1e-12)
    g = 10 ** (rms_db / 20) / e
    g = min(g, 10 ** (peak_db / 20) / (np.abs(x).max() + 1e-9))
    return x * g

def events(x, n, pre=.12, post=.55, gap=.8):
    # n loudest separate events (envelope peaks), each cut [peak-pre, peak+post]
    w = int(.02 * SR); env = np.sqrt(np.convolve((x ** 2).mean(1), np.ones(w) / w, 'same')); out = []
    env = env.copy()
    for _ in range(n):
        i = int(env.argmax()); out.append(x[max(0, i - int(pre * SR)): i + int(post * SR)])
        env[max(0, i - int(gap * SR)): i + int(gap * SR)] = 0
    return out

def lowpass(x, hz):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', str(x.shape[1]), '-i', '-', '-af', f'lowpass=f={hz}',
                        '-f', 'f32le', '-'], input=x.astype(np.float32).tobytes(), capture_output=True, check=True).stdout
    return np.frombuffer(p, np.float32).reshape(-1, x.shape[1])

seg = lambda x, a, b: x[int(a * SR): int(b * SR)]
bank = {}
def shot(cat, x, rms=-20, lp=None):
    x = trim_silence(x)
    if lp: x = lowpass(x, lp)
    x = fade(level(x, rms))
    name = f'{cat}-{len(bank.setdefault(cat, [])) + 1}.mp3'; encode(x, name, 96); bank[cat].append(name)

def loop(cat, f, lufs, xf=3.0, ch=2):
    x = decode(f, ch)
    a, b = x[int(xf * SR):], x[:int(xf * SR)]                      # end crossfades into the start -> seamless loop
    t = np.linspace(0, 1, len(b))[:, None]
    a[-len(b):] = a[-len(b):] * np.sqrt(1 - t) + b * np.sqrt(t)
    tmp = os.path.join(OUT, '_tmp.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', '-', tmp], input=a.astype(np.float32).tobytes(), check=True)
    name = f'{cat}-{len(bank.setdefault(cat, [])) + 1}.mp3'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', f'loudnorm=I={lufs}:TP=-2:LRA=11', '-ar', str(SR),
                    '-c:a', 'libmp3lame', '-b:a', '112k', os.path.join(OUT, name)], check=True)
    os.remove(tmp); bank[cat].append(name)

# ---- loops ----
loop('ambience-day', 'ambience-calm-2.mp3', -28); loop('lake', 'ambience-calm-1.mp3', -31)
loop('ambience-night', 'ambience-night-2.mp3', -29); loop('ambience-night', 'ambience-night-1.mp3', -29)
loop('breeze', 'breeze-1.mp3', -33)
for m in sorted(f for f in os.listdir(RAW) if f.startswith('piano-')): loop('music', m, -23, xf=4.0)   # soft solo piano only

# ---- one-shots ----
for i in range(1, 5): shot('flowers', decode(f'flowers-{i}.mp3'), -24)
def wave(f, a, b): x = seg(decode(f), a, b); return fade(x, .25, .6)       # waves swell in and drain away
for f, a, b in [('waves-1.mp3', 7, 11), ('waves-2.mp3', 3, 5.5), ('waves-2.mp3', 7.5, 10), ('waves-3.mp3', 2.5, 6)]:
    x = fade(level(wave(f, a, b), -24), .25, .6); name = f'waves-{len(bank.setdefault("waves", [])) + 1}.mp3'; encode(x, name, 96); bank['waves'].append(name)
t2 = decode('tap-2.mp3')
for x in [decode('tap-1.mp3'), seg(t2, .38, .52), seg(t2, .53, .70), decode('tap-3.mp3')]: shot('tap', x, -27, lp=5000)
g = decode('goat-1.mp3'); shot('goat', seg(g, .35, 1.15)); shot('goat', seg(g, 2.15, 2.95))
shot('goat', decode('goat-2.mp3')); shot('goat', decode('goat-3.mp3')); shot('goat', seg(decode('goat-4.mp3'), 1.7, 2.5)); shot('goat', decode('goat-5.mp3'))
for i in [1, 2, 3]: shot('cat', decode(f'cat-{i}.mp3'), -19)
for e in events(decode('parrot-1.mp3'), 3, pre=.08, post=.9): shot('parrot', e, -21)
for e in events(decode('parrot-2.mp3'), 2, pre=.08, post=.8): shot('parrot', e, -21)
for e in events(decode('parrot-3.mp3'), 2, pre=.3, post=1.2): shot('parrot', e, -23)
shot('chandelier', seg(decode('chandelier-1.mp3'), 0, 1.6), -24)   # the crystal-on-a-chain tinkle only
shot('leaves', seg(decode('leaves-1.mp3'), .2, 2.0), -24); shot('leaves', decode('leaves-2.mp3'), -24); shot('leaves', decode('leaves-3.mp3'), -24)
s = decode('sign-creak-1.mp3')
for a, b in [(.9, 1.6), (2.4, 3.5), (4.0, 5.1)]: shot('sign-creak', seg(s, a, b), -24)
shot('sign-creak', decode('sign-creak-3.mp3'), -26)
shot('coffee', seg(decode('coffee-1.mp3'), 0, 3.5), -25); shot('coffee', seg(decode('coffee-2.mp3'), 2.5, 4.6), -24); shot('coffee', seg(decode('coffee-3.mp3'), .8, 4.5), -24)
shot('bell', decode('bell-1.mp3'), -23); shot('bell', decode('bell-2.mp3'), -23)

json.dump(bank, open(os.path.join(OUT, 'sfx.json'), 'w'), indent=1)
print({k: len(v) for k, v in bank.items()})
