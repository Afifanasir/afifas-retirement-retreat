import { useEffect, useRef } from 'react'

// One painted layer drawn by a tiny WebGL shader, so the breeze, the hand's touch and the day/night change all run
// on the GPU, equally smooth in Chrome and Safari (SVG displacement filters are CPU-bound in Safari).
//   flowers: noise-driven sway + a shiver around the pointer + the day/night colour grade
//   water:   a calm shimmer + rings spreading from the pointer, only where the lake mask is white

export type Touch = { x: number; y: number; at: number; power: number } // x, y: 0..1 of the layer box
export const GL_OK = (() => { try { return !!document.createElement('canvas').getContext('webgl') } catch { return false } })()

const VERT = `attribute vec2 p; varying vec2 uv;
void main() { uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`

const FRAG = `precision mediump float;
varying vec2 uv;
uniform sampler2D tDay, tNight, tMask;
uniform float t, nightMix, amt, water, aspect;
uniform vec2 touch;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y); }
void main() {
  vec2 q = (uv - touch) * vec2(aspect, 1.);
  float r = length(q);
  vec2 d;
  vec2 px = vec2(1. / 1448., 1. / 1086.);
  if (water < .5) {
    // breeze: a fixed noise field whose strength swings back and forth, so each stem bends and returns
    // rather than flowing (same feel as the earlier SVG version, a touch stronger)
    vec2 f = vec2(n(uv * vec2(17., 33.)), n(uv * vec2(17., 33.) + 19.7)) - .5;
    float swing = 4.6 * sin(t * .97) + 1.7 * sin(t * 1.93 + 1.);
    d = f * swing * 1.15 * px;
    // the hand: a quick shiver (±6px) in a soft circle around the pointer
    vec2 g = vec2(n(uv * vec2(50., 38.)), n(uv * vec2(50., 38.) + 7.3)) - .5;
    d += g * 12. * sin(t * 10.5) * smoothstep(.13, .045, r) * amt * px;
  } else {
    float m = texture2D(tMask, uv).r;
    float ring = sin(r * 150. - t * 8.) * smoothstep(.13, 0., r) * amt;              // rings spreading from the hand
    d = vec2(ring * .0012, ring * .0034) * m;
  }
  vec4 c = mix(texture2D(tDay, uv + d), texture2D(tNight, uv + d), nightMix);
  if (water < .5) {   // grade (premultiplied colour): day = softly desaturated warm, night = dim and cool
    float l = dot(c.rgb, vec3(.299, .587, .114));
    vec3 day = mix(vec3(l), c.rgb, .82) * .95;
    day = mix(day, vec3(dot(day, vec3(.393, .769, .189)), dot(day, vec3(.349, .686, .168)), dot(day, vec3(.272, .534, .131))), .08);
    vec3 nt = mix(vec3(l), c.rgb, .75) * .42 * vec3(.94, .97, 1.1);
    c.rgb = mix(day, nt, nightMix);
  }
  gl_FragColor = c;
}`

// never hangs: a failed download retries once (cache-busted), then gives up so the plain <img> stays in charge
const load = (src: string, retry = true): Promise<HTMLImageElement> => new Promise((ok, fail) => {
  const i = new Image()
  i.onload = () => ok(i)
  i.onerror = () => (retry ? load(`${src}${src.includes('?') ? '&' : '?'}r=${Date.now()}`, false).then(ok, fail) : fail(new Error(`texture ${src}`)))
  i.src = src
})

// onReady(true) after the first frame is on screen (the page can then hide its plain <img>);
// onReady(false) if textures fail or the browser drops the GL context (the plain <img> shows again)
export function GLLayer({ day, nightSrc, mask, night, touch, style, onReady }: {
  day: string; nightSrc?: string; mask?: string; night: boolean
  touch: React.MutableRefObject<Touch | null>; style?: React.CSSProperties; onReady?: (ok: boolean) => void
}) {
  const cv = useRef<HTMLCanvasElement>(null)
  const nightRef = useRef(night)
  nightRef.current = night
  useEffect(() => {
    const canvas = cv.current!, gl = canvas.getContext('webgl', { premultipliedAlpha: true })
    if (!gl) { onReady?.(false); return }
    let raf = 0, alive = true
    const lost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); onReady?.(false) }
    canvas.addEventListener('webglcontextlost', lost)
    Promise.all([day, nightSrc ?? day, mask ?? day].map((s) => load(s))).then(([a, b, m]) => {
      if (!alive) return
      canvas.width = a.naturalWidth; canvas.height = a.naturalHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error('GLLayer shader:', gl.getShaderInfoLog(s))
        return s
      }
      const prog = gl.createProgram()!
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(prog); gl.useProgram(prog)
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      ;[a, b, m].forEach((img, i) => {
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
        ;[gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((w) => gl.texParameteri(gl.TEXTURE_2D, w, gl.CLAMP_TO_EDGE))
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      })
      const u = (k: string) => gl.getUniformLocation(prog, k)
      gl.uniform1i(u('tDay'), 0); gl.uniform1i(u('tNight'), 1); gl.uniform1i(u('tMask'), 2)
      gl.uniform1f(u('water'), mask ? 1 : 0); gl.uniform1f(u('aspect'), a.naturalWidth / a.naturalHeight)
      const ut = u('t'), un = u('nightMix'), ua = u('amt'), up = u('touch')
      let nm = nightRef.current ? 1 : 0, amt = 0, tx = 0.5, ty = 0.5
      const frame = (now: number) => {
        // ease everything per frame, so the hand's touch and the day/night change glide rather than jump
        nm += ((nightRef.current ? 1 : 0) - nm) * 0.04
        const tc = touch.current, target = tc ? tc.power * Math.max(0, 1 - (now - tc.at) / 700) : 0
        amt += (target - amt) * 0.12
        if (tc) { tx += (tc.x - tx) * 0.25; ty += (tc.y - ty) * 0.25 }
        gl.uniform1f(ut, now / 1000); gl.uniform1f(un, nm); gl.uniform1f(ua, amt); gl.uniform2f(up, tx, ty)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        if (first) { first = false; onReady?.(true) }
        raf = requestAnimationFrame(frame)
      }
      let first = true
      raf = requestAnimationFrame(frame)
    }, () => { if (alive) onReady?.(false) })
    return () => { alive = false; cancelAnimationFrame(raf); canvas.removeEventListener('webglcontextlost', lost) }
  }, [day, nightSrc, mask, touch])
  return <canvas ref={cv} className="layer" style={style} />
}
