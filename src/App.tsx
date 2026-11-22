import { useCallback, useEffect, useRef, useState } from 'react'
import { items, LAMPS, LAYERS, NIGHT_LIGHTS, PRAYING, SIT, W as asset, Z, type Item } from './scene/layout'
import { isNightNow, isPrayerTime } from './scene/prayer'
import { click, loadSounds, play, pop, setAmbience, setMuted, startMusic, unlockAudio } from './scene/sound'
import { Clip, preloadClips } from './scene/Clip'
import { GL_OK, GLLayer, type Touch } from './scene/GLLayer'

// Higgsfield clips that replace an actor while playing. x/b/w registered so frame 0 lands exactly on the still.
const ACTOR_CLIP: Record<string, { name: string; x: number; b: number; w: number; flip?: boolean; className?: string; loops?: number }> = {
  'cat-black': { name: 'cat-black-run', x: 62.57, b: 79.97, w: 7.22, flip: true, className: 'scamper', loops: 2 },
  'cat-orange': { name: 'cat-orange-pounce', x: 71.23, b: 80.22, w: 6.81, className: 'pounce' },
  'goat-2': { name: 'goat-leap', x: 27.66, b: 62.22, w: 7.29 },
}
// Afifa's lie-down clip: frame 0 = sitting (matches SIT), last frame = reclining, anchored to the lying still
const LIE_DOWN = { x: 30.05, b: 76.22, w: 22.82 }
// right parrot of the pair, registered onto the take-off clip (its first frames are a perched wing-spread)
const PARROT_SPOT = { x: 10.4, b: 28.11, w: 8.45 }

// living scenery: each actor acts on its own random rhythm [min, max] seconds, staggered so it never feels synchronised
const RHYTHM: Record<string, [number, number]> = {
  'goat-2': [18, 40], 'cat-orange': [8, 16], 'cat-black': [12, 22], flap: [16, 32], flyby: [40, 80],
}
// animals also doze off by day: [awake, resting] seconds; they use their sleeping pose meanwhile
const NAPS: { ids: string[]; awake: [number, number]; nap: [number, number] }[] = [
  { ids: ['cat-orange', 'cat-black'], awake: [70, 140], nap: [20, 45] }, // the cats curl up together, then wake together
  { ids: ['goat-1'], awake: [70, 150], nap: [25, 50] }, { ids: ['goat-3'], awake: [60, 140], nap: [25, 50] },
  { ids: ['goat-4'], awake: [80, 160], nap: [25, 50] },
]
const NAPPERS = new Set(NAPS.flatMap((n) => n.ids))
// things that respond to being brushed by the pointer
const FEEL = new Set(['cat', 'goat', 'parrot', 'easel', 'prop', 'sign', 'board', 'lantern', 'tree'])
const TOGETHER: Record<string, string[]> = { stool: ['stool', 'brush-mug'], 'brush-mug': ['stool', 'brush-mug'] }
// the lake: a mask painted off the far layer (white = water), so the water's touch stays on the water
const lakeMask = new Image()
lakeMask.src = asset('lake-mask')
const SIT_AFTER = 7000
// where the speech bubble's tail points: head x, and the bubble's bottom (stage %) just above the head
const HEAD = { sitting: { '--hx': '45.7%', '--hb': '50.6%' }, lying: { '--hx': '34%', '--hb': '37.4%' }, praying: { '--hx': '65.4%', '--hb': '72.8%' } } // Afifa lies back, then sits up on her own

type Afifa = 'lying' | 'sittingUp' | 'sitting' | 'toPray' | 'praying' | 'fromPray' | 'lyingDown'

const W = 1440, H = 1080
const PRAYER_BUBBLES = [
  "It's prayer time, so I've stepped onto my prayer mat for a few quiet minutes.",
  'Want me back sooner? Just tap me and I will come right over.',
]
const BUBBLES = [
  'Hi there! I am Afifa. So nice to see you here.',
  'Since you found this little world somewhere on the internet, it means I am still a corporate slave, manifesting this retirement plan 24/7.',
]
// what each thing sounds like when touched (hover) or clicked; sleeping animals only murmur
const VOICE: Record<string, (asleep: boolean) => void> = {
  tree: () => play('leaves', { solo: true }),
  cat: (z) => play('cat', { gain: z ? 0.35 : 1, solo: true }),
  goat: (z) => play('goat', { gain: z ? 0.35 : 1, solo: true }),
  parrot: () => { play('parrot', { solo: true }); play('parrot', { delay: 0.2 + Math.random() * 0.25, gain: 0.8, join: true }) }, // two birds, overlapping
  easel: () => play('tap', { solo: true }), prop: () => play('tap', { solo: true }),
  lantern: () => play('chandelier', { solo: true }), sign: () => play('sign-creak', { solo: true }), board: () => { play('tap', { rate: 0.72, solo: true }); play('tap', { rate: 0.68, gain: 0.55, delay: 0.17, join: true }) }, // A-board rocks on its legs
}
// touch areas measured off the terrace art (stage %, [x0, y0, x1, y1]) so each sound belongs to its own element
const inBox = (px: number, py: number, [x0, y0, x1, y1]: number[]) => px > x0 && py > y0 && px < x1 && py < y1
const CAFE = [[89.9, 15.3, 92.7, 32], [93.1, 27.8, 100, 37]] // cafe door, then the table and chairs
const MAT = [59, 33.5, 72.2, 37.2]                             // the prayer rug in the alcove
const onMat = (px: number, py: number) => inBox(px, py, MAT)

// the scene is a fixed 1440x1080 frame; the nav bar sits beside it (to its right), or under it on a portrait screen
// Landscape: the whole scene is always visible (never cropped), centred; the rest of the window is filled by a
// soft blurred extension of the scene, and the slim nav bar floats at the window's right edge.
// Portrait (phones): the whole scene fits, nav bar underneath.
const NAV_H = 56
function useLayout() {
  const fit = () => {
    const vw = window.innerWidth, vh = window.innerHeight, portrait = vw < vh
    if (portrait) return { portrait, s: Math.min(vw / W, (vh - NAV_H) / H), ox: 0, oy: 0 }
    const s = Math.min(vw / W, vh / H)
    return { portrait, s, ox: (vw - W * s) / 2, oy: (vh - H * s) / 2 }
  }
  const [l, setL] = useState(fit)
  useEffect(() => {
    const on = () => setL(fit())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return l
}

// Click hit-testing on actual painted pixels, not on the transparent bounding boxes.
const alphaCache = new Map<string, ImageData>()
// a playing clip has no image to sample, so its central area (where the animal is) counts as touchable
function coreAt(el: HTMLElement, cx: number, cy: number) {
  const r = el.getBoundingClientRect(), fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height
  return fx > 0.22 && fx < 0.78 && fy > 0.25 && fy < 1
}
function opaqueAt(img: HTMLImageElement, cx: number, cy: number, box: Element = img, ch = 3) {
  const r = box.getBoundingClientRect()
  if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom || !img.complete) return false
  let d = alphaCache.get(img.src)
  if (!d) {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(img, 0, 0)
    d = g.getImageData(0, 0, c.width, c.height)
    alphaCache.set(img.src, d)
  }
  let fx = (cx - r.left) / r.width
  if (img.style.transform.includes('scaleX(-1)')) fx = 1 - fx
  const x = Math.floor(fx * d.width), y = Math.floor(((cy - r.top) / r.height) * d.height)
  return d.data[(y * d.width + x) * 4 + ch] > 40
}

const rand = ([a, b]: [number, number]) => (a + Math.random() * (b - a)) * 1000

export default function App() {
  const { portrait, s: scale, ox, oy } = useLayout()
  const [entered, setEntered] = useState(false)
  const [intro, setIntro] = useState<'shown' | 'leaving' | 'gone'>('shown')
  const [sceneReady, setSceneReady] = useState(false)
  // the plain pictures stay visible until the GPU versions have drawn their first frame (no blank background)
  const [glFar, setGlFar] = useState(false), [glFg, setGlFg] = useState(false)
  const [night, setNight] = useState(isNightNow)
  const [muted, setMute] = useState(false)
  const [afifa, setAfifa] = useState<Afifa>(() => (isPrayerTime() ? 'praying' : 'lying'))
  const greeted = useRef(false) // she says hello the first time she sits up; after that only when clicked
  const backFromPrayer = useRef(false) // she just walked back: fade into her sitting pose
  const tripReturn = useRef(false) // a visit started by clicking the mat: she comes back by herself after praying
  const afifaNow = useRef(afifa)
  afifaNow.current = afifa
  const [bubble, setBubble] = useState(-1)
  const [react, setReact] = useState<Record<string, { n: number; how: 'react' | 'feel' }>>({})
  const flowerTouch = useRef<Touch | null>(null), waterTouch = useRef<Touch | null>(null) // read by the GL layers each frame
  const [clips, setClips] = useState<Record<string, number>>({})
  const [flap, setFlap] = useState(0)        // 0 none, 1 playing, 2 fading back to the pair
  const [flyby, setFlyby] = useState(0)      // token; direction alternates
  const [hover, setHover] = useState<string | null>(null)
  const [fx, setFx] = useState<{ id: number; kind: 'sparkle' | 'steam'; x: number; y: number }[]>([])
  const [dusk, setDusk] = useState(0)
  const [lampsOn, setLampsOn] = useState<Record<string, boolean>>({ alcove: true, cafe: true })
  const [rest, setRest] = useState<Record<string, boolean>>({})
  const resting = useRef(rest)
  resting.current = rest
  const stage = useRef<HTMLDivElement>(null)
  const fgRef = useRef<HTMLImageElement>(null), meadowRef = useRef<HTMLImageElement>(null), farRef = useRef<HTMLImageElement>(null)
  const lastHover = useRef<string | null>(null), felt = useRef<Record<string, number>>({})
  const timers = useRef<number[]>([])

  const showBubbles = useCallback(() => {
    timers.current.forEach(clearTimeout)
    setBubble(0)
    timers.current = [window.setTimeout(() => setBubble(1), 3800), window.setTimeout(() => setBubble(-1), 10500)]
  }, [])

  const playClip = useCallback((id: string) => setClips((c) => (c[id] ? c : { ...c, [id]: Date.now() })), [])
  const endClip = (id: string) => setClips(({ [id]: _, ...rest }) => rest)
  const burst = (kind: 'sparkle' | 'steam', x: number, y: number) => {
    const id = Date.now() + Math.random()
    setFx((f) => [...f, { id, kind, x, y }])
    window.setTimeout(() => setFx((f) => f.filter((e) => e.id !== id)), 2600)
  }

  // ---- living scenery: every actor runs its own loop (day only) ----
  useEffect(() => {
    if (!entered || night) return
    const ts: number[] = []
    const loop = (key: string, act: () => void, first: number) => {
      const go = (delay: number) => { ts.push(window.setTimeout(() => { if (!resting.current[key]) act(); go(rand(RHYTHM[key])) }, delay)) }
      go(first)
    }
    loop('goat-2', () => playClip('goat-2'), 3000)
    loop('cat-orange', () => playClip('cat-orange'), 5500)
    loop('cat-black', () => playClip('cat-black'), 9000)
    loop('flap', () => setFlap((f) => f || 1), 7000)
    loop('flyby', () => setFlyby((n) => n || Date.now()), 14000)
    // naps: each animal alternates awake / resting on its own clock; some start the day already dozing
    NAPS.forEach(({ ids, awake, nap }) => {
      const cycle = (asleep: boolean) => {
        setRest((r) => ({ ...r, ...Object.fromEntries(ids.map((id) => [id, asleep])) }))
        ts.push(window.setTimeout(() => cycle(!asleep), rand(asleep ? nap : awake)))
      }
      cycle(!ids[0].startsWith('cat') && Math.random() < 0.3)
    })
    return () => { ts.forEach(clearTimeout); setRest({}) }
  }, [entered, night, playClip])

  // Afifa: lying -> (6s) sits up and stays sitting. Night: she sleeps lying down.
  useEffect(() => {
    if (!entered || night || afifa !== 'lying') return
    const t = window.setTimeout(() => setAfifa('sittingUp'), SIT_AFTER)
    return () => clearTimeout(t)
  }, [entered, night, afifa])
  // the grass rustles as she sits up or settles back down
  useEffect(() => {
    if (afifa === 'sittingUp') backFromPrayer.current = false
    if (afifa === 'sittingUp' || afifa === 'lyingDown') { play('flowers', { rate: 0.8 }); play('leaves', { gain: 0.5, rate: 0.7, delay: 0.45 }) }
  }, [afifa])
  useEffect(() => { if (night) setAfifa((a) => (a === 'praying' && isPrayerTime() ? a : 'lying')) }, [night])

  // prayer trip: walk to the alcove, pray, walk back (button or real prayer times)
  const goPray = useCallback((returnByHerself: boolean) => {
    tripReturn.current = returnByHerself
    setBubble(-1)
    setAfifa((a) => (a === 'lying' || a === 'sitting' ? 'toPray' : a))
  }, [])
  useEffect(() => { if (afifa === 'toPray' || afifa === 'praying') setLampsOn((s) => ({ ...s, alcove: true })) }, [afifa])
  useEffect(() => {
    if (!entered || afifa !== 'praying' || tripReturn.current) return
    const t = window.setTimeout(showBubbles, 900)
    return () => clearTimeout(t)
  }, [entered, afifa, showBubbles])
  useEffect(() => {
    if (afifa === 'toPray') { const t = window.setTimeout(() => setAfifa('praying'), 2600); return () => clearTimeout(t) }
    if (afifa === 'praying' && tripReturn.current) { const t = window.setTimeout(() => setAfifa('fromPray'), 7000); return () => clearTimeout(t) }
    if (afifa === 'fromPray') { const t = window.setTimeout(() => { if (night) setAfifa('lyingDown'); else { backFromPrayer.current = true; setAfifa('sitting'); showBubbles() } }, 2600); return () => clearTimeout(t) }
  }, [afifa, night, showBubbles])
  useEffect(() => {
    // follow the real Bengaluru prayer times: go when one starts, come back when its window ends
    const t = window.setInterval(() => {
      if (isPrayerTime()) goPray(false)
      else if (afifaNow.current === 'praying' && !tripReturn.current) setAfifa('fromPray')
    }, 30000)
    return () => clearInterval(t)
  }, [goPray])

  useEffect(() => { if (entered) setAmbience(night); else startMusic(night) }, [entered, night])
  // piano from the moment the page opens (or the first tap, if the browser insists on one)
  useEffect(() => {
    startMusic(night); unlockAudio()
    const unlock = () => unlockAudio()
    const evs = ['pointerdown', 'keydown', 'touchstart'] as const
    evs.forEach((e) => window.addEventListener(e, unlock, { once: true }))
    return () => evs.forEach((e) => window.removeEventListener(e, unlock))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // the title screen stays on a solid cream veil until the scene's main layers are decoded (no piece-by-piece
  // pop-in), then everything else (night art, poses, clips) preloads quietly so switching modes is instant
  useEffect(() => {
    const decode = (src: string) => { const i = new Image(); i.src = src; return i.decode().catch(() => undefined) }
    const key = [night ? LAYERS.skyNight : LAYERS.sky, night ? LAYERS.farNight : LAYERS.far, LAYERS.meadow, LAYERS.foreground,
      ...items.filter((it) => it.kind === 'terrace' || it.kind === 'tree').map((it) => (night && it.night) || it.src)]
    Promise.all(key.map(decode)).then(() => {
      setSceneReady(true)
      ;[LAYERS.sky, LAYERS.skyNight, LAYERS.far, LAYERS.farNight, ...items.flatMap((it) => [it.src, it.night ?? it.src]),
        ...['afifa-sitting', 'afifa-walking', 'afifa-walking-1', 'afifa-praying', 'parrot-left-on-branch', 'lake-mask'].map(asset),
        '/intro/bar-night.jpg', '/world/particles/firefly-01.webp'].forEach(decode)
      preloadClips(['cat-black-run', 'cat-orange-pounce', 'goat-leap', 'parrot-fly', 'parrot-takeoff', 'afifa-lie-down'])
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // the title screen: one tap unlocks sound (browsers require it), then the haze lifts into the scene
  const enter = () => {
    if (intro !== 'shown') return
    unlockAudio(); loadSounds(); setEntered(true)
    setIntro('leaving')
    window.setTimeout(() => setIntro('gone'), 1700)
  }

  const poke = (id: string, how: 'react' | 'feel' = 'react') => setReact((r) => ({ ...r, [id]: { n: (r[id]?.n ?? 0) + 1, how } }))
  // front-most first; on equal z the later-painted element wins
  const hitAt = (cx: number, cy: number) => [...stage.current!.querySelectorAll<HTMLElement>('[data-hit]')].reverse()
    .sort((a, b) => +b.dataset.z! - +a.dataset.z!).find((el) => el instanceof HTMLImageElement ? opaqueAt(el, cx, cy) : coreAt(el, cx, cy))

  const stagePct = (cx: number, cy: number) => {
    const R = stage.current!.getBoundingClientRect()
    return { px: ((cx - R.left) / R.width) * 100, py: ((cy - R.top) / R.height) * 100 }
  }
  // light fixtures are clickable by their glow (the cafe glass is transparent in the art)
  const lampAt = (cx: number, cy: number) => {
    const { px, py } = stagePct(cx, cy)
    return LAMPS.find((l) => l.hit && px > l.hit[0] && py > l.hit[1] && px < l.hit[2] && py < l.hit[3])
  }
  const layerPt = (el: Element, cx: number, cy: number) => {
    const r = el.getBoundingClientRect()
    return { x: (cx - r.left) / r.width, y: (cy - r.top) / r.height }
  }

  // the pointer is a hand moving through the scene: flowers, leaves and water stir where it passes,
  // and creatures/things flinch once when brushed
  const sense = (cx: number, cy: number) => {
    const hit = hitAt(cx, cy)
    const id = hit?.dataset.hit ?? null, kind = hit?.dataset.kind
    const { px, py } = stagePct(cx, cy)
    let zone: 'flowers' | 'water' | null = null
    if (fgRef.current && opaqueAt(fgRef.current, cx, cy)) zone = 'flowers'
    else if (!hit && farRef.current && opaqueAt(lakeMask, cx, cy, farRef.current, 0) && !(meadowRef.current && opaqueAt(meadowRef.current, cx, cy))) zone = 'water'
    if (zone === 'flowers') { play('flowers', { cooldown: 420, solo: true }); flowerTouch.current = { ...layerPt(fgRef.current!, cx, cy), at: performance.now(), power: 1 } }
    if (zone === 'water') { play('waves', { cooldown: 1800, solo: true }); waterTouch.current = { ...layerPt(farRef.current!, cx, cy), at: performance.now(), power: 1 } }
    // the cafe front (door, window glass, chairs) brews coffee; the sign and A-board have their own sounds
    if ((!hit || kind === 'terrace') && CAFE.some((b) => inBox(px, py, b)) && play('coffee', { cooldown: 7000, solo: true })) burst('steam', 96, 27)
    const over = zone === 'flowers' ? null : id
    // brushed once on the way in; the canopy keeps rustling while the hand moves through it
    const tree = over === 'tree-canopy'
    if (over && over !== 'tree-trunk' && FEEL.has(kind!) && (over !== lastHover.current || tree)
      && Date.now() - (felt.current[over] ?? 0) > (tree ? 1500 : 1200)) {
      (TOGETHER[over] ?? [over]).forEach((t) => { felt.current[t] = Date.now(); poke(t, 'feel') })
      VOICE[kind!]?.(night || !!rest[over])
    }
    lastHover.current = over
    setHover(lampAt(cx, cy) ? 'lamp' : (!hit || kind === 'terrace') && onMat(px, py) ? 'mat' : over && kind !== 'terrace' ? over : null)
  }
  const raf = useRef(0)
  const onMove = (e: React.MouseEvent) => {
    const { clientX: x, clientY: y } = e
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => sense(x, y))
  }

  const toggleNight = () => {
    setDusk(Date.now()); setBubble(-1)
    window.setTimeout(() => setNight((n) => !n), 650)
  }

  const toggleLamps = (group: string) => {
    const on = !lampsOn[group]
    setLampsOn((s) => ({ ...s, [group]: on }))
    click(on)                                                  // the switch itself, both ways
    if (on) { if (group === 'alcove') play('chandelier', { gain: 0.7, delay: 0.05 }); else { play('bell', { gain: 0.8, delay: 0.05 }); burst('steam', 96, 27) } }
  }

  const onClick = (e: React.MouseEvent) => {
    const hit = hitAt(e.clientX, e.clientY), lamp = lampAt(e.clientX, e.clientY)
    { const { px, py } = stagePct(e.clientX, e.clientY); burst('sparkle', px, py) } // a little sparkle wherever you touch
    if (fgRef.current && opaqueAt(fgRef.current, e.clientX, e.clientY)) {
      flowerTouch.current = { ...layerPt(fgRef.current, e.clientX, e.clientY), at: performance.now(), power: 1.8 }
      play('flowers', { solo: true }); return
    }
    if (hit?.dataset.kind === 'lantern') { poke(hit.dataset.hit!); return toggleLamps('alcove') }
    if (lamp && (!hit || hit.dataset.kind === 'terrace')) return toggleLamps(lamp.group)
    if (!hit) return
    const id = hit.dataset.hit!, kind = hit.dataset.kind!
    if (kind === 'afifa') {
      if (afifa === 'praying') { tripReturn.current = true; setBubble(-1); setAfifa('fromPray'); pop() }
      else if (!night && (afifa === 'lying' || afifa === 'sitting')) showBubbles()
      return
    }
    if (kind === 'terrace') {                                // only the light fixtures are switches; the rug invites her to pray
      const { px, py } = stagePct(e.clientX, e.clientY)
      if (onMat(px, py)) { if (afifa === 'praying') { tripReturn.current = true; setBubble(-1); setAfifa('fromPray') } else goPray(true) }
      return
    }
    VOICE[kind]?.(night || !!rest[id])
    if (kind === 'tree') return                             // the tree only moves with the breeze
    if (!clips[id]) (TOGETHER[id] ?? [id]).forEach((t) => poke(t))                                // a small, natural reaction; the big moves happen on their own
  }

  const src = (it: Item) => ((night || rest[it.id]) && it.night ? it.night : it.id === 'parrots' && flap === 1 ? asset('parrot-left-on-branch') : it.src)
  const sprite = (it: Item) => {
    if (it.only && it.only !== (night ? 'night' : 'day')) return null
    if (it.id === 'afifa' && afifa !== 'lying') return null
    const clip = ACTOR_CLIP[it.id]
    if (clip && clips[it.id] && !night && !rest[it.id]) return (
      <Clip key={`${it.id}-${clips[it.id]}`} name={clip.name} x={clip.x} b={clip.b} w={clip.w}
        z={it.z} flip={clip.flip} loops={clip.loops} className={clip.className} onEnd={() => endClip(it.id)} hit={{ id: it.id, kind: it.kind }} />
    )
    const sleeping = (night && ['cat', 'goat', 'parrot', 'afifa'].includes(it.kind)) || !!rest[it.id]
    const r = react[it.id], glow = hover === it.id && !['terrace', 'sign', 'board', 'lantern'].includes(it.kind)
    return (
      <div key={`${it.id}-${sleeping}`} className={`sprite ${it.grounded ? 'grounded' : ''} ${sleeping ? 'asleep' : it.idle ?? ''} ${glow ? 'hover' : ''} ${it.id === 'afifa' || NAPPERS.has(it.id) ? 'fade-in' : ''}`}
        style={{ left: `${it.x}%`, top: `${it.b}%`, width: `${(sleeping && it.sleepW) || it.w}%`, zIndex: it.z, '--d': `${-(it.x % 7) * 0.37}s` } as React.CSSProperties}>
        <div>{/* idle loop */}
          <div key={r?.n ?? 0} className={r ? `${r.how}-${sleeping ? 'stir' : it.kind}` : ''} style={it.pivot ? { transformOrigin: it.pivot } : undefined}>
            <img src={src(it)} alt="" draggable={false} data-hit={it.id} data-kind={it.kind} data-z={it.z}
              style={it.flip || it.rot ? { transform: `${it.flip ? 'scaleX(-1)' : ''} ${it.rot ? `rotate(${it.rot}deg)` : ''}` } : undefined} />
          </div>
        </div>
        {night && it.kind === 'afifa' && <span className="zzz">z<b>z</b><i>z</i></span>}
      </div>
    )
  }

  // Afifa's non-lying states
  const pose = (name: string, p: { x: number; b: number; w: number }, z: number, cls = '', flip = false) => (
    <div className={`sprite ${cls}`} style={{ left: `${p.x}%`, top: `${p.b}%`, width: `${p.w}%`, zIndex: z }}>
      <img src={asset(name)} alt="" draggable={false} data-hit="afifa" data-kind="afifa" data-z={z}
        style={flip ? { transform: 'scaleX(-1)' } : undefined} />
    </div>
  )
  const afifaView = () => {
    if (afifa === 'sittingUp') return <Clip name="afifa-lie-down" {...LIE_DOWN} z={Z.actors} flip reverse fps={10} className="scoot-up" onEnd={() => { setAfifa('sitting'); if (!greeted.current) { greeted.current = true; showBubbles() } }} />
    if (afifa === 'lyingDown') return <Clip name="afifa-lie-down" {...LIE_DOWN} z={Z.actors} flip fps={10} className="scoot-down"
      onEnd={() => setAfifa('lying')} />
    if (afifa === 'sitting') return pose('afifa-sitting', SIT, Z.actors, `grounded breathe ${backFromPrayer.current ? 'fade-in' : ''}`, true)
    if (afifa === 'toPray') return pose('afifa-walking', { x: 39, b: 76, w: 12 }, Z.actors, 'walk-to-pray')
    if (afifa === 'praying') return pose('afifa-praying', PRAYING, Z.onTerrace, 'breathe fade-in')
    if (afifa === 'fromPray') return pose('afifa-walking-1', { x: 61, b: 36.5, w: 8.4 }, Z.onTerrace, 'walk-from-pray', true)
    return null
  }

  return (
    <div className={`viewport ${portrait ? 'portrait' : ''} ${night ? 'night' : 'day'}`}>
     <div className="frame" style={{ '--s': scale } as React.CSSProperties}>
      {!portrait && ['day', 'night'].map((m) => (
        // blurred copy of the scene behind everything, plus its own left/right edges mirrored outward from the seams
        <div key={m} className={`backdrop ${m} ${night === (m === 'night') ? 'on' : ''}`}>
          {ox > 0 && <><i className="side left" style={{ width: ox + 2 }} /><i className="side right" style={{ width: ox + 2 }} /></>}
        </div>
      ))}
      <div className="stage-box" style={portrait ? { width: W * scale, height: H * scale } : { left: ox, top: oy, width: W * scale, height: H * scale }}>
      <div ref={stage} className={`stage ${night ? 'night' : 'day'} ${hover ? 'pointing' : ''}`}
        onClick={entered ? onClick : undefined} onMouseMove={entered ? onMove : undefined}
        style={{ width: W, height: H, transform: `scale(${scale})` }}>
        <img className="layer" src={night ? LAYERS.skyNight : LAYERS.sky} alt="" style={{ zIndex: Z.sky }} />
        <img className="layer tint" src={LAYERS.meadow} alt="" style={{ zIndex: Z.sky, top: '-10%' }} />
        <img ref={farRef} className="layer" src={night ? LAYERS.farNight : LAYERS.far} alt=""
          style={{ zIndex: Z.far, top: '-21%', visibility: glFar ? 'hidden' : undefined }} />
        {GL_OK && <GLLayer day={LAYERS.far} nightSrc={LAYERS.farNight} mask={asset('lake-mask')} night={night} touch={waterTouch} onReady={setGlFar}
          style={{ zIndex: Z.far, top: '-21%' }} />}
        <img ref={meadowRef} className="layer tint" src={LAYERS.meadow} alt="" style={{ zIndex: Z.meadow, top: '3%' }} />
        <div className="breeze" style={{ zIndex: Z.meadow }} />

        {items.map(sprite)}
        {afifaView()}

        {flap > 0 && (
          <Clip key={`flap-${flap}`} name="parrot-takeoff" {...PARROT_SPOT} z={Z.tree + 3} from={0} to={6} pingpong loops={2} fps={10}
            className={flap === 2 ? 'fade-out' : 'fade-in'}
            onEnd={() => { setFlap(2); window.setTimeout(() => setFlap(0), 500) }} />
        )}
        {flyby > 0 && !night && (
          <Clip key={flyby} name="parrot-fly" x={0} b={0} w={6} z={Z.tree + 3} loops={3} fps={14} flip={flyby % 2 === 0}
            className={flyby % 2 === 0 ? 'flyby-rl' : 'flyby-lr'} onEnd={() => setFlyby(0)} />
        )}
        {fx.map((e) => (
          <div key={e.id} className={`burst ${e.kind}`} style={{ left: `${e.x}%`, top: `${e.y}%`, zIndex: Z.fx }}>
            {Array.from({ length: e.kind === 'sparkle' ? 9 : 4 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}
          </div>
        ))}

        {/* lights: a warm glow when on; when off, the painted lamp is dimmed so the switch reads in daylight too */}
        {LAMPS.map((l) => (
          <div key={l.id} className={`lamp ${lampsOn[l.group] ? 'on' : 'off'}`}
            style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.r}%`, zIndex: Z.terrace }} />
        ))}
        {night && NIGHT_LIGHTS.map((l, i) => (!l.group || lampsOn[l.group]) && (
          <div key={i} className="lamp on extra" style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.r}%`, zIndex: Z.onTerrace, animationDelay: `${-i * 0.7}s` }} />
        ))}
        {night && <div className="moonlight" style={{ zIndex: Z.fx - 1 }} />}

        <div className="layer lean" style={{ zIndex: Z.foreground, top: '10%' }}>
          <img ref={fgRef} className="layer tint" src={LAYERS.foreground} alt="" style={glFg ? { visibility: 'hidden' } : undefined} />
          {GL_OK && <GLLayer day={LAYERS.foreground} night={night} touch={flowerTouch} onReady={setGlFg} />}
        </div>
        <Particles night={night} />

        {bubble >= 0 && (afifa === 'praying' || (!night && (afifa === 'lying' || afifa === 'sitting' || afifa === 'sittingUp'))) && (
          <div key={bubble} className="bubble"
            style={{ zIndex: Z.fx + 1, ...HEAD[afifa === 'praying' ? 'praying' : afifa === 'lying' ? 'lying' : 'sitting'] } as React.CSSProperties}>
            {(afifa === 'praying' ? PRAYER_BUBBLES : BUBBLES)[bubble]}
          </div>
        )}
        {dusk > 0 && <div key={dusk} className="dusk" style={{ zIndex: Z.fx + 5 }} />}
        {intro !== 'gone' && (
          <div className={`intro ${intro} ${sceneReady ? '' : 'veiled'}`} style={{ zIndex: Z.fx + 10 }} onClick={enter}>
            <div className="intro-halo" />
            <img className="intro-title" src="/intro/title.webp" alt="The Retirement Retreat" draggable={false} />
            <p className="intro-tap">tap anywhere to enter</p>
          </div>
        )}
      </div>
      </div>

      <nav className={`navbar ${night ? 'night' : ''}`}>
        <button onClick={toggleNight} aria-label={night ? 'Switch to day' : 'Switch to night'} title={night ? 'Day' : 'Night'}>
          <img src={night ? '/icons/sun.svg' : '/icons/moon.svg'} alt="" />
        </button>
        <button onClick={() => { setMute((m) => !m); setMuted(!muted) }} aria-label={muted ? 'Turn sound on' : 'Mute sound'} title={muted ? 'Sound on' : 'Mute'}>
          <img src={muted ? '/icons/sound-off.svg' : '/icons/sound-on.svg'} alt="" />
        </button>
      </nav>
     </div>
    </div>
  )
}

// falling petals by day, drifting fireflies by night
function Particles({ night }: { night: boolean }) {
  const n = night ? 32 : 72
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <img key={`${night}-${i}`} className={night ? 'firefly' : 'petal'} alt=""
          src={night ? '/world/particles/firefly-01.webp' : `/world/particles/petal-rose-pink-0${(i % 9) + 1}.webp`}
          style={{ zIndex: Z.fx, left: `${(i * 37 + (i >> 2) * 11) % 105}%`, top: night ? `${30 + ((i * 23) % 62)}%` : '-5%',
            width: night ? `${0.9 + (i % 3) * 0.35}%` : undefined,
            animationDelay: `${-i * (night ? 1.1 : 0.85)}s`, animationDuration: `${night ? 5 + (i % 5) : 15 + (i % 8) * 2.4}s` }} />
      ))}
    </>
  )
}
