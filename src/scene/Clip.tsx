import { useEffect, useRef, useState } from 'react'

// Sprite-sheet player for the keyed Higgsfield clips (public/world/clips/*.webp + .json).
type Meta = { frames: number; cols: number; fw: number; fh: number }
const metaCache: Record<string, Promise<Meta>> = {}
const load = (name: string) => (metaCache[name] ??= fetch(`/world/clips/${name}.json`).then((r) => r.json()))
export const preloadClips = (names: string[]) => names.forEach((n) => { load(n); new Image().src = `/world/clips/${n}.webp` })

export type ClipProps = {
  name: string; x: number; b: number; w: number; z: number
  flip?: boolean; fps?: number; loops?: number
  from?: number; to?: number   // frame range (inclusive); default whole clip
  reverse?: boolean            // play the range backwards
  pingpong?: boolean           // play the range, then back again
  onEnd?: () => void           // the last frame stays on screen until the parent unmounts the clip
  style?: React.CSSProperties; className?: string
  hit?: { id: string; kind: string } // keeps the actor touchable while its clip plays
}

export function Clip({ name, x, b, w, z, flip, fps = 12, loops = 1, from = 0, to, reverse, pingpong, onEnd, style, className, hit }: ClipProps) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [f, setF] = useState(-1)
  const end = useRef(onEnd)
  end.current = onEnd
  useEffect(() => { load(name).then(setMeta) }, [name])
  useEffect(() => {
    if (!meta) return
    const last = Math.min(to ?? meta.frames - 1, meta.frames - 1)
    let seq = Array.from({ length: last - from + 1 }, (_, i) => from + i)
    if (reverse) seq.reverse()
    if (pingpong) seq = [...seq, ...seq.slice(0, -1).reverse()]
    seq = Array.from({ length: loops }, () => seq).flat()
    let i = 0
    setF(seq[0])
    const t = window.setInterval(() => {
      i++
      if (i >= seq.length) { clearInterval(t); end.current?.(); return }
      setF(seq[i])
    }, 1000 / fps)
    return () => clearInterval(t)
  }, [meta, fps, loops, from, to, reverse, pingpong])
  if (!meta || f < 0) return null
  const rows = Math.ceil(meta.frames / meta.cols)
  return (
    <div className={`sprite clip ${className ?? ''}`} data-hit={hit?.id} data-kind={hit?.kind} data-z={z}
      style={{ left: `${x}%`, top: `${b}%`, width: `${w}%`, zIndex: z, aspectRatio: `${meta.fw} / ${meta.fh}`, ...style }}>
      <div style={{
        width: '100%', height: '100%', transform: flip ? 'scaleX(-1)' : undefined,
        backgroundImage: `url(/world/clips/${name}.webp)`, backgroundSize: `${meta.cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${((f % meta.cols) / Math.max(1, meta.cols - 1)) * 100}% ${(Math.floor(f / meta.cols) / Math.max(1, rows - 1)) * 100}%`,
      }} />
    </div>
  )
}
