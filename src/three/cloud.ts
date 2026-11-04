// The cloud as a solid: a cumulus with real volume above a row of server racks.
//
// The cumulus is a smooth union of spheres with a flattened base, sampled on its
// surface with baked light (no see-through spheres). The racks are cabinets with a
// detailed front: rack units with seams, drive bays, vents, handles and status
// lights. Cables climb from the racks into the cloud, carrying packets.
//
// Units: the cloud is about 2.2 wide; y up, the front of the racks looks at +z.
import { mulberry32, sortCoherent, TONE, type Shape } from './shapes'
import { dot, sampleSurface, sphere, unit, type Field, type V } from './sdf'

// ——— The cumulus ———————————————————————————————————————————————————————————————

const PUFFS: [V, number][] = [
  [[-0.78, 0.22, 0], 0.34],
  [[-0.42, 0.42, 0.04], 0.43],
  [[0.04, 0.6, -0.02], 0.5],
  [[0.5, 0.44, 0.04], 0.42],
  [[0.86, 0.22, 0], 0.3],
  [[-0.22, 0.2, 0.2], 0.34],
  [[0.3, 0.18, 0.22], 0.33],
  [[0.02, 0.3, -0.24], 0.42],
  [[-0.58, 0.16, -0.12], 0.3],
  [[0.66, 0.16, -0.1], 0.3],
]
const BASE_Y = 0.02

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k)

const cumulus: Field = (p) => {
  let d = Infinity
  for (const [c, r] of PUFFS) d = smin(d, Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r, 0.14)
  // Cumulus sit on a flat, slightly rounded base.
  return smax(d, BASE_Y - p[1], 0.08)
}

// ——— The racks ——————————————————————————————————————————————————————————————————

const RACKS = [-0.7, 0, 0.7]
const RACK = { hx: 0.2, y0: -1.4, y1: -0.46, hz: 0.21 }
const UNITS = 6
const MARGIN = 0.028 // frame around the front
const SEAM = 0.016 // gap between rack units

// Three-quarter view: the front, the left side and the top of each cabinet show.
const ROT: [number, number] = [0.16, 0.36]
function rot(p: V): V {
  let [x, y, z] = p
  ;[y, z] = [y * Math.cos(ROT[0]) - z * Math.sin(ROT[0]), y * Math.sin(ROT[0]) + z * Math.cos(ROT[0])]
  ;[x, z] = [x * Math.cos(ROT[1]) + z * Math.sin(ROT[1]), -x * Math.sin(ROT[1]) + z * Math.cos(ROT[1])]
  return [x, y, z]
}
const LIGHT = unit([-0.35, 0.75, 0.55])
const HALF = unit([-0.35, 0.75, 1.55])
function light(n: V, gloss = 0) {
  const m = rot(n)
  const diffuse = Math.max(0, dot(m, LIGHT))
  const spec = gloss ? Math.pow(Math.max(0, dot(m, HALF)), 18) * gloss : 0
  return Math.min(1, 0.1 + 0.85 * diffuse + spec + Math.pow(1 - Math.abs(m[2]), 3) * 0.25)
}

/** What a rack unit holds: storage shelves, compute nodes with vents, a switch with ports. */
type Kind = 'storage' | 'compute' | 'switch'
const KINDS: Kind[] = ['storage', 'storage', 'compute', 'storage', 'compute', 'switch'] // bottom → top

export function cloudShape(n: number): Shape {
  const R = mulberry32(106)
  const pos: number[] = []
  const tone: number[] = []
  const shade: number[] = []
  const put = (p: V, t: number, s: number) => {
    const q = rot(p)
    pos.push(q[0], q[1], q[2])
    tone.push(t)
    shade.push(s)
  }
  const faces = (nn: V) => rot(nn)[2] > -0.05
  const count = (k: number) => Math.round(n * k)

  // Cumulus: vapour, lit from above; its base falls into shadow.
  const seeds = PUFFS.map(([c, r]) => sphere(c, r))
  // Seeds inside a neighbouring puff are dropped, not pushed out (that would double up the seams).
  const cloud = sampleSurface(cumulus, seeds, count(0.5), R, (_p, nn) => faces(nn), (p) => cumulus(p) > -0.05)
  cloud.pos.forEach((p, i) => put(p, TONE.vapor, light(cloud.nrm[i], 0.35)))

  // Stored objects: a scatter of tiny lights in the cloud, a few in clusters.
  const nodes = cloud.pos.filter((_, i) => rot(cloud.nrm[i])[2] > 0.55 && R() < 0.012).slice(0, 46)
  for (let i = 0; i < count(0.007); i++) {
    const c = nodes[Math.floor(R() * nodes.length)]
    const a = R() * Math.PI * 2
    const r = Math.sqrt(R()) * 0.018
    put([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2] + 0.01], TONE.acid, 1)
  }

  // Cabinets. A rack's left side can hide behind its neighbour: drop what is covered.
  const H = RACK.y1 - RACK.y0
  const unitH = (H - 2 * MARGIN) / UNITS
  const front = RACK.hz + 0.012
  const quads = RACKS.map((x) => {
    const q = (pts: V[]) => pts.map(rot)
    return {
      x,
      front: q([[x - RACK.hx, RACK.y0, RACK.hz], [x + RACK.hx, RACK.y0, RACK.hz], [x + RACK.hx, RACK.y1, RACK.hz], [x - RACK.hx, RACK.y1, RACK.hz]]),
    }
  })
  const inside = (p: V, poly: V[]) => {
    let s = 0
    for (let i = 0; i < 4; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % 4]
      s += Math.sign((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]))
    }
    return Math.abs(s) === 4
  }
  const covered = (p: V, own: number) => {
    const q = rot(p)
    return quads.some((o) => o.x !== own && inside(q, o.front) && o.front[0][2] > q[2])
  }
  const pick = () => RACKS[Math.floor(R() * RACKS.length)]

  // Sides and tops: brushed panels with a recessed line.
  for (let i = 0; i < count(0.08); i++) {
    const x = pick()
    if (R() < 0.6) {
      const y = RACK.y0 + R() * H
      const z = (R() * 2 - 1) * RACK.hz
      const p: V = [x - RACK.hx, y, z]
      if (covered(p, x)) continue
      const line = Math.abs(z - RACK.hz * 0.55) < 0.007 || Math.abs(y - (RACK.y0 + H * 0.5)) < 0.005
      put(p, TONE.metal, light([-1, 0, 0]) * (line ? 0.25 : 0.6))
    } else {
      const u = (R() * 2 - 1) * RACK.hx
      const w = (R() * 2 - 1) * RACK.hz
      put([x + u, RACK.y1, w], TONE.metal, light([0, 1, 0], 0.6) * (Math.abs(u) < 0.07 && Math.abs(w) < 0.14 ? 0.55 : 1))
    }
  }
  // Bright edges where the panels meet: they draw each cabinet as a solid.
  for (let i = 0; i < count(0.025); i++) {
    const x = pick()
    const e = Math.floor(R() * 4)
    const t = R()
    const p: V =
      e === 0 ? [x - RACK.hx, RACK.y0 + t * H, RACK.hz] // front left, vertical
      : e === 1 ? [x - RACK.hx + t * 2 * RACK.hx, RACK.y1, RACK.hz] // front top
      : e === 2 ? [x - RACK.hx, RACK.y1, -RACK.hz + t * 2 * RACK.hz] // top left
      : [x + RACK.hx, RACK.y0 + t * H, RACK.hz] // front right, vertical
    if (e === 2 && covered(p, x)) continue
    put(p, TONE.metal, 1)
  }
  // The bezel around the units.
  for (let i = 0; i < count(0.025); i++) {
    const x = pick()
    const u = (R() * 2 - 1) * RACK.hx
    const y = RACK.y0 + R() * H
    if (Math.abs(u) < RACK.hx - MARGIN && y > RACK.y0 + MARGIN && y < RACK.y1 - MARGIN) continue
    put([x + u, y, RACK.hz + 0.004], TONE.metal, light([0, 0, 1], 0.5) * 0.75)
  }

  // Rack units: faceplates with what they hold; the seams between them are dark.
  const unitsEnd = tone.length + count(0.17)
  for (let tries = 0; tone.length < unitsEnd && tries < n; tries++) {
    const x = pick()
    const u = (R() * 2 - 1) * (RACK.hx - MARGIN)
    const y = RACK.y0 + MARGIN + R() * (H - 2 * MARGIN)
    const k = Math.min(UNITS - 1, Math.floor((y - RACK.y0 - MARGIN) / unitH))
    const local = y - (RACK.y0 + MARGIN + k * unitH)
    if (local < SEAM / 2 || local > unitH - SEAM / 2) {
      if (R() < 0.5) put([x + u, y, RACK.hz - 0.01], TONE.metal, 0.04)
      continue
    }
    const s = light([0, 0, 1], 0.5)
    const plate = s * 0.72
    const fx = (u + RACK.hx - MARGIN) / (2 * (RACK.hx - MARGIN)) // 0 … 1 across
    const fy = (local - SEAM / 2) / (unitH - SEAM) // 0 … 1 up the unit
    const at = (z: number, sh: number) => put([x + u, y, z], TONE.metal, sh)
    // Ears with handles at both ends of every unit.
    if (fx < 0.06 || fx > 0.94) {
      at(front + 0.01, fy > 0.25 && fy < 0.75 ? 1 : plate)
      continue
    }
    const kind = KINDS[k]
    if (kind === 'storage') {
      // Six drive caddies: a dark slot between them, a bright pull handle on each.
      const bay = ((fx - 0.06) / 0.88) * 6
      const f = bay - Math.floor(bay)
      if (f < 0.07) at(front - 0.006, 0.05)
      else if (fy > 0.14 && fy < 0.3 && f > 0.18 && f < 0.82) at(front + 0.006, 1)
      else at(front, plate * (fy > 0.75 ? 1.15 : 1))
    } else if (kind === 'compute') {
      // A perforated vent over two thirds of the plate: points gather on a grid of holes.
      if (fx < 0.66) {
        const gx = Math.round(fx * 30) / 30
        const gy = Math.round(fy * 5) / 5
        if (Math.hypot((fx - gx) * 30, (fy - gy) * 5) > 0.28) continue
        at(front, Math.min(1, s * 1.1))
      } else if (fx > 0.72 && fx < 0.86 && fy > 0.3 && fy < 0.7) at(front - 0.003, 0.08) // a power button
      else at(front, plate)
    } else {
      // The switch: two rows of twelve ports.
      const port = ((fx - 0.06) / 0.88) * 12
      const f = port - Math.floor(port)
      const row = Math.abs(fy - 0.3) < 0.15 || Math.abs(fy - 0.72) < 0.15
      at(front - (row && f > 0.2 ? 0.005 : 0), row && f > 0.2 ? 0.05 : plate)
    }
  }

  // Status lights: two per unit on the right, most of them acid, a few infra (a disk rebuilding).
  for (let i = 0; i < count(0.012); i++) {
    const r = Math.floor(R() * RACKS.length)
    const k = Math.floor(R() * UNITS)
    const slot = Math.floor(R() * 2)
    const seed = (r * 31 + k * 7 + slot * 3) % 11
    if (seed > 8) continue // some lights are off
    const t = seed === 5 ? TONE.infra : TONE.acid
    const cx = RACKS[r] + RACK.hx - MARGIN - 0.045 - slot * 0.02
    const cy = RACK.y0 + MARGIN + (k + 0.78) * unitH
    const a = R() * Math.PI * 2
    const rr = Math.sqrt(R()) * 0.006
    put([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, front + 0.008], t, 1)
  }

  // Raised floor: tiles drawn by their joints, fading out from the racks.
  const floorEnd = tone.length + count(0.03)
  for (let tries = 0; tone.length < floorEnd && tries < n * 2; tries++) {
    const x = (R() * 2 - 1) * 1.25
    const z = (R() * 2 - 1) * 0.7
    const onX = Math.abs(x / 0.25 - Math.round(x / 0.25)) < 0.035
    const onZ = Math.abs(z / 0.25 - Math.round(z / 0.25)) < 0.035
    if (!onX && !onZ) continue
    const fade = 1 - Math.min(1, Math.hypot(x / 1.25, z / 0.7))
    if (R() > fade * 1.6) continue
    put([x, RACK.y0 - 0.004, z], TONE.metal, 0.35 + 0.65 * fade)
  }

  // Uplinks: cables from each rack's top into the cloud, with packets riding them.
  const cables: V[][] = []
  RACKS.forEach((x, r) =>
    [-0.07, 0.07].forEach((dx, j) => {
      const x0 = x + dx
      const lean = (x === 0 ? (j ? 1 : -1) : Math.sign(x)) * 0.06
      cables.push([
        [x0, RACK.y1, 0.02 * (r - 1)],
        [x0, RACK.y1 + 0.18, 0.05],
        [x0 * 0.82 + lean, BASE_Y - 0.22, 0.08],
        [x0 * 0.75 + lean, BASE_Y + 0.06, 0.06],
      ])
    }),
  )
  const bez = (c: V[], t: number): V => {
    const m = 1 - t
    const w = [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t]
    return [0, 1, 2].map((a) => c.reduce((s, p, i) => s + p[a] * w[i], 0)) as V
  }
  for (let i = 0; i < count(0.035); i++) {
    const c = cables[Math.floor(R() * cables.length)]
    const t = R()
    const p = bez(c, t)
    const a = R() * Math.PI * 2
    put([p[0] + Math.cos(a) * 0.008, p[1], p[2] + Math.sin(a) * 0.008], TONE.uv, 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(a - 2.2)))
  }
  for (let i = 0; i < count(0.012); i++) {
    const ci = Math.floor(R() * cables.length)
    // Four packets per cable, staggered so they read as travelling up.
    const t = ((Math.floor(R() * 4) + ci * 0.37) % 4) / 4 + 0.06 + R() * 0.05
    if (t > 0.97) continue
    const p = bez(cables[ci], t)
    put([p[0] + (R() - 0.5) * 0.012, p[1], p[2] + (R() - 0.5) * 0.012 + 0.01], TONE.acid, 1)
  }

  // Fill to n: dust, then (if a sampler fell short) copies of real points.
  const figure = Math.min(tone.length, n)
  pos.length = figure * 3
  tone.length = figure
  shade.length = figure
  for (let k = 0; tone.length < n && k < count(0.045); k++) {
    const u = R() * 2 - 1
    const a = R() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    const r = 1.4 + R() * 1.1
    pos.push(Math.cos(a) * s * r * 1.3, u * r * 0.8 - 0.4, Math.sin(a) * s * r)
    tone.push(TONE.dust)
    shade.push(1)
  }
  while (tone.length < n) {
    const i = Math.floor(R() * figure)
    pos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
    tone.push(tone[i])
    shade.push(shade[i])
  }

  // Fit the figure (not the dust) to the unit sphere, as every other object.
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
  return { id: 'cloud', pos: s.pos, tone: s.tone, shade: s.shade, alpha: 0.9, size: 0.9 }
}
