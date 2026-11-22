// Recorded Freesound CC0 sounds (public/sfx, listed in sfx.json; sources and licences in public/sfx/sources.json),
// mixed on three buses: one-shot effects, nature ambience and a soft music bed.

let ctx: AudioContext | null = null
let master: GainNode, fxBus: GainNode, ambBus: GainNode, musicBus: GainNode
const ac = () => {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination)
    fxBus = ctx.createGain(); fxBus.gain.value = 1; fxBus.connect(master)
    ambBus = ctx.createGain(); ambBus.gain.value = 0.55; ambBus.connect(master)
    musicBus = ctx.createGain(); musicBus.gain.value = 0.18; musicBus.connect(master)
  }
  return ctx
}

export const unlockAudio = () => ac().resume()
export const setMuted = (m: boolean) => { ac(); master.gain.setTargetAtTime(m ? 0 : 0.9, ctx!.currentTime, 0.1) }

// ---- sample bank ----
const bank: Record<string, AudioBuffer[]> = {}
let loading: Promise<void> | null = null
const LOOPED = /^(ambience|music|breeze|lake)/
const loadCat = async ([cat, files]: [string, string[]]) => {
  bank[cat] = await Promise.all(files.map((f) => fetch(`/sfx/${f}`).then((r) => r.arrayBuffer()).then((b) => ac().decodeAudioData(b))))
}
// one track per loop (picked at random) so only one long file per category downloads; the piano comes first,
// then the short touch sounds (needed the moment you hover), then the other loops
let listP: Promise<[string, string[]][]> | null = null, musicP: Promise<void> | null = null
const list = () => (listP ??= fetch('/sfx/sfx.json').then((r) => r.json()).then((l: Record<string, string[]>) =>
  Object.entries(l).map(([c, f]): [string, string[]] => [c, LOOPED.test(c) ? [f[Math.floor(Math.random() * f.length)]] : f])))
const loadMusic = () => (musicP ??= list().then((all) => Promise.all(all.filter(([c]) => c === 'music').map(loadCat))).then(() => undefined))
export const loadSounds = () => (loading ??= loadMusic().then(list).then(async (all) => {
  await Promise.all(all.filter(([c]) => !LOOPED.test(c)).map(loadCat))
  await Promise.all(all.filter(([c]) => LOOPED.test(c) && c !== 'music').map(loadCat))
}))

// per-category level, so the mix stays cohesive (files are already loudness-matched)
const LEVEL: Record<string, number> = {
  flowers: 0.45, leaves: 0.5, waves: 0.55, tap: 0.45, goat: 0.55, cat: 0.6, parrot: 0.72,
  chandelier: 0.5, 'sign-creak': 0.45, coffee: 0.5, bell: 0.45,
}
const lastAt: Record<string, number> = {}, lastPick: Record<string, number> = {}
// hover voices are "solo": a new one gently cuts the previous, so brushing across neighbours never piles sounds up
let soloVoices: GainNode[] = []

/** Play a random variant of a category. cooldown (ms) keeps hover sounds from machine-gunning. */
export function play(cat: string, { gain = 1, delay = 0, cooldown = 0, rate = 1, solo = false, join = false } = {}) {
  const bufs = bank[cat]
  if (!ctx || !bufs?.length) return false
  const now = performance.now()
  if (now - (lastAt[cat] ?? -1e9) < cooldown) return false
  lastAt[cat] = now
  let i = Math.floor(Math.random() * bufs.length)
  if (bufs.length > 1 && i === lastPick[cat]) i = (i + 1) % bufs.length   // never the same take twice in a row
  lastPick[cat] = i
  const s = ctx.createBufferSource(), g = ctx.createGain()
  s.buffer = bufs[i]
  s.playbackRate.value = rate * (0.95 + Math.random() * 0.1)                // a little natural variation
  g.gain.value = (LEVEL[cat] ?? 0.5) * gain
  s.connect(g).connect(fxBus)
  if (solo) { soloVoices.forEach((v) => v.gain.setTargetAtTime(0, ctx!.currentTime, 0.04)); soloVoices = [] }
  if (solo || join) soloVoices.push(g)
  s.start(ctx.currentTime + delay)
  return true
}

// light switch: a short noise snap plus a tick, a touch brighter when switching on
export function click(on: boolean) {
  const c = ac(), t = c.currentTime
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.02), c.sampleRate), d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.002))
  const n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain()
  n.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = on ? 3200 : 2400; bp.Q.value = 1.2; g.gain.value = 0.5
  n.connect(bp).connect(g).connect(fxBus); n.start(t)
  const o = c.createOscillator(), og = c.createGain()
  o.frequency.value = on ? 1800 : 1300
  og.gain.setValueAtTime(0.05, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
  o.connect(og).connect(fxBus); o.start(t); o.stop(t + 0.05)
}

// tiny synthesized pop for UI moments that have no natural sound
export function pop() {
  const c = ac(), t = c.currentTime, o = c.createOscillator(), g = c.createGain()
  o.frequency.value = 660
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
  o.connect(g).connect(fxBus); o.start(t); o.stop(t + 0.2)
}

// ---- loops: ambience (day/night) and music, crossfaded ----
const loops: Record<string, { src: AudioBufferSourceNode; gain: GainNode }> = {}
function loop(cat: string, bus: GainNode, level: number) {
  const c = ac(), bufs = bank[cat]
  if (!bufs?.length) return
  let l = loops[cat]
  if (!l) {
    const src = c.createBufferSource(), gain = c.createGain()
    src.buffer = bufs[Math.floor(Math.random() * bufs.length)]; src.loop = true
    gain.gain.value = 0.0001
    src.connect(gain).connect(bus)
    src.start(c.currentTime, Math.random() * src.buffer.duration)        // start somewhere in the loop
    l = loops[cat] = { src, gain }
  }
  l.gain.gain.setTargetAtTime(Math.max(level, 0.0001), c.currentTime, 1.2)  // slow, natural crossfade
}

export async function setAmbience(night: boolean) {
  await loadSounds()
  loop('ambience-day', ambBus, night ? 0 : 1)
  loop('music', musicBus, night ? 0 : 1)                              // the piano rests at night; crickets take over
  musicBus.gain.setTargetAtTime(night ? 0 : 0.18, ctx!.currentTime, 0.8)
  loop('ambience-night', ambBus, night ? 1 : 0)
  loop('breeze', ambBus, night ? 0.2 : 0.28)
  loop('lake', ambBus, night ? 0.3 : 0.6)                             // soft lapping from the lake below
}

// the piano starts the moment the page opens; if the browser holds sound back until the first tap,
// it is already queued and simply begins with that tap (by day; at night it rests)
export async function startMusic(night: boolean) {
  await loadMusic()
  loop('music', musicBus, night ? 0 : 1)
  musicBus.gain.setTargetAtTime(night ? 0 : 0.18, ctx!.currentTime, 0.8)
}

// dev hot-reload: silence the old engine (its loops would keep playing) and reload, since the scene's audio
// state (bank, loops, unlocked context) lives in this module
import.meta.hot?.dispose(() => { ctx?.close() })
import.meta.hot?.accept(() => location.reload())
