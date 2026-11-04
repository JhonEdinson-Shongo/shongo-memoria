// The hero: a human hand and its machine mirror, built as signed distance fields.
//
// Each hand is a skeleton of primitives (round cones, rounded boxes, cylinders).
// Points are sampled on the primitives, then projected onto the surface of the
// whole field, so they land exactly on the skin or the plating. Each point keeps
// its surface normal, which bakes the lighting (form) and lets us drop the points
// facing away from the camera (so the silhouette stays clean, not see-through).
//
// Units while modelling: centimetres, wrist at the origin, fingers pointing to -x,
// palm facing down (-y), thumb towards the camera (+z).
import { mulberry32, sortCoherent, TONE, type Shape } from './shapes'
import {
  add, cross, dot, grad, len, lerpV, mul, roundCone, sampleSurface, segBox, sphere, sub, union, unit,
  type Prim, type V,
} from './sdf'

// ——— The skeleton (shared by both hands, so the machine mirrors the human pose) ——

interface Finger {
  joints: [V, V, V, V] // knuckle, middle joint, last joint, tip
  radii: [number, number, number, number]
}

const FINGERS: Finger[] = [
  // index: reaching, almost straight
  { joints: [[-9, 0.25, 2.7], [-13.4, 0.05, 2.9], [-16, -0.25, 3], [-18.2, -0.45, 3]], radii: [1, 0.92, 0.82, 0.7] },
  // middle, ring, little: relaxed, curling towards the palm
  { joints: [[-9.3, 0.15, 0.85], [-13.6, -0.9, 0.95], [-15.3, -3.2, 0.95], [-15.4, -5.3, 0.85]], radii: [1, 0.93, 0.83, 0.7] },
  { joints: [[-9, 0.05, -1], [-13, -1.1, -1.1], [-14.4, -3.3, -1.2], [-14.3, -5.2, -1.2]], radii: [0.95, 0.88, 0.78, 0.66] },
  { joints: [[-8.4, -0.1, -2.75], [-11.6, -1.2, -3], [-12.6, -2.9, -3.15], [-12.5, -4.4, -3.15]], radii: [0.85, 0.75, 0.67, 0.58] },
]
const THUMB: Finger = { joints: [[-1.6, -0.8, 2.6], [-4.6, -1.5, 4.6], [-7.4, -2.2, 5.3], [-9.5, -2.6, 5.2]], radii: [1.5, 1.15, 1, 0.85] }
const ELBOW: V = [24, 7, -2]
const INDEX_TIP = FINGERS[0].joints[3]

// ——— Human ——————————————————————————————————————————————————————————————————

function humanPrims(): Prim[] {
  const P: Prim[] = []
  // Forearm with a muscle swell on top, and the wrist bone.
  P.push(roundCone([0, 0, 0], ELBOW, 2.45, 3.5))
  P.push(roundCone([7, 0.9, -0.2], [21, 6.6, -1.6], 2.6, 3.4))
  P.push(sphere([0.6, 0.9, -1.7], 0.85))
  // Palm: narrower at the wrist, wider at the knuckles.
  P.push(segBox([-0.4, 0, 0], [-4.8, 0.05, 0], 1.2, 3.1, 1.1).prim)
  P.push(segBox([-3.8, 0.05, 0], [-8.6, 0.1, -0.05], 1.25, 3.95, 1.15).prim)
  for (const f of FINGERS) {
    const [a, b, c, d] = f.joints
    const [ra, rb, rc, rd] = f.radii
    P.push(sphere(add(a, [0.1, 0.45, 0]), ra * 0.92)) // knuckle on the back of the hand
    P.push(roundCone(a, b, ra, rb))
    P.push(roundCone(b, c, rb, rc))
    P.push(roundCone(c, d, rc, rd))
    P.push(segBox(lerpV(c, d, 0.35), lerpV(c, d, 0.98), 0.12, rd * 0.72, 0.1).prim) // nail
  }
  const [a, b, c, d] = THUMB.joints
  const [ra, rb, rc, rd] = THUMB.radii
  P.push(roundCone([-1.2, -0.4, 1.6], b, 1.9, 1.3)) // the fleshy base of the thumb
  P.push(roundCone(a, b, ra, rb))
  P.push(roundCone(b, c, rb, rc))
  P.push(roundCone(c, d, rc, rd))
  return P
}

// ——— Machine ————————————————————————————————————————————————————————————————
//
// Sculpted shells over a dark mechanism, like a product render: every phalanx is a
// soft-cornered shell, the joints between them are recessed and dark, the palm and the
// forearm are panels with seams. No wireframe: the form itself carries the read.

interface Robot {
  shells: Prim[]
  joints: Prim[]
  pistons: Prim[]
  /** Light channels on the camera side of a panel: a → b, centred on `c`, along `u`. */
  strips: { c: V; u: V; half: number }[]
}

/** The frame segBox lays along a→b: u along it, w towards the camera, v up. */
function frame(a: V, b: V) {
  const u = unit(sub(b, a))
  const Z: V = [0, 0, 1]
  const w = unit(sub(Z, mul(u, dot(Z, u))))
  return { u, v: cross(w, u), w }
}

function robotParts(): Robot {
  const shells: Prim[] = []
  const joints: Prim[] = []
  const pistons: Prim[] = []
  const strips: Robot['strips'] = []
  const shell = (a: V, b: V, hy: number, hz: number, round: number) => shells.push(segBox(a, b, hy, hz, round).prim)
  const strip = (a: V, b: V, hz: number, inset: number) => {
    const { u, w } = frame(a, b)
    const half = len(sub(b, a)) / 2 - inset
    strips.push({ c: add(lerpV(a, b, 0.5), mul(w, hz)), u, half })
  }

  // Forearm: two panels with a dark seam, a light channel along each, pistons underneath.
  const w0: V = [2.3, 0.3, 0]
  const axis = unit(sub(ELBOW, w0))
  const mid = lerpV(w0, ELBOW, 0.48)
  const lowEnd = sub(mid, mul(axis, 0.45))
  const upStart = add(mid, mul(axis, 0.45))
  shell(w0, lowEnd, 2.0, 2.25, 0.8)
  shell(upStart, ELBOW, 2.45, 2.6, 0.95)
  joints.push(roundCone(sub(mid, mul(axis, 0.8)), add(mid, mul(axis, 0.8)), 1.85, 1.95))
  strip(w0, lowEnd, 2.25, 1.6)
  strip(upStart, ELBOW, 2.6, 2.2)
  for (const z of [-1.2, 1.2]) {
    pistons.push(roundCone([4, -2.6, z], [12, -0.5, z], 0.5, 0.5))
    pistons.push(roundCone([12, -0.5, z], [21, 2.4, z], 0.3, 0.3))
  }

  // Wrist: a dark gimbal between forearm and palm.
  joints.push(roundCone([-0.9, 0, 0], [2.6, 0.3, 0], 1.55, 1.75))

  // Palm: a soft slab with a raised panel on the back, and a guard over each knuckle.
  shell([-1.1, 0, 0], [-8.1, 0.08, 0], 1.15, 3.7, 0.6)
  shell([-2.4, 0.95, 0], [-7.2, 1.0, 0], 0.32, 2.9, 0.28)

  const finger = (f: Finger, skipFirst = false) => {
    for (let i = 0; i < 3; i++) {
      const a = f.joints[i]
      const b = f.joints[i + 1]
      const ra = f.radii[i]
      const rb = f.radii[i + 1]
      const r = (ra + rb) / 2
      const u = unit(sub(b, a))
      // The joint: a dark ball, mostly hidden by the shells, visible in the gap.
      joints.push(sphere(a, ra * 0.74))
      if (i === 0 && skipFirst) continue
      const tip = i === 2
      const s = 0.36
      const e = tip ? -0.05 : rb * 0.36
      // The last phalanx is rounder: it reads as a fingertip, not a block.
      shell(add(a, mul(u, ra * s)), sub(b, mul(u, e)), r * 0.84, r * 0.9, r * (tip ? 0.62 : 0.32))
    }
    // Knuckle guard: a cap riding over the first joint.
    const [a, b] = f.joints
    const u = unit(sub(b, a))
    const ra = f.radii[0]
    if (!skipFirst) shell(add(a, add(mul(u, -0.5 * ra), [0, 0.3 * ra, 0])), add(a, add(mul(u, 0.35 * ra), [0, 0.3 * ra, 0])), ra * 0.78, ra * 0.98, ra * 0.6)
  }
  FINGERS.forEach((f) => finger(f))
  // Thumb: its first bone is a module built into the palm.
  const [ta, tb] = THUMB.joints
  const tu = unit(sub(tb, ta))
  shell([-0.9, -0.45, 1.5], sub(tb, mul(tu, THUMB.radii[1] * 0.55)), 1.15, 1.45, 0.8)
  finger(THUMB, true)
  return { shells, joints, pistons, strips }
}

// ——— Placing both hands in the hero ———————————————————————————————————————

/** cm → hero units. The index fingertips land either side of the gap at (0, 0). */
const K = 0.021
const TILT = 0.14 // a near-side view: the curled fingers read, with a hint of the back
const LIGHT = unit([-0.25, 0.8, 0.55])
const rotX = (p: V): V => [p[0], p[1] * Math.cos(TILT) - p[2] * Math.sin(TILT), p[1] * Math.sin(TILT) + p[2] * Math.cos(TILT)]

function placer(mirror: boolean) {
  const flip = (p: V): V => (mirror ? [-p[0], p[1], p[2]] : p)
  const tip = rotX(flip(INDEX_TIP))
  const off: V = [mirror ? -0.022 : 0.022, 0, 0]
  return {
    point: (p: V): V => add(mul(sub(rotX(flip(p)), tip), K), off),
    normal: (n: V): V => rotX(flip(n)),
  }
}

/** Baked light: diffuse from the upper left, plus a rim that draws the silhouette. */
function light(n: V) {
  const diffuse = Math.max(0, dot(n, LIGHT))
  const rim = Math.pow(1 - Math.abs(n[2]), 2.5) * 0.35
  return Math.min(1, 0.08 + diffuse * 0.92 + rim)
}

/** Plating: softer diffuse, a tight highlight (it reads as a glossy shell), a cool rim. */
const HALF = unit(add(LIGHT, [0, 0, 1]))
function sheen(n: V) {
  const diffuse = Math.max(0, dot(n, LIGHT))
  const spec = Math.pow(Math.max(0, dot(n, HALF)), 28)
  const rim = Math.pow(1 - Math.abs(n[2]), 3) * 0.3
  return Math.min(1, 0.12 + diffuse * 0.78 + spec * 0.6 + rim)
}

export function heroShape(n: number): Shape {
  const R = mulberry32(1512)
  const nHuman = Math.round(n * 0.46)
  const nShells = Math.round(n * 0.3)
  const nJoints = Math.round(n * 0.045)
  const nPistons = Math.round(n * 0.025)
  const nContour = Math.round(n * 0.06)
  const nStrips = Math.round(n * 0.008)
  // The rest (about 7%) is dust.

  const pos = new Float32Array(n * 3)
  const tone = new Float32Array(n)
  const shade = new Float32Array(n)
  let k = 0
  const put = (p: V, t: number, s: number) => {
    if (k >= n) return
    pos[k * 3] = p[0]
    pos[k * 3 + 1] = p[1]
    pos[k * 3 + 2] = p[2]
    tone[k] = t
    shade[k] = s
    k++
  }
  const facing = (place: ReturnType<typeof placer>) => (_p: V, nn: V) => place.normal(nn)[2] > -0.12

  // Human: smooth skin.
  const H = placer(false)
  const hp = humanPrims()
  const human = sampleSurface(union(hp, 0.6), hp, nHuman, R, facing(H))
  human.pos.forEach((p, i) => put(H.point(p), TONE.skin, light(H.normal(human.nrm[i]))))

  // Machine: one hard field for shells and joints, so each part is cut where another covers it.
  const M = placer(true)
  const robot = robotParts()
  const F = union([...robot.shells, ...robot.joints], 0)
  const own = (prims: Prim[]) => {
    const f = union(prims, 0)
    return (p: V) => f(p) < 0.05
  }
  const onShell = own(robot.shells)
  const onJoint = own(robot.joints)
  const front = facing(M)

  const shells = sampleSurface(F, robot.shells, nShells, R, (p, nn) => onShell(p) && front(p, nn))
  shells.pos.forEach((p, i) => put(M.point(p), TONE.metal, sheen(M.normal(shells.nrm[i]))))
  // The mechanism shows only in the gaps, in shadow.
  const jnt = sampleSurface(F, robot.joints, nJoints, R, (p, nn) => onJoint(p) && !onShell(p) && front(p, nn))
  jnt.pos.forEach((p, i) => put(M.point(p), TONE.metal, 0.05 + 0.3 * sheen(M.normal(jnt.nrm[i]))))
  const pist = sampleSurface(union(robot.pistons, 0), robot.pistons, nPistons, R, front)
  pist.pos.forEach((p, i) => put(M.point(p), TONE.uv, 0.4 + 0.6 * light(M.normal(pist.nrm[i]))))

  // Contour: the shells' silhouettes in infrared, so every part has a clean outline.
  // Upper and lower edges only: the end caps are seen edge-on too, but would read as blobs.
  const rimBand = (m: V, slack: number) => m[2] > -0.12 - slack && m[2] < 0.07 + slack && Math.abs(m[1]) > 0.55 - slack
  const contour = sampleSurface(
    F,
    robot.shells,
    nContour,
    R,
    (p, nn) => onShell(p) && rimBand(M.normal(nn), 0),
    // Cheap pre-check on the seed's own primitive, so most seeds skip the projection.
    (p, prim) => rimBand(M.normal(grad(prim.d, p)), 0.06),
  )
  contour.pos.forEach((p) => put(M.point(p), TONE.infra, 1))

  // Light channels: thin acid lines along the side panels.
  const stripLen = robot.strips.map((s) => s.half)
  const stripTotal = stripLen.reduce((a, b) => a + b, 0)
  for (let i = 0; i < nStrips; i++) {
    let r = R() * stripTotal
    let e = 0
    while (e < robot.strips.length - 1 && (r -= stripLen[e]) > 0) e++
    const s = robot.strips[e]
    put(M.point(add(s.c, add(mul(s.u, (R() * 2 - 1) * s.half), [0, (R() - 0.5) * 0.14, 0.02]))), TONE.acid, 1)
  }

  // Whatever the samplers could not place, plus a drift of dust.
  const figure = k
  while (k < n) {
    put([(R() * 2 - 1) * 1.35, -0.55 + R() * 1.3, (R() - 0.5) * 0.8], TONE.dust, 1)
  }
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < figure; i++) {
    if (Math.abs(pos[i * 3]) > 1) continue
    minY = Math.min(minY, pos[i * 3 + 1])
    maxY = Math.max(maxY, pos[i * 3 + 1])
  }
  const s = sortCoherent({ pos, tone, shade }, R)
  return { id: 'hero', pos: s.pos, tone: s.tone, shade: s.shade, gap: [0, 0, 0], bounds: [minY, maxY], alpha: 1.45, size: 0.92 }
}
