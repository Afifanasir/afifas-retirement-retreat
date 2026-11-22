# Afifa's Retirement Retreat: handoff

An interactive, illustrated 1440 × 1080 scene: a golden-hour meadow with Afifa, two cats, goats, two parrots, a lake, a prayer alcove and a café. Creatures live on their own schedules, things respond to the pointer and to clicks with motion and sound, there is a day/night mode, and Afifa goes to her prayer mat at the real Bengaluru prayer times.

Screenshots of the prayer-time speech bubbles: `prayer-bubble-1.jpg`, `prayer-bubble-2.jpg` (this folder).

---

## 1. Run, build, deploy

| Task | Command (run inside `retreat/`) |
|---|---|
| Install (first time) | `npm install` |
| Local dev server | `npm run dev` → http://localhost:5173 |
| Production build | `npm run build` → creates `dist/` |
| Preview the build locally | `npm run preview` |

Requirements: Node 20 or newer (built and tested on Node 22).

**The deployable website is the `dist/` folder** (static files only, about 54 MB). It needs no server code, database, API keys or environment variables.

### Any static host

Upload `dist/` to any static host, or point the host's build at `npm run build` with output folder `dist`:

| Host | Build command | Output folder | Notes |
|---|---|---|---|
| Netlify | `npm run build` | `dist` | `netlify.toml` is included. See `NETLIFY.md`. |
| Vercel | `npm run build` | `dist` | Framework preset "Vite". |
| Cloudflare Pages | `npm run build` | `dist` | Framework preset "Vite". |
| AWS S3 + CloudFront, Firebase Hosting, any web server | build locally | upload `dist/` | Serve `index.html` at the site root. |

**Important: serve it from the root of a domain** (e.g. `https://retreat.example.com/`), not a sub-folder (`https://example.com/retreat/`). Art, sound and font paths start with `/`. To host in a sub-folder (e.g. GitHub Pages project sites), set `base: '/retreat/'` in `vite.config.ts` and change the hard-coded `/world/`, `/sfx/`, `/fonts/`, `/intro/`, `/icons/` paths to be relative to that base.

Useful URL switch: `?prayer=1` forces prayer time (for demos), `?prayer=0` forces it off. Without it, real prayer times are used.

---

## 2. Project structure

```
retreat/
├── index.html
├── netlify.toml              Netlify build + caching
├── public/                   copied as-is into the site
│   ├── world/                scene art (layers, characters, props), lake-mask.png, particles/
│   │   └── clips/            animation sprite sheets (.webp + .json) made from the Higgsfield clips
│   ├── sfx/                  sounds (mp3), sfx.json (the list the app loads), sources.json (credits/licences)
│   ├── intro/                title.png (title lockup), bar-day/night.jpg (nav bar blur)
│   ├── icons/                nav bar icons (sun, moon, speaker on/off)
│   └── fonts/                Branch, CCS Belvare, Albert Sans
├── src/
│   ├── App.tsx               the scene: layout, behaviour, interactions, intro, nav bar
│   ├── index.css             all styling and CSS animations
│   └── scene/
│       ├── layout.ts         WHERE everything sits (positions, sizes, layers, lamps)
│       ├── GLLayer.tsx       GPU drawing of the flowers (breeze + touch) and the lake (ripples)
│       ├── Clip.tsx          plays the animation sprite sheets
│       ├── sound.ts          sound engine (effects, ambience, music, mixing)
│       └── prayer.ts         prayer-time and night-time calculation
├── handoff/                  this document, NETLIFY.md, AI-REPLICATION.md, screenshots
├── tools/                    Python asset pipeline (chroma key, clip → sprite sheet, sound build)
├── world-png/                original PNG masters of the WebP art (not deployed)
├── sfx-source/               original downloaded sounds + manifest (not deployed)
├── asset-library/            full original asset library (not deployed)
└── _backup_v*/               older versions of the app (not deployed)
```

---

## 3. How the scene works

- **Stage.** Everything is placed on a fixed 1440 × 1080 stage, using percentages: `x` = left edge, `b` = bottom edge, `w` = width (height follows the image). The stage plus the 56 px nav bar are scaled together to fit the window. On a portrait screen the nav bar moves underneath.
- **Layers, back to front:** sky → far layer (mountains, lake, town) → terrace (prayer alcove + café) → meadow → creatures/props → tree → foreground flowers → particles (petals by day, fireflies by night) → speech bubbles → title screen.
- **Title screen.** The scene sits behind a warm haze, blur and grain, with the title lockup and a soft yellow halo. One tap starts the sound (browsers require a tap first) and lifts the haze.
- **Living scenery.** Each animal has its own random rhythm for its animated moves and naps (the cats nap together). Afifa lies down, sits up after 7 s, and greets you once.
- **Prayer.** At each of the five daily prayers (Bengaluru, Karachi method, Hanafi Asr), Afifa walks to the mat and the alcove lights come on. Two speech bubbles explain it's prayer time. Tapping her (or the mat) brings her back to sit on the grass, and she says hello. Tapping the mat at other times sends her for a short visit.
- **Touch (hover).** Flowers shiver, the lake ripples (only on the water, via `lake-mask.png`), and the tree rustles. Animals, the easel, stool, paint box, café sign, A-board and the lantern wobble or swing. Each has its own sound.
- **Click.** Sparks appear wherever you click. The light fixtures toggle the alcove or café lights. The flowers rustle harder.
- **Day/night** starts from the real time in Bengaluru and can be switched in the nav bar. At night everything sleeps, the lamps glow, the crickets come in and the piano rests.

---

## 4. Where to change things

| To change… | Edit |
|---|---|
| Position or size of anything | `src/scene/layout.ts` (`items`, `SIT`, `PRAYING`, `LAMPS`) |
| Speech-bubble text | `src/App.tsx`: `BUBBLES` (normal) and `PRAYER_BUBBLES` (prayer time) |
| Bubble position over her head | `src/App.tsx`: `HEAD` |
| How often animals move or nap | `src/App.tsx`: `RHYTHM` and `NAPS` |
| When Afifa sits up | `src/App.tsx`: `SIT_AFTER` (ms) |
| Prayer city, method, duration | `src/scene/prayer.ts` (coordinates, `CalculationMethod`, `WINDOW_MIN`) |
| Which sound plays for what | `src/App.tsx`: `VOICE` (hover/click sounds) |
| Sound volumes | `src/scene/sound.ts`: `LEVEL` (per sound), bus gains (effects / ambience / music) |
| Replace a sound | drop a new mp3 in `public/sfx/` and list it in `public/sfx/sfx.json` |
| Flower breeze / touch strength | `src/scene/GLLayer.tsx` (shader numbers commented inline) |
| Colours, bubble style, nav bar, intro | `src/index.css` |
| Number of petals / fireflies | `src/App.tsx`: `Particles` |

---

## 5. Assets and licences

- **Illustrations and animation clips:** created for this project (user-generated, keyed and composited here).
- **Sounds:** all from Freesound under **CC0 1.0** (public domain, no attribution required). Every file's source page, author and licence is listed in `public/sfx/sources.json`.
- **Fonts:**
  - **Albert Sans** (speech bubbles): SIL Open Font License, included in `public/fonts/AlbertSans-OFL.txt`.
  - **Branch** (title and "tap anywhere to enter") and **CCS Belvare**: supplied by the owner. **Check that their licences allow use on a public website before launch.**
- **Prayer times:** the `adhan` library (MIT).

---

## 6. Browser notes and known limits

- Built for desktop (Chrome, Safari, Edge, Firefox). Phones work, with the nav bar under the scene, but the scene is a fixed landscape picture.
- Sound starts only after the first tap (a browser rule). The title screen exists partly for this.
- The flowers and the lake are drawn with WebGL. If WebGL is unavailable, they show as still images without the breeze or ripple.
- First load is about 54 MB of art and sound. The short touch sounds load first; ambience and music follow. Cached for a week after the first visit.
