// The USB stick as a solid: one rounded body with the lanyard slot cut into it,
// a short USB-A shell (open at the front, two holes on top), the plastic tongue
// with its contacts, a parting line and a wordmark on the top face.
//
// Modelled in millimetres: length along x (connector towards +x), width along y,
// thickness along z (top face looks at +z).
import { mulberry32, sortCoherent, TONE, type Shape } from './shapes'
import type { TextMask } from './textmasks'
import { dot, roundCone, sampleSurface, segBox, unit, type Field, type Prim, type V } from './sdf'

const BODY = { x0: -56, x1: 0, hy: 10, hz: 4.5, rBack: 10, rFront: 3, bevel: 2.2 }
const SHELL = { x0: -1, x1: 12, hy: 6, hz: 2.25, wall: 0.4 }
const SLOT = { x0: -50, x1: -43, r: 2.4 }

const smax = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.max(a, b) + h * h * k * 0.25
}

/** A 2D rounded rectangle whose left and right corners can have different radii. */
function roundRect2(px: number, py: number, bx: number, by: number, rLeft: number, rRight: number) {
  const r = px > 0 ? rRight : rLeft
  const qx = Math.abs(px) - bx + r
  const qy = Math.abs(py) - by + r
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r
}

/** Extrude a 2D distance along z, with rounded (bevelled) edges. */
function extrude(d2: number, z: number, h: number, bevel: number) {
  const wx = d2 + bevel
  const wy = Math.abs(z) - h + bevel
  return Math.min(Math.max(wx, wy), 0) + Math.hypot(Math.max(wx, 0), Math.max(wy, 0)) - bevel
}

function box(p: V, c: V, b: V, r = 0) {
  const qx = Math.abs(p[0] - c[0]) - b[0] + r
  const qy = Math.abs(p[1] - c[1]) - b[1] + r
  const qz = Math.abs(p[2] - c[2]) - b[2] + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r
}

function bodyOutline(x: number, y: number) {
  const cx = (BODY.x0 + BODY.x1) / 2
  return roundRect2(x - cx, y, (BODY.x1 - BODY.x0) / 2, BODY.hy, BODY.rBack, BODY.rFront)
}

const parts = {
  body(p: V) {
    const shell = extrude(bodyOutline(p[0], p[1]), p[2], BODY.hz, BODY.bevel)
    // Lanyard slot: a stadium cut straight through, with softened edges.
    const sx = Math.min(Math.max(p[0], SLOT.x0), SLOT.x1)
    const slot = Math.hypot(p[0] - sx, p[1]) - SLOT.r
    return smax(shell, -slot, 0.9)
  },
  shell(p: V) {
    const cx = (SHELL.x0 + SHELL.x1) / 2
    const outer = box(p, [cx, 0, 0], [(SHELL.x1 - SHELL.x0) / 2, SHELL.hy, SHELL.hz], 0.35)
    const inner = box(p, [SHELL.x1 - 4, 0, 0], [5, SHELL.hy - SHELL.wall, SHELL.hz - SHELL.wall])
    let d = Math.max(outer, -inner)
    for (const y of [-3, 3]) d = Math.max(d, -box(p, [8.2, y, SHELL.hz], [1.2, 1.2, 1]))
    return d
  },
  tongue(p: V) {
    return box(p, [7.2, 0, -1.05], [4.3, 5.1, 0.8], 0.2)
  },
}

const field: Field = (p) => Math.min(parts.body(p), parts.shell(p), parts.tongue(p))

// The stick sits at three-quarters: top face towards the camera, connector end in view.
const ROT: V = [-0.6, -0.4, -0.35]
function rot(p: V): V {
  let [x, y, z] = p
  const [a, b, c] = ROT
  ;[y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)]
  ;[x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)]
  ;[x, y] = [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)]
  return [x, y, z]
}

const LIGHT = unit([-0.3, 0.7, 0.65])
function light(n: V) {
  const m = rot(n)
  return Math.min(1, 0.14 + 0.86 * Math.max(0, dot(m, LIGHT)) + Math.pow(1 - Math.abs(m[2]), 2) * 0.3)
}

/** The wordmark on the top face, sampled from the text mask. */
function wordmark(count: number, R: () => number, mask: TextMask): V[] {
  const { w: W, h: H, alpha } = mask
  const on: number[] = []
  for (let i = 0; i < W * H; i++) if (alpha[i] > 128) on.push(i)
  const out: V[] = []
  for (let k = 0; k < count && on.length; k++) {
    const i = on[Math.floor(R() * on.length)]
    const u = ((i % W) + R()) / W - 0.5
    const v = (Math.floor(i / W) + R()) / H - 0.5
    out.push([-25 + u * 30, -v * 5.6, BODY.hz + 0.06])
  }
  return out
}

export function usbShape(n: number, mask: TextMask): Shape {
  const R = mulberry32(2000)
  const pos: number[] = []
  const tone: number[] = []
  const shade: number[] = []
  const put = (p: V, t: number, s: number) => {
    const q = rot(p)
    pos.push(q[0], q[1], q[2])
    tone.push(t)
    shade.push(s)
  }
  // Keep what can face the camera: the stick only sways a little, so its underside never shows.
  const visible = (_p: V, nn: V) => rot(nn)[2] > -0.3

  const nBody = Math.round(n * 0.52)
  const nShell = Math.round(n * 0.15)
  const nTongue = Math.round(n * 0.06)
  const nLogo = Math.round(n * 0.05)
  const nSeam = Math.round(n * 0.05)
  const nContacts = Math.round(n * 0.015)
  const nDust = Math.round(n * 0.1)

  const which = (p: V) => {
    const b = Math.abs(parts.body(p))
    const s = Math.abs(parts.shell(p))
    const t = Math.abs(parts.tongue(p))
    return b <= s && b <= t ? 'body' : s <= t ? 'shell' : 'tongue'
  }
  const toneOf = { body: TONE.metal, shell: TONE.base, tongue: TONE.uv }

  const plate = (a: V, b: V, hy: number, hz: number) => segBox(a, b, hy, hz, 0).prim
  const groups: [Prim[], number][] = [
    [[plate([BODY.x0, 0, 0], [BODY.x1, 0, 0], BODY.hy, BODY.hz), roundCone([SLOT.x0, 0, 0], [SLOT.x1, 0, 0], SLOT.r, SLOT.r)], nBody],
    [[plate([SHELL.x0, 0, 0], [SHELL.x1, 0, 0], SHELL.hy, SHELL.hz), plate([SHELL.x1 - 9, 0, 0], [SHELL.x1, 0, 0], SHELL.hy - SHELL.wall, SHELL.hz - SHELL.wall)], nShell],
    [[plate([2.9, 0, -1.05], [11.5, 0, -1.05], 5.1, 0.8)], nTongue],
  ]
  for (const [seeds, count] of groups) {
    const s = sampleSurface(field, seeds, count, R, visible)
    s.pos.forEach((p, i) => put(p, toneOf[which(p)], light(s.nrm[i])))
  }

  // Wordmark, parting line, contacts, and a status LED.
  for (const p of wordmark(nLogo, R, mask)) put(p, TONE.acid, 1)
  for (let k = 0; k < nSeam; k++) {
    // Walk to a random point of the outline at mid-thickness.
    let p: V = [BODY.x0 + R() * (BODY.x1 - BODY.x0), (R() * 2 - 1) * BODY.hy * 1.2, 0]
    let outward: V = [0, 1, 0]
    for (let i = 0; i < 6; i++) {
      const d = bodyOutline(p[0], p[1])
      const e = 0.01
      outward = unit([(bodyOutline(p[0] + e, p[1]) - d) / e, (bodyOutline(p[0], p[1] + e) - d) / e, 0])
      p = [p[0] - outward[0] * d, p[1] - outward[1] * d, 0]
    }
    if (p[0] > BODY.x1 - 0.5) continue
    if (rot(outward)[2] < -0.3) continue
    put([p[0] + outward[0] * 0.08, p[1] + outward[1] * 0.08, 0], TONE.base, 1)
  }
  for (let k = 0; k < nContacts; k++) {
    const lane = Math.floor(R() * 4)
    put([4 + R() * 6.5, -3.9 + lane * 2.6, -0.24], TONE.acid, 1)
  }
  for (let k = 0; k < 200; k++) {
    const a = R() * Math.PI * 2
    const r = Math.sqrt(R()) * 0.7
    put([-6 + Math.cos(a) * r, 6.6 + Math.sin(a) * r, BODY.hz + 0.05], TONE.infra, 1)
  }

  // Fill to exactly n: dust first, then (if a sampler fell short) copies of real points.
  const figure = tone.length
  for (let k = 0; k < nDust && tone.length < n; k++) {
    const u = R() * 2 - 1
    const a = R() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const r = 45 + R() * 40
    pos.push(Math.cos(a) * s * r * 1.3, u * r * 0.8, Math.sin(a) * s * r)
    tone.push(TONE.dust)
    shade.push(1)
  }
  while (tone.length < n) {
    const i = Math.floor(R() * figure)
    pos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
    tone.push(tone[i])
    shade.push(shade[i])
  }
  pos.length = n * 3
  tone.length = n
  shade.length = n

  // Fit the stick (not the dust) to the unit sphere, as every other object.
  const P = Float32Array.from(pos)
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < figure; i++)
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], P[i * 3 + a])
      max[a] = Math.max(max[a], P[i * 3 + a])
    }
  const c = [0, 1, 2].map((a) => (min[a] + max[a]) / 2)
  const h = Math.max(...[0, 1, 2].map((a) => (max[a] - min[a]) / 2))
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) P[i * 3 + a] = (P[i * 3 + a] - c[a]) / h

  const s = sortCoherent({ pos: P, tone: Float32Array.from(tone), shade: Float32Array.from(shade) }, R)
  return { id: 'usb', pos: s.pos, tone: s.tone, shade: s.shade, alpha: 0.85, size: 0.85 }
}
