// Point-cloud "sculptures". Every shape has exactly N points so the shader can morph
// point i of one shape into point i of the next. Objects are built procedurally from
// primitives (edges, faces, rings), the hero is sampled from the fresco, and the
// prologue's byte is sampled from text drawn on a 2D canvas.
import type { ShapeId } from '../content/storage'
import { BITS, type TextMask } from './textmasks'

export const TONE = { base: 0, acid: 1, infra: 2, uv: 3, dust: 4, iris: 5, skin: 6, metal: 7, vapor: 8, image: 9 } as const

export interface Shape {
  id: ShapeId
  /** N × xyz, roughly inside a unit sphere (the hero is 2 units wide). */
  pos: Float32Array
  /** N tones: integer part = palette slot, fraction = a parameter (iris hue). */
  tone: Float32Array
  /** N × rgb in 0..1, only for points whose tone is IMAGE. */
  rgb?: Float32Array
  /** Gap between the fingertips, in shape space (hero only). */
  gap?: [number, number, number]
  /** N light levels 0..1, baked from surface normals (hero only). */
  shade?: Float32Array
  /** Vertical extent of the figure (hero only), in shape units. */
  bounds?: [number, number]
  /** Point alpha and size multipliers for this shape. */
  alpha: number
  size: number
}

type V3 = [number, number, number]
type P = [number, number, number, number]
type Gen = () => P | null
interface Part {
  w: number
  gen: Gen
}

export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Primitive samplers bound to one random source. Each returns one point per call. */
function kit(R: () => number) {
  const j = (a: number) => (R() - 0.5) * a
  const between = (a: number, b: number) => a + (b - a) * R()

  const pickWeighted = <T>(items: { w: number; v: T }[]) => {
    const total = items.reduce((s, i) => s + i.w, 0)
    return () => {
      let r = R() * total
      for (const it of items) {
        r -= it.w
        if (r <= 0) return it.v
      }
      return items[items.length - 1].v
    }
  }

  const seg = (a: V3, b: V3, tone: number, jit = 0.006, dash = 0): Gen => () => {
    const t = R()
    if (dash && (t * dash) % 1 > 0.55) return null
    return [
      a[0] + (b[0] - a[0]) * t + j(jit),
      a[1] + (b[1] - a[1]) * t + j(jit),
      a[2] + (b[2] - a[2]) * t + j(jit),
      tone,
    ]
  }

  const poly = (pts: V3[], tone: number, jit = 0.006, closed = true): Gen => {
    const segs: { w: number; v: Gen }[] = []
    const n = closed ? pts.length : pts.length - 1
    for (let i = 0; i < n; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      segs.push({ w: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), v: seg(a, b, tone, jit) })
    }
    const pick = pickWeighted(segs)
    return () => pick()()
  }

  const rectXY = (x0: number, x1: number, y0: number, y1: number, z: number, tone: number, reject?: (x: number, y: number) => boolean): Gen => () => {
    const x = between(x0, x1)
    const y = between(y0, y1)
    if (reject?.(x, y)) return null
    return [x, y, z + j(0.003), tone]
  }

  const rectXZ = (x0: number, x1: number, z0: number, z1: number, y: number, tone: number, reject?: (x: number, z: number) => boolean): Gen => () => {
    const x = between(x0, x1)
    const z = between(z0, z1)
    if (reject?.(x, z)) return null
    return [x, y + j(0.003), z, tone]
  }

  const rectYZ = (y0: number, y1: number, z0: number, z1: number, x: number, tone: number): Gen => () => [x + j(0.003), between(y0, y1), between(z0, z1), tone]

  const boxEdges = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tone: number, jit = 0.006): Gen => {
    const c: V3[] = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ]
    const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
    const pick = pickWeighted(
      e.map(([a, b]) => ({
        w: Math.hypot(c[b][0] - c[a][0], c[b][1] - c[a][1], c[b][2] - c[a][2]) + 1e-4,
        v: seg(c[a], c[b], tone, jit),
      })),
    )
    return () => pick()()
  }

  /** Faces of a box; `skip` lists faces to leave open: px nx py ny pz nz. */
  const boxFaces = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tone: number, skip = ''): Gen => {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0
    const faces: { w: number; v: Gen }[] = []
    if (!skip.includes('px')) faces.push({ w: dy * dz, v: rectYZ(y0, y1, z0, z1, x1, tone) })
    if (!skip.includes('nx')) faces.push({ w: dy * dz, v: rectYZ(y0, y1, z0, z1, x0, tone) })
    if (!skip.includes('py')) faces.push({ w: dx * dz, v: rectXZ(x0, x1, z0, z1, y1, tone) })
    if (!skip.includes('ny')) faces.push({ w: dx * dz, v: rectXZ(x0, x1, z0, z1, y0, tone) })
    if (!skip.includes('pz')) faces.push({ w: dx * dy, v: rectXY(x0, x1, y0, y1, z1, tone) })
    if (!skip.includes('nz')) faces.push({ w: dx * dy, v: rectXY(x0, x1, y0, y1, z0, tone) })
    const pick = pickWeighted(faces)
    return () => pick()()
  }

  /** Uniform-area ring. `quant` snaps a share of points onto tracks. */
  const annulus = (c: V3, rIn: number, rOut: number, plane: 'xy' | 'xz', tone: (r: number, a: number) => number, quant = 0, quantShare = 0): Gen => () => {
    let r = Math.sqrt(rIn * rIn + R() * (rOut * rOut - rIn * rIn))
    if (quant && R() < quantShare) r = Math.round(r / quant) * quant
    const a = R() * Math.PI * 2
    const u = Math.cos(a) * r
    const v = Math.sin(a) * r
    return plane === 'xy'
      ? [c[0] + u, c[1] + v, c[2] + j(0.004), tone(r, a)]
      : [c[0] + u, c[1] + j(0.004), c[2] + v, tone(r, a)]
  }

  const circle = (c: V3, r: number, plane: 'xy' | 'xz', tone: number, jit = 0.006): Gen => () => {
    const a = R() * Math.PI * 2
    const u = Math.cos(a) * r + j(jit)
    const v = Math.sin(a) * r + j(jit)
    return plane === 'xy' ? [c[0] + u, c[1] + v, c[2] + j(jit), tone] : [c[0] + u, c[1] + j(jit), c[2] + v, tone]
  }

  const sphere = (c: V3, r: number, tone: number, reject?: (p: V3) => boolean): Gen => () => {
    const u = R() * 2 - 1
    const a = R() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const p: V3 = [c[0] + Math.cos(a) * s * r, c[1] + u * r, c[2] + Math.sin(a) * s * r]
    if (reject?.(p)) return null
    return [p[0], p[1], p[2], tone]
  }

  return { seg, poly, rectXY, rectXZ, rectYZ, boxEdges, boxFaces, annulus, circle, sphere, between, pickWeighted }
}

function build(parts: Part[], n: number, R: () => number) {
  const total = parts.reduce((s, p) => s + p.w, 0)
  const pos = new Float32Array(n * 3)
  const tone = new Float32Array(n)
  let k = 0
  parts.forEach((p, idx) => {
    const want = idx === parts.length - 1 ? n - k : Math.round((p.w / total) * n)
    let made = 0
    let tries = 0
    const max = want * 60 + 200
    while (made < want && k < n && tries < max) {
      tries++
      const q = p.gen()
      if (!q) continue
      pos[k * 3] = q[0]
      pos[k * 3 + 1] = q[1]
      pos[k * 3 + 2] = q[2]
      tone[k] = q[3]
      k++
      made++
    }
  })
  // A part that kept rejecting leaves a remainder: fill it with copies of existing points.
  for (; k < n; k++) {
    const s = Math.floor(R() * Math.max(k, 1))
    pos[k * 3] = pos[s * 3]
    pos[k * 3 + 1] = pos[s * 3 + 1]
    pos[k * 3 + 2] = pos[s * 3 + 2]
    tone[k] = tone[s]
  }
  return { pos, tone }
}

function rotate(pos: Float32Array, rx: number, ry: number, rz = 0) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)]
  for (let i = 0; i < pos.length; i += 3) {
    let x = pos[i], y = pos[i + 1], z = pos[i + 2]
    // X
    let y1 = y * cx - z * sx
    let z1 = y * sx + z * cx
    y = y1; z = z1
    // Y
    let x1 = x * cy + z * sy
    z1 = -x * sy + z * cy
    x = x1; z = z1
    // Z
    x1 = x * cz - y * sz
    y1 = x * sz + y * cz
    pos[i] = x1
    pos[i + 1] = y1
    pos[i + 2] = z
  }
}

/** Center on the bounding box and scale so the largest half-extent is 1. */
function normalize(pos: Float32Array) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i += 3)
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], pos[i + a])
      max[a] = Math.max(max[a], pos[i + a])
    }
  const c = [0, 1, 2].map((a) => (min[a] + max[a]) / 2)
  const h = Math.max(...[0, 1, 2].map((a) => (max[a] - min[a]) / 2)) || 1
  for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) pos[i + a] = (pos[i + a] - c[a]) / h
}

/** Orders points left to right so that a morph sweeps across, like sand settling. */
export function sortCoherent(s: { pos: Float32Array; tone: Float32Array; rgb?: Float32Array; shade?: Float32Array }, R: () => number) {
  const n = s.tone.length
  const key = new Float32Array(n)
  for (let i = 0; i < n; i++) key[i] = s.pos[i * 3] + 0.22 * s.pos[i * 3 + 1] + 0.08 * s.pos[i * 3 + 2] + (R() - 0.5) * 0.06
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => key[a] - key[b])
  const pos = new Float32Array(n * 3)
  const tone = new Float32Array(n)
  const rgb = s.rgb ? new Float32Array(n * 3) : undefined
  const shade = s.shade ? new Float32Array(n) : undefined
  idx.forEach((from, to) => {
    pos[to * 3] = s.pos[from * 3]
    pos[to * 3 + 1] = s.pos[from * 3 + 1]
    pos[to * 3 + 2] = s.pos[from * 3 + 2]
    tone[to] = s.tone[from]
    if (shade && s.shade) shade[to] = s.shade[from]
    if (rgb && s.rgb) {
      rgb[to * 3] = s.rgb[from * 3]
      rgb[to * 3 + 1] = s.rgb[from * 3 + 1]
      rgb[to * 3 + 2] = s.rgb[from * 3 + 2]
    }
  })
  return { pos, tone, rgb, shade }
}

/** Object shape: build its parts, orient it, fit it to the unit sphere, add drifting dust. */
function objectShape(id: ShapeId, n: number, seed: number, make: (k: ReturnType<typeof kit>) => Part[], rot: V3): Shape {
  const R = mulberry32(seed)
  const k = kit(R)
  const nDust = Math.round(n * 0.045)
  const body = build(make(k), n - nDust, R)
  rotate(body.pos, rot[0], rot[1], rot[2])
  normalize(body.pos)
  const pos = new Float32Array(n * 3)
  const tone = new Float32Array(n)
  pos.set(body.pos)
  tone.set(body.tone)
  for (let i = n - nDust; i < n; i++) {
    const u = R() * 2 - 1
    const a = R() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const r = 1.25 + R() * 1.1
    pos[i * 3] = Math.cos(a) * s * r * 1.3
    pos[i * 3 + 1] = u * r * 0.8
    pos[i * 3 + 2] = Math.sin(a) * s * r
    tone[i] = TONE.dust
  }
  const sorted = sortCoherent({ pos, tone }, R)
  return { id, pos: sorted.pos, tone: sorted.tone, alpha: 1, size: 1 }
}

const T = TONE
const iris = (r: number, a: number) => T.iris + ((a / (Math.PI * 2) + r * 0.35) % 1) * 0.999

// ——— The objects ————————————————————————————————————————————————————————————

const floppy8 = (n: number) =>
  objectShape('floppy8', n, 71, (k) => {
    const hole = (x: number, y: number) => x * x + y * y < 0.095 ** 2
    const slot = (x: number, y: number) => Math.abs(x) < 0.055 && y > -0.46 && y < -0.16
    const index = (x: number, y: number) => (x - 0.14) ** 2 + y * y < 0.016 ** 2
    const label = (x: number, y: number) => x > -0.42 && x < -0.04 && y > 0.3 && y < 0.44
    return [
      { w: 0.26, gen: k.rectXY(-0.5, 0.5, -0.5, 0.5, 0.012, T.base, (x, y) => hole(x, y) || slot(x, y) || index(x, y) || label(x, y)) },
      { w: 0.09, gen: k.rectXY(-0.5, 0.5, -0.5, 0.5, -0.012, T.base, (x, y) => hole(x, y) || slot(x, y) || index(x, y)) },
      { w: 0.15, gen: k.boxEdges(-0.5, 0.5, -0.5, 0.5, -0.012, 0.012, T.base) },
      { w: 0.07, gen: k.rectXY(-0.42, -0.04, 0.3, 0.44, 0.014, T.infra) },
      { w: 0.02, gen: k.seg([-0.38, 0.37, 0.017], [-0.08, 0.37, 0.017], T.base, 0.004) },
      { w: 0.08, gen: k.annulus([0, 0, 0], 0.055, 0.095, 'xy', () => T.acid) },
      { w: 0.08, gen: k.rectXY(-0.055, 0.055, -0.46, -0.16, 0, T.uv) },
      { w: 0.05, gen: k.circle([0, 0, 0.013], 0.095, 'xy', T.acid, 0.004) },
      { w: 0.04, gen: k.poly([[-0.055, -0.46, 0.013], [0.055, -0.46, 0.013], [0.055, -0.16, 0.013], [-0.055, -0.16, 0.013]], T.acid, 0.004) },
      { w: 0.015, gen: k.circle([0.14, 0, 0.013], 0.016, 'xy', T.acid, 0.003) },
    ]
  }, [-0.35, 0.45, 0])

const hdd = (n: number) =>
  objectShape('hdd', n, 80, (k) => {
    const X = 0.73, Y = 0.25, Z = 1
    return [
      { w: 0.17, gen: k.boxEdges(-X, X, -Y, Y, -Z, Z, T.base) },
      { w: 0.13, gen: k.boxFaces(-X, X, -Y, Y, -Z, Z, T.base, 'py') },
      { w: 0.05, gen: k.rectXZ(-X, X, -Z, Z, Y, T.base, (x, z) => Math.abs(x) < X - 0.07 && Math.abs(z) < Z - 0.07) },
      { w: 0.26, gen: k.annulus([0, 0.18, -0.18], 0.14, 0.64, 'xz', () => T.acid, 0.035, 0.5) },
      { w: 0.07, gen: k.annulus([0, 0.02, -0.18], 0.14, 0.64, 'xz', () => T.acid, 0.05, 0.3) },
      { w: 0.04, gen: k.circle([0, 0.18, -0.18], 0.64, 'xz', T.acid, 0.004) },
      { w: 0.03, gen: k.circle([0, 0.21, -0.18], 0.1, 'xz', T.base, 0.004) },
      { w: 0.07, gen: k.seg([0.52, 0.21, 0.62], [0.08, 0.21, -0.02], T.infra, 0.035) },
      { w: 0.02, gen: k.circle([0.52, 0.21, 0.62], 0.08, 'xz', T.infra, 0.01) },
      { w: 0.01, gen: k.sphere([0.08, 0.21, -0.02], 0.03, T.infra) },
      { w: 0.04, gen: k.rectXY(-X, X, -Y, Y, Z + 0.01, T.base) },
      { w: 0.01, gen: k.sphere([0.55, -0.1, Z + 0.02], 0.025, T.infra) },
    ]
  }, [0.95, -0.35, 0])

const floppy35 = (n: number) =>
  objectShape('floppy35', n, 81, (k) => {
    const W = 0.45, H = 0.47, D = 0.017
    const chamfer = (x: number, y: number) => x + y > W + H - 0.07
    const holes = (x: number, y: number) => y > -0.45 && y < -0.38 && ((x > -0.42 && x < -0.35) || (x > 0.35 && x < 0.42))
    const shutter = (x: number, y: number) => x > -0.25 && x < 0.17 && y > 0.08
    const label = (x: number, y: number) => Math.abs(x) < 0.37 && y < -0.03 && y > -0.47
    const window = (x: number, y: number) => x > -0.12 && x < -0.02 && y > 0.2 && y < 0.43
    const outline = (z: number): V3[] => [[-W, -H, z], [W, -H, z], [W, H - 0.07, z], [W - 0.07, H, z], [-W, H, z]]
    return [
      { w: 0.18, gen: k.rectXY(-W, W, -H, H, D, T.base, (x, y) => chamfer(x, y) || holes(x, y) || shutter(x, y) || label(x, y)) },
      { w: 0.1, gen: k.rectXY(-W, W, -H, H, -D, T.base, (x, y) => chamfer(x, y) || holes(x, y) || x * x + y * y < 0.12 ** 2) },
      { w: 0.08, gen: k.poly(outline(D), T.base, 0.005) },
      { w: 0.06, gen: k.poly(outline(-D), T.base, 0.005) },
      { w: 0.14, gen: k.rectXY(-0.25, 0.17, 0.08, H, D + 0.004, T.acid, window) },
      { w: 0.03, gen: k.poly([[-0.25, 0.08, D + 0.006], [0.17, 0.08, D + 0.006], [0.17, H, D + 0.006], [-0.25, H, D + 0.006]], T.acid, 0.004) },
      { w: 0.04, gen: k.rectXY(-0.12, -0.02, 0.2, 0.43, 0, T.uv) },
      { w: 0.13, gen: k.rectXY(-0.37, 0.37, -0.47, -0.03, D - 0.002, T.infra) },
      { w: 0.05, gen: k.rectXY(-0.3, 0.3, -0.36, -0.12, D + 0.003, T.base, (_x, y) => Math.abs(((y + 0.36) / 0.08) % 1 - 0.5) < 0.38) },
      { w: 0.06, gen: k.annulus([0, 0, -D - 0.004], 0.035, 0.12, 'xy', () => T.acid) },
      { w: 0.02, gen: k.poly([[-0.42, -0.45, D], [-0.35, -0.45, D], [-0.35, -0.38, D], [-0.42, -0.38, D]], T.acid, 0.003) },
    ]
  }, [-0.22, -0.28, 0.04])

const disc = (k: ReturnType<typeof kit>, y: number, tone: (r: number, a: number) => number, w: number, quant: number): Part[] => [
  { w: w, gen: k.annulus([0, y, 0], 0.4, 0.98, 'xz', tone, quant, 0.45) },
  { w: w * 0.18, gen: k.annulus([0, y, 0], 0.15, 0.36, 'xz', () => T.base) },
  { w: w * 0.1, gen: k.circle([0, y, 0], 1, 'xz', T.base, 0.004) },
  { w: w * 0.05, gen: k.circle([0, y, 0], 0.125, 'xz', T.acid, 0.003) },
  { w: w * 0.04, gen: k.circle([0, y, 0], 0.4, 'xz', T.base, 0.003) },
]

const readHead = (k: ReturnType<typeof kit>): Part[] => [
  { w: 0.05, gen: k.boxEdges(0.48, 0.76, -1.06, -0.98, -0.09, 0.09, T.base) },
  { w: 0.04, gen: k.seg([-0.15, -1.08, 0.13], [1.05, -1.08, 0.13], T.base, 0.004) },
  { w: 0.04, gen: k.seg([-0.15, -1.08, -0.13], [1.05, -1.08, -0.13], T.base, 0.004) },
  { w: 0.012, gen: k.circle([0.62, -0.975, 0], 0.035, 'xz', T.infra, 0.003) },
]

const cd = (n: number) =>
  objectShape('cd', n, 85, (k) => [
    ...disc(k, 0, iris, 0.6, 0.03),
    { w: 0.06, gen: k.seg([0.62, -0.97, 0], [0.62, -0.01, 0], T.infra, 0.006) },
    { w: 0.01, gen: k.sphere([0.62, 0, 0], 0.025, T.infra) },
    ...readHead(k),
  ], [0.5, 0.3, 0])

const dvd = (n: number) =>
  objectShape('dvd', n, 96, (k) => {
    const focus: V3 = [0.62, 0.04, 0]
    return [
      ...disc(k, 0.04, iris, 0.4, 0.018),
      ...disc(k, -0.04, () => T.acid, 0.2, 0.018),
      { w: 0.025, gen: k.seg([0.54, -0.97, 0], focus, T.infra, 0.004) },
      { w: 0.025, gen: k.seg([0.7, -0.97, 0], focus, T.infra, 0.004) },
      { w: 0.025, gen: k.seg([0.62, -0.97, 0.08], focus, T.infra, 0.004) },
      { w: 0.025, gen: k.seg([0.62, -0.97, -0.08], focus, T.infra, 0.004) },
      { w: 0.012, gen: k.sphere(focus, 0.022, T.infra) },
      ...readHead(k),
    ]
  }, [0.5, -0.3, 0])

// ——— Text-derived and image-derived shapes ———————————————————————————————

/** The prologue: a big serif «S» over its byte, 01010011, sampled from a 2D canvas. */
export function byteShape(n: number, mask: TextMask): Shape {
  const R = mulberry32(7)
  const { w: W, h: H, alpha } = mask
  const bits = BITS
  const totalW = mask.bitsWidth ?? W * 0.6
  const letter: number[] = []
  const digits: number[] = []
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) if (alpha[y * W + x] > 128) (y < 440 ? letter : digits).push(y * W + x)

  const parts: Part[] = [
    {
      w: 0.64,
      gen: () => {
        const p = letter[Math.floor(R() * letter.length)]
        return [(p % W) + R() - 0.5, Math.floor(p / W) + R() - 0.5, (R() - 0.5) * 70, T.acid]
      },
    },
    {
      w: 0.36,
      gen: () => {
        const p = digits[Math.floor(R() * digits.length)]
        const x = p % W
        const ch = bits[Math.floor(((x - (W - totalW) / 2) / totalW) * bits.length)] ?? '0'
        return [x + R() - 0.5, Math.floor(p / W) + R() - 0.5, (R() - 0.5) * 14, ch === '1' ? T.infra : T.base]
      },
    },
  ]
  const nDust = Math.round(n * 0.05)
  const body = build(parts, n - nDust, R)
  for (let i = 0; i < body.pos.length; i += 3) body.pos[i + 1] = H - body.pos[i + 1] // canvas y points down
  rotate(body.pos, 0, -0.18, 0)
  normalize(body.pos)
  const pos = new Float32Array(n * 3)
  const tone = new Float32Array(n)
  pos.set(body.pos)
  tone.set(body.tone)
  for (let i = n - nDust; i < n; i++) {
    pos[i * 3] = (R() * 2 - 1) * 1.8
    pos[i * 3 + 1] = (R() * 2 - 1) * 1.2
    pos[i * 3 + 2] = (R() - 0.5) * 1.2
    tone[i] = T.dust
  }
  const s = sortCoherent({ pos, tone }, R)
  return { id: 'byte', pos: s.pos, tone: s.tone, alpha: 0.5, size: 0.8 }
}

const OBJECTS: Record<string, (n: number) => Shape> = { floppy8, hdd, floppy35, cd, dvd }

export function objectShapeById(id: string, n: number): Shape {
  return OBJECTS[id](n)
}
