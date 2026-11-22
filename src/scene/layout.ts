// Scene built from the user's generated layers (public/world). Positions are % of the 1440x1080 stage:
// x = left edge, b = bottom edge, w = width; height follows the image's aspect ratio.

export type Kind = 'tree' | 'cat' | 'goat' | 'parrot' | 'afifa' | 'easel' | 'prop' | 'terrace' | 'sign' | 'board' | 'lantern'
export type Item = {
  id: string; src: string; x: number; b: number; w: number; z: number
  kind: Kind; idle?: string; night?: string; flip?: boolean; grounded?: boolean
  only?: 'day' | 'night'; rot?: number // rot: degrees about the image centre
  pivot?: string // transform-origin for touch/click moves (default: bottom centre)
  sleepW?: number // width while asleep, when the sleeping art is framed differently from the awake pose
}

export const W = (name: string) => `/world/${name}.webp`
const at = (id: string, name: string, x: number, b: number, w: number, z: number, kind: Kind, extra: Partial<Item> = {}): Item =>
  ({ id, src: W(name), x, b, w, z, kind, ...extra, night: extra.night && W(extra.night) })

export const LAYERS = {
  sky: W('sky-day'), skyNight: W('sky-night'), far: W('far-day'), farNight: W('far-night'),
  // night versions are baked (not a CSS filter): Safari doesn't paint filters on these full-scene layers
  meadow: W('meadow'), meadowNight: W('meadow-night'), foreground: W('foreground'), foregroundNight: W('foreground-night'),
}

export const Z = { sky: 0, far: 1, terrace: 2, onTerrace: 3, meadow: 4, actors: 10, tree: 20, foreground: 30, fx: 40 }

// idle = CSS animation class (see index.css); every loop uses a different duration so nothing moves in lockstep
export const items: Item[] = [
  // night versions of terrace + far are generated from the day art, so placement is identical in both modes
  at('terrace', 'terrace-day', 44, 60, 67, Z.terrace, 'terrace', { night: 'terrace-night' }),

  at('tree-trunk', 'tree-trunk', -10, 60, 52, Z.tree, 'tree'),
  at('tree-canopy', 'tree-canopy', -6, 40, 52, Z.tree + 1, 'tree', { idle: 'sway', pivot: '8% 100%' }),
  // parrots trimmed to their perch; perch matched in angle (-11°) and thickness to the tree's upper branch
  at('parrots', 'parrots-on-branch', 8.5, 31.0, 7.74, Z.tree + 2, 'parrot', { idle: 'bob', only: 'day' }),
  at('parrots-asleep', 'parrots-sleeping-on-branch', 9.2, 29.82, 6.36, Z.tree + 2, 'parrot', { only: 'night', rot: -10.5 }),

  // cafe sign, A-board and alcove lantern cut from the terrace art (same pixels, same spot) so they can swing when touched;
  // they share the terrace's layer, so the lamp glow / switched-off dimming falls on them like on the rest of the wall
  at('cafe-sign', 'cafe-sign', 80.12, 18.07, 4.72, Z.terrace, 'sign', { night: 'cafe-sign-night', pivot: '50% 0' }),
  at('alcove-lantern', 'alcove-lantern', 67.45, 22.58, 2.38, Z.terrace, 'lantern', { night: 'alcove-lantern-night', pivot: '50% 0' }),
  at('cafe-board', 'cafe-board', 84.98, 37.06, 4.34, Z.terrace, 'board', { night: 'cafe-board-night' }),

  at('easel', 'easel', 59, 71, 10.5, Z.actors - 1, 'easel'),
  at('stool', 'painting-stool', 52, 67, 5.5, Z.actors - 1, 'easel', { grounded: true }),
  at('brush-mug', 'painting-supply', 52.8, 58.5, 2.6, Z.actors - 1, 'easel', { pivot: '75% 289%' }), // pivots at the stool's foot, so mug + stool move as one
  at('paint-box', 'painting-supply-2', 70, 73, 7, Z.actors - 1, 'prop', { grounded: true }),

  at('afifa', 'afifa-lying', 30, 75.5, 34, Z.actors, 'afifa', { grounded: true, idle: 'breathe', night: 'afifa-lying' }),
  // the two cats share the open grass in front of the paint box, by Afifa's feet, so they play (and nap) together
  at('cat-orange', 'orange-cat-playing', 71.5, 80, 5.8, Z.actors + 1, 'cat', { grounded: true, idle: 'play-a', night: 'orange-cat-sleeping', sleepW: 7.6 }),
  at('cat-black', 'black-cat-playing', 63.5, 79.5, 5.5, Z.actors + 2, 'cat', { grounded: true, flip: true, idle: 'play-b', night: 'black-cat-sleeping' }),

  at('goat-1', 'goat-grazing', 14.5, 70, 8.5, Z.actors - 1, 'goat', { grounded: true, idle: 'graze-a', night: 'goats-sitting' }),
  at('goat-2', 'goat-standing', 28, 62, 7, Z.actors - 3, 'goat', { grounded: true, idle: 'hop', night: 'goats-sleeping' }),
  at('goat-3', 'goat-grazing-2', 46, 60, 5.5, Z.actors - 4, 'goat', { grounded: true, flip: true, idle: 'graze-b', night: 'goats-sitting-2' }),
  at('goat-4', 'goat-grazing', 71, 62.5, 7, Z.actors - 3, 'goat', { grounded: true, flip: true, idle: 'graze-c', night: 'goats-sitting' }),
  at('goat-5', 'goats-sitting', 84, 62, 6.5, Z.actors - 3, 'goat', { grounded: true, idle: 'breathe' }),
  at('goat-6', 'goats-sitting-2', 54, 53, 5.5, Z.actors - 4, 'goat', { grounded: true, idle: 'breathe' }),
]

// Afifa at the namaz spot (on the alcove rug) during prayer times
// centred on the alcove rug (rug spans terrace-image x 22-42%, y 55-61% -> stage centre x 65.4%, mid-line y 35.9%)
export const PRAYING = { x: 62.4, b: 36.2, w: 6 }

// Afifa's poses (stage %), all registered against her lie-down clip so swaps are seamless
export const SIT = { x: 33.82, b: 76.06, w: 20.64 } // sitting still, flipped (clip frame 0, after she scoots 3% toward the centre)

// Lights that toggle by group (stage %; r = glow size). Positions read off the terrace art:
// stage x = 44 + 0.67 * image-x%, stage y = 0.6 * image-y%.
// hit = the fixture's own outline [x0, y0, x1, y1] (stage %), measured off the terrace art, so only the lamp itself
// is a switch; the alcove's hanging lantern is its own cut-out sprite (hit-tested by its pixels), so it has no box
export const LAMPS: { id: string; group: string; x: number; y: number; r: number; pool?: boolean; hit?: [number, number, number, number] }[] = [
  { id: 'alcove-lantern', group: 'alcove', x: 68.1, y: 18.5, r: 9 },
  { id: 'alcove-shelf', group: 'alcove', x: 75.6, y: 26, r: 6, hit: [74.9, 23.6, 77.2, 27.8] },
  { id: 'alcove-rug', group: 'alcove', x: 65.5, y: 30, r: 14, pool: true }, // the warm pool the lantern throws (not a fixture)
  { id: 'cafe-sconce', group: 'cafe', x: 88.2, y: 16.5, r: 7, hit: [87.4, 15.3, 89.2, 20.8] },
  { id: 'cafe-window', group: 'cafe', x: 94.5, y: 24, r: 14, hit: [93.1, 14.8, 100, 26.4] },
]
// extra warm points that only exist at night (stair lanterns, pot lights, easel candle); group = switched with those lamps
export const NIGHT_LIGHTS: { x: number; y: number; r: number; group?: string }[] = [
  { x: 91, y: 44, r: 5, group: 'cafe' }, { x: 95, y: 50, r: 5, group: 'cafe' }, { x: 98.5, y: 56, r: 5, group: 'cafe' },
  { x: 82, y: 33, r: 10, group: 'alcove' }, { x: 58.5, y: 33, r: 6, group: 'alcove' }, { x: 71.5, y: 63, r: 6 },
]
