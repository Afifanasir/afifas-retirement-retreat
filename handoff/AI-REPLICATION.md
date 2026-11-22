# AI replication spec: Afifa's Retirement Retreat

This document lets another AI model (or developer) **rebuild this project from scratch, or continue it**, with the same look, behaviour and feel. Read it top to bottom before writing code. The source in `retreat/src` is the ground truth; where this document and the code disagree, the code wins. Every number below was taken from the shipped code.

Live: https://afifas-retirement-retreat.netlify.app (`?prayer=1` forces prayer time).
Human-oriented docs: `HANDOFF.md` (run/build/host), `NETLIFY.md` (deploy).

---

## 0. What it is, in one paragraph

A single-page, interactive, painterly illustration (1440 × 1080) of a golden-hour retirement scene: a woman (Afifa) relaxing on a meadow above a lake, a tree with two green Indian ring-necked parakeets, two cats, six goats, an easel with painting supplies, a Moroccan-style prayer alcove (namaz spot) and a little café on a terrace, roses in the foreground. It is a **living scene**: animals move, nap and play on their own; things respond to being touched (hover) and clicked with motion and real recorded sounds; there's a day/night mode; and Afifa walks to the prayer mat at the actual Bengaluru prayer times. A title screen fronts it, and a slim nav bar on the right holds day/night and mute.

## 1. Non-negotiable design principles (from the owner's feedback)

1. **Natural, never forced.** Motion must feel like real living creatures in a real place. No big moves only on click. Animals act on their own staggered random rhythms, nap sometimes (even by day), and react to touch with a *small* wobble, not a jump.
2. **Cohesive, painterly, soft.** Nothing should look pasted in. Every cut-out sits exactly on the painted art (same pixels, same place). Colours stay warm and slightly desaturated. Effects are subtle: if in doubt, smaller and slower.
3. **Hover = a hand passing through the scene.** Flowers shiver around the pointer, the lake ripples only on water, leaves rustle, things wobble or swing, each with its own sound. Hover areas must hug each element exactly. No sound or motion should bleed onto neighbours.
4. **Specific placement.** Day and night use identical placement. Elements never overlap awkwardly (cats were placed and their moves limited so they never cross each other or Afifa).
5. **Calm sound.** Soothing ambience (sparse birds and lake lapping by day, crickets at night), very light solo piano by day only, short natural one-shots that start instantly and never pile up.
6. **Fast everywhere, including Safari.** No CPU-bound SVG filters on large layers; GPU (WebGL) for the moving flowers and water; WebP art; preload so day/night switches never pop in.
7. Owner preferences: don't write docs unless asked; keep the nav bar "dainty"; the title screen must match the supplied lockup exactly.

## 2. Stack and structure

- Vite 6 + React 19 + TypeScript, no UI or animation libraries. Animation is CSS keyframes, a tiny sprite-sheet player, and one WebGL shader. Sound is Web Audio. Prayer times use `adhan`.
- Files:
  - `src/App.tsx`: everything stateful (layout, behaviour, hit-testing, interactions, intro, nav)
  - `src/index.css`: all styling and keyframes
  - `src/scene/layout.ts`: positions
  - `src/scene/GLLayer.tsx`: shader layers
  - `src/scene/Clip.tsx`: sprite sheets
  - `src/scene/sound.ts`: audio engine
  - `src/scene/prayer.ts`: prayer and night
- Static assets in `public/`, referenced by absolute paths (`/world/...`, `/sfx/...`, `/intro/...`, `/icons/...`, `/fonts/...`). **Serve from a domain root.**
- `tools/`: the Python asset pipeline (see §10).

## 3. Coordinate system and layout

- Fixed **stage 1440 × 1080**. Every element is positioned in **stage percentages**: `x` = left edge, `b` = **bottom** edge (the sprite uses `transform: translateY(-100%)`), and `w` = width. Height follows the image's aspect ratio.
- **Frame:** the stage plus a **56 px nav bar** to its right are scaled together, with `s = min(vw / 1496, vh / 1080)`, and centred. On portrait screens the bar moves **below** the stage (56 px tall, buttons in a row), with `s = min(vw / 1440, (vh − 56) / 1080)`.
- **Z order (integers only; fractional z-index is invalid CSS and hid elements once):**

  | Layer | z |
  |---|---|
  | sky | 0 |
  | far | 1 |
  | terrace | 2 |
  | onTerrace | 3 |
  | meadow | 4 |
  | actors | 10 |
  | tree | 20 |
  | foreground | 30 |
  | fx | 40 |

- **Full-stage layers** (`.layer`: `inset 0`, width/height 100%, stretched):

  | Layer | top offset |
  |---|---|
  | sky (`sky-day`/`sky-night`) | 0 |
  | meadow copy behind the far layer (fills a gap under the town) | −10% |
  | far: mountains, lake, town (WebGL) | −21% |
  | meadow | 3% |
  | foreground roses (WebGL) | 10% |

- **Sprites (`layout.ts` `items`):** `[id, image, x, b, w, z, kind, extras]`

  | id | image | x | b | w | notes |
  |---|---|---|---|---|---|
  | terrace | terrace-day / terrace-night | 44 | 60 | 67 | alcove + café; night art generated from the day art so placement matches |
  | tree-trunk | tree-trunk | −10 | 60 | 52 | |
  | tree-canopy | tree-canopy | −6 | 40 | 52 | idle `sway`, pivot `8% 100%` |
  | parrots | parrots-on-branch | 8.5 | 31.0 | 7.74 | day only, idle `bob`; perch aligned to the tree branch |
  | parrots-asleep | parrots-sleeping-on-branch | 9.2 | 29.82 | 6.36 | night only, rotate −10.5° |
  | cafe-sign | cafe-sign(-night) | 80.12 | 18.07 | 4.72 | cut from the terrace art; pivot `50% 0` (swings) |
  | alcove-lantern | alcove-lantern(-night) | 67.45 | 22.58 | 2.38 | cut from the terrace art; pivot `50% 0` |
  | cafe-board | cafe-board(-night) | 84.98 | 37.06 | 4.34 | A-frame standee cut from the terrace art |
  | easel | easel | 59 | 71 | 10.5 | |
  | stool | painting-stool | 52 | 67 | 5.5 | |
  | brush-mug | painting-supply | 52.8 | 58.5 | 2.6 | pivot `75% 289%` = the stool's foot, so it moves with the stool |
  | paint-box | painting-supply-2 | 70 | 73 | 7 | |
  | afifa | afifa-lying | 30 | 75.5 | 34 | idle `breathe` |
  | cat-orange | orange-cat-playing / -sleeping | 71.5 | 80 | 5.8 | sleeping width 7.6 (stretched pose) |
  | cat-black (grey) | black-cat-playing / -sleeping | 63.5 | 79.5 | 5.5 | flipped |
  | goat-1…6 | goat-grazing, goat-standing, goat-grazing-2, goat-grazing, goats-sitting, goats-sitting-2 | (14.5,70,8.5) (28,62,7) (46,60,5.5) (71,62.5,7) (84,62,6.5) (54,53,5.5) | | | goats 1–4 have sleeping/sitting night poses |

- **Afifa's other poses:**

  | Pose | x | b | w | Notes |
  |---|---|---|---|---|
  | `SIT` | 33.82 | 76.06 | 20.64 | flipped; registered to lie-down clip frame 0, shifted 3% toward centre |
  | `LIE_DOWN` clip | 30.05 | 76.22 | 22.82 | |
  | `PRAYING` | 62.4 | 36.2 | 6 | on the alcove rug |

  Walk sprites: `afifa-walking` (back view, toward the alcove) and `afifa-walking-1` (side view, returning).
- **Clips registered onto their stills (`ACTOR_CLIP`):**

  | Clip | x | b | w | Notes |
  |---|---|---|---|---|
  | cat-black-run | 62.57 | 79.97 | 7.22 | flip, class `scamper`, 2 loops |
  | cat-orange-pounce | 71.23 | 80.22 | 6.81 | class `pounce` |
  | goat-leap | 27.66 | 62.22 | 7.29 | |
  | parrot-takeoff (wing-spread) at `PARROT_SPOT` | 10.4 | 28.11 | 8.45 | frames 0–6 ping-pong ×2, 10 fps, fade in/out; the pair image swaps to `parrot-left-on-branch` meanwhile |

  `parrot-fly` crosses the sky (`flyby-lr` / `flyby-rl`).

## 4. Behaviour (state machines and schedules)

### Afifa
`lying → (7 s) sittingUp (lie-down clip reversed; scoots +13.1% of its width toward centre) → sitting`
- **First sit-up of the visit:** shows the greeting bubbles. After that, bubbles show only on click.
- **Prayer trip:** `toPray` (back-view walk, 2 steps then fade, 2.6 s) → `praying` (on the mat; alcove lamps forced on) → `fromPray` (side-view walk, 2 steps, fade, 2.6 s) → **`sitting` with fade-in + greeting bubbles**. At night it ends in `lyingDown` → lying (asleep).
- **Triggers:**
  - real prayer time: every 30 s, check `isPrayerTime()` and go; when the window ends, come back
  - click the prayer rug (`MAT` box `[59, 33.5, 72.2, 37.2]`): short visit, returns by itself after 7 s
  - click Afifa or the mat while praying: comes back now
- **Night:** she lies asleep (with "zzz"), unless it's a real prayer time.

### Speech bubbles
- Frosted cream card, Albert Sans 500 20 px, colour #4a2f22, radius 18. The tail sits at 28% of the card's width.
- Positioned by `--hx` (head x) and `--hb` (bottom):

  | Pose | --hx | --hb |
  |---|---|---|
  | sitting | 45.7% | 50.6% |
  | lying | 34% | 37.4% |
  | praying | 65.4% | 72.8% |

- **Greeting** (bubble 1 at 0 s, bubble 2 at 3.8 s, hide at 10.5 s):
  1. "Hi there! I am Afifa. So nice to see you here."
  2. "Since you found this little world somewhere on the internet, it means I am still a corporate slave, manifesting this retirement plan 24/7."
- **Prayer** (shown 0.9 s after reaching the mat at a real prayer time, also at night):
  1. "It's prayer time, so I've stepped onto my prayer mat for a few quiet minutes."
  2. "Want me back sooner? Just tap me and I will come right over."

### Living scenery (day only; random interval in seconds per actor)
- **Clip rhythms:**

  | Actor | Interval (s) |
  |---|---|
  | goat-2 leap | 18–40 |
  | orange cat pounce | 8–16 |
  | grey cat run | 12–22 |
  | parrot wing-spread | 16–32 |
  | parrot fly-by | 40–80 |

- **Naps (awake / asleep, seconds):**

  | Who | Awake | Asleep | Notes |
  |---|---|---|---|
  | both cats (together) | 70–140 | 20–45 | start awake |
  | goat-1 | 70–150 | 25–50 | |
  | goat-3 | 60–140 | 25–50 | |
  | goat-4 | 80–160 | 25–50 | |

  Goats start asleep with 30% chance. A napping animal uses its sleeping pose with a fade.
- **Cat moves must never cross:**
  - grey cat: `scamper` = turn, 20% of its width toward the orange cat, turn back
  - orange cat: `pounce` = −12% then back
- **Idle CSS loops** (staggered by `--d` so nothing moves in sync): `sway` (canopy), `breathe`, `bob` (parrots), `graze-a/b/c`, `hop`, `play-a/b`, `asleep`.

### Day / night
- The initial mode comes from Bengaluru: night = before Fajr or after Isha (`adhan`, Karachi method, Hanafi Asr, prayer window 15 min).
- **Toggle:** a 650 ms "dusk" fade, then swap.
- **Night changes:**
  - sky, far and terrace use their painted night versions
  - other sprites get a `brightness(.42) saturate(.75) hue-rotate(-12deg)` filter
  - everyone sleeps
  - lamps glow, extra `NIGHT_LIGHTS` appear, fireflies replace petals
  - moonlight overlay
  - music fades out, crickets fade in
  - the page background around the frame crossfades from cream (#f8f4ea → #e6dfcc radial) to night blue (#272b42 → #15172a)
- **Particles:** 72 falling rose petals by day, 32 fireflies by night.

### Lights
- **Alcove group:** hanging lantern sprite (click), shelf lantern box `[74.9, 23.6, 77.2, 27.8]`, plus a non-clickable floor pool.
- **Café group:** sconce box `[87.4, 15.3, 89.2, 20.8]`, window box `[93.1, 14.8, 100, 26.4]`.
- **On:** a radial warm glow (`screen` blend; opacity .85 by day, .8 at night).
- **Off:** a radial-masked `backdrop-filter: brightness(.5) saturate(.55)` (.3 at night).
- **Clicking a fixture:** synth switch click (both ways), then the chandelier tinkle (alcove) or shop bell + steam (café) when turning on. Night-only extra lights belong to a group and switch with it.
- The cursor is a hand only over real fixtures.

## 5. Interactions (hover = "touch", click = "react")

- **Hit-testing is per-pixel.** For each image with `data-hit`, sample the alpha (> 40) of the actual pixel under the pointer (cached canvas `ImageData`). The top z wins; at equal z the later-painted element wins. Playing clips are hit-tested by their central box (22–78% x, 25–100% y).
- **Flowers:** if the foreground's alpha under the pointer > 40, the WebGL shiver is centred there and `flowers` plays (≥ 420 ms apart).
- **Lake:** only if nothing else is hit, `lake-mask` (sampled through the far layer's box) is white, and the meadow isn't covering. Ripple + `waves` (≥ 1.8 s apart).
- **Café front:** boxes `[89.9, 15.3, 92.7, 32]` (door) and `[93.1, 27.8, 100, 37]` (table and chairs) brew `coffee` with a steam puff (≥ 7 s apart).
- **FEEL kinds** (`cat, goat, parrot, easel, prop, sign, board, lantern, tree`): on pointer *entry* (≥ 1.2 s per element; the canopy re-triggers every 1.5 s while moving inside), play a feel animation plus a voice:

  | Kind | Animation | Sound |
  |---|---|---|
  | cat, goat, parrot, easel, prop, board | `wobble` (±1.4°, 0.75 s) | cats `cat`, goats `goat`, parrot `parrot`×2 overlapping, easel/stool/paint `tap` |
  | sign | `swing` (from top, 1.9 s) | `sign-creak` |
  | lantern | `swingSoft` (2.2 s) | `chandelier` |
  | tree canopy | `rustle` (±0.6°, subtle) | `leaves` |
  | sleeping animals | `stir` | voice at 35% gain |
  | A-board | | `tap` pitched down, played twice (rocking) |

- `TOGETHER`: the stool and brush mug react as one.
- **Idle and touch must not cancel each other.** The sprite structure is `div.sprite(idle class) > div (idle target) > div(key=react counter, class = feel-*/react-*, transform-origin = pivot) > img`.
- **Click:**
  - 9 radiating sparkles (14 px dots, 1.4 s) at the click point, everywhere
  - flowers get a stronger shiver
  - the animal/thing plays its voice plus the `react-*` pop (no forced big clip)
  - lamps toggle
  - mat/Afifa as in §4
- **Sound overlap rule:** hover voices are "solo": a new one fades the previous (40 ms). The second parrot joins the first.

## 6. GPU layers (`GLLayer.tsx`)

- One WebGL quad per layer (foreground, far). Textures are premultiplied. **Call `gl.viewport` after resizing the canvas** (bug seen: drawing only 300 × 150).
- **Flowers:**
  - **breeze:** a *fixed* value-noise field, `f = noise(uv * (17, 33)) − .5` (two channels), times `swing = 4.6·sin(0.97t) + 1.7·sin(1.93t + 1)`, × 1.15 px. Stems bend and return; never a drifting "liquid" field (the owner rejected that).
  - **touch:** `noise(uv * (50, 38))` × 12 px × `sin(10.5t)` × `smoothstep(.13, .045, r)` × `amt`
  - **grade:** day = saturation .82, brightness .95, sepia .08; night = sat .75, brightness .42, tint (.94, .97, 1.1). The day/night mix eases per frame.
  - plus an overall CSS `lean` skew (9 s, ±.55°)
- **Water:** no ambient motion. Rings `sin(150r − 8t)` × `smoothstep(.13, 0, r)` × `amt`, offset (.0012, .0034) uv, multiplied by the lake mask. The far layer crossfades the day/night textures.
- **Touch amount:** `power × (1 − age / 700 ms)`, eased toward 0.12 per frame; the pointer position is eased toward 0.25 per frame. A click sets power 1.8.

## 7. Sound (`sound.ts`, all recorded, Freesound CC0)

- **Buses:** master .9 → fx 1.0, ambience .55, music .18 (0 at night).
- **Per-sound levels:**

  | Sound | Level |
  |---|---|
  | flowers | .45 |
  | leaves | .5 |
  | waves | .55 |
  | tap | .45 |
  | goat | .55 |
  | cat | .6 |
  | parrot | .72 |
  | chandelier | .5 |
  | sign-creak | .45 |
  | coffee | .5 |
  | bell | .45 |

- **One-shots:** random take (never the same twice in a row), playback rate ±5%. Every file is trimmed to start within ~30 ms of its onset (the owner noticed delays).
- **Loops:** one random file per category. Start at a random offset, with a 1.2 s crossfade between day and night.

  | Loop | Day level | Night level |
  |---|---|---|
  | `ambience-day` (sparse birds) | 1 | 0 |
  | `lake` lapping | .6 | .3 |
  | `breeze` | .28 | .2 |
  | `ambience-night` (crickets) | 0 | 1 |
  | `music` (soft solo piano) | 1 | 0 |

- **Load order:** the piano first (started on landing; browsers only make it audible after the first click/tap/key, so it's unlocked on the first `pointerdown/keydown/touchstart`), then one-shots, then the other loops.
- Synth extras: the light-switch click, and a tiny "pop".
- A hot-reload guard closes the old AudioContext and reloads the page (dev only).

## 8. Title screen and nav bar

- **Intro overlay inside the stage:**
  - cream wash `rgba(252,247,230,.5)` + `backdrop-filter: blur(9px) saturate(.85)` + SVG-noise grain (multiply .45)
  - while the scene's key layers decode: a solid `#f7f1e1` veil (no pop-in)
  - halo: radial `rgba(255,246,165,…)`, 2700 px circle, alpha .26 → .012
  - title lockup `public/intro/title.webp` (extracted from the owner's PNG), width 1070 px, centred at 48%
  - "tap anywhere to enter": **Branch** font, 34 px, #263d30, pulsing
- **Tap:** unlock audio and start sounds; the title drifts up and fades (1 s) and the overlay fades out (1.5 s).
- **Nav bar** (56 px; buttons 38 px circles `#fff7dd` with a soft shadow; icons 52%, #263D30; bottom-aligned, gap 14, bottom 40):
  - background = the owner's Figma gradient `linear-gradient(90deg, #FFFFFF 0%/0, #FAF7F0 7%/.45, #F2F0E5 100%/.75)` over a blurred, mirrored strip of the scene's right edge (`bar-day.jpg` / `bar-night.jpg`); dusky equivalent at night
  - icons: moon-stars by day (go to night), sun by night; speaker on/off
- **Fonts:**
  - Branch (title, tap line): owner-supplied
  - Albert Sans (bubbles): OFL
  - CCS Belvare: owner-supplied, legacy

## 9. Performance rules learned

- No SVG `feDisplacementMap` / `feTurbulence` on full-screen layers (CPU-bound in Safari). Use WebGL.
- Animate `transform` / `opacity`, not `background-position`.
- All art is WebP (q 88, alpha exact; lake mask lossless). 27 MB of PNG became 4.3 MB.
- Preload the title and font in `index.html`. After the scene is ready, decode all day and night art plus the clips in the background, so the night switch is instant.
- Netlify caches `/world`, `/sfx` and `/fonts` for a week, and `/assets` immutably.

## 10. Asset pipeline (`tools/`, Python 3 + Pillow, NumPy, SciPy; ffmpeg)

- **Source art:** stills generated by the owner on **green or magenta screens**, plus Higgsfield **video clips** on the same screens.
- `key.py in.png out.png [green|magenta]`: chroma key (soft edges, despill) → trimmed RGBA.
- `clip2sheet.py frames_dir out_prefix green|magenta target_h [notop]`: run on ffmpeg-extracted frames (12 fps). Produces keyed frames → union bounding box → grid sprite sheet `.webp` + `.json` (`frames, cols, fw, fh`). `notop` drops frames where the subject leaves the top of the frame.
- `parrotclip.py frames out threshold plate_index`: keys magenta and removes the clip's static branch by subtracting an empty-branch frame used as a plate.
- **Clip registration:** match the subject's bounding box in clip frame 0 to its still. Solve x, b and w so the swap is seamless. For Afifa's lie-down clip, match the seated height.
- **Cut-outs from the terrace art** (café sign, A-board, lantern): crop at the same coordinates from the day and night terrace images. Build a mask from dark pixels (convex hull, with the chain kept for the lantern). Place it with the same stage %, z = terrace, so lamp glows and dimming fall on it naturally.
- **Lake mask:** colour classification (bluish water, gold sun reflection, never foliage) + smoothness + a band limit → connected component from water seeds → closing and fill → blur. Must exclude the towns, trees and mountains.
- **Night terrace and far layers:** generated from the day art (so placement is identical), then hand-tuned.
- `sfx_build.py raw_dir out_dir`:
  - one-shots: trim to onset, level by the loudest 100 ms window (target −19 to −27 dB per category), fades, mono 96 kbps
  - loops: crossfade the end into the start (3–4 s), `loudnorm` (ambience −27 to −33 LUFS, music −23), 112 kbps
  - writes `sfx.json`
  - raw sources and credits: `sfx-source/manifest.json` (copied to `public/sfx/sources.json`)

## 11. Asset manifest

- **`public/world`** (WebP):
  - layers: sky-day, sky-night, far-day, far-night, meadow, foreground, terrace-day, terrace-night, lake-mask
  - tree: tree-trunk, tree-canopy
  - parrots: parrots-on-branch, parrot-left-on-branch, parrots-sleeping-on-branch
  - terrace cut-outs: cafe-sign(-night), cafe-board(-night), alcove-lantern(-night)
  - easel and painting: easel, painting-stool, painting-supply, painting-supply-2
  - Afifa: afifa-lying, -sitting, -praying, -walking, -walking-1
  - cats: orange-cat-playing/sleeping, black-cat-playing/sleeping
  - goats: goat-grazing, goat-grazing-2, goat-standing, goats-sitting, goats-sitting-2, goats-sleeping
  - `particles/` (petal-rose-pink-01…09, firefly-01)
  - present but unused: tree, parrot-flying/preening/wings-open, parrots-sitting/sleeping, cats-*, *-orig
- **Clips** (`world/clips`, frames at 12 fps):

  | Clip | Frames |
  |---|---|
  | afifa-lie-down | 19 (frame 0 = sitting, last = reclining) |
  | cat-black-run | 37 |
  | cat-orange-pounce | 37 |
  | goat-leap | 29 |
  | parrot-fly | 37 |
  | parrot-takeoff | 25 |
  | parrot-landing | 25 (unused) |

- **Sounds** (`public/sfx`), takes per category:

  | Category | Takes |
  |---|---|
  | ambience-day | 1 |
  | lake | 1 |
  | ambience-night | 2 |
  | breeze | 1 |
  | music (piano) | 3 |
  | flowers | 4 |
  | waves | 4 |
  | tap | 4 |
  | goat | 6 |
  | cat | 3 |
  | parrot | 7 |
  | chandelier | 1 |
  | leaves | 3 |
  | sign-creak | 4 |
  | coffee | 3 |
  | bell | 2 |

- **Originals kept outside the deploy:** `world-png/` (PNG masters), `asset-library/` (full organised library), `sfx-source/` (raw downloads).

## 12. Rebuild checklist (for a fresh implementation)

1. Vite React TS app; the 1440 × 1080 stage + 56 px bar frame scaler (§3).
2. Layers and sprites from §3, using the integer z table. Verify day and night overlays line up pixel-for-pixel.
3. Per-pixel hit-testing (§5) and the three-wrapper sprite structure.
4. Idle CSS loops, `RHYTHM` clip scheduler, nap scheduler (§4).
5. Afifa's state machine, prayer integration (`adhan`, Bengaluru), bubbles (§4).
6. Lamps and night mode (§4).
7. WebGL flower and water layers with the exact feel in §6. Check it isn't "liquid".
8. Sound engine and mix (§7). Verify one-shot onsets ≤ 30 ms and the solo rule.
9. Title screen and nav bar (§8). Then performance (§9) and a deploy check (`?prayer=1`).
10. Test in Safari and on a phone. Verify the lake ripple stays on water and hover areas hug their elements.
