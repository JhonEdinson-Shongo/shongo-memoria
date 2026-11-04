// Signed-distance-field toolkit shared by the hero hands and the solid objects.
// Shapes are unions of primitives; points are seeded on primitives and projected
// onto the field's surface, keeping their normals for baked lighting.

export type V = [number, number, number]
export const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const len = (a: V) => Math.hypot(a[0], a[1], a[2])
export const unit = (a: V): V => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const lerpV = (a: V, b: V, t: number): V => add(a, mul(sub(b, a), t))

export interface Prim {
  d(p: V): number
  sample(R: () => number): V
  area: number
  /** A sphere that contains the primitive: lets a union skip it when it is far away. */
  bound?: { c: V; r: number }
}

export function sphereDir(R: () => number): V {
  const u = R() * 2 - 1
  const a = R() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  return [Math.cos(a) * s, u, Math.sin(a) * s]
}

export function basis(u: V): [V, V] {
  const ref: V = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]
  const v = unit(cross(ref, u))
  return [v, cross(u, v)]
}

// ——— Primitives (distance functions after Inigo Quilez) ————————————————————

export function roundCone(a: V, b: V, r1: number, r2: number): Prim {
  const ba = sub(b, a)
  const l2 = dot(ba, ba)
  const L = Math.sqrt(l2)
  const rr = r1 - r2
  const a2 = l2 - rr * rr
  const il2 = 1 / l2
  const [v, w] = basis(mul(ba, 1 / L))
  return {
    d(p) {
      const pa = sub(p, a)
      const y = dot(pa, ba)
      const z = y - l2
      const q = sub(mul(pa, l2), mul(ba, y))
      const x2 = dot(q, q)
      const y2 = y * y * l2
      const z2 = z * z * l2
      const k = Math.sign(rr) * rr * rr * x2
      if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2
      if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1
      return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1
    },
    sample(R) {
      const s = R() * (L + r1 + r2) - r1
      if (s < 0) return add(a, mul(sphereDir(R), r1))
      if (s > L) return add(b, mul(sphereDir(R), r2))
      const t = s / L
      const r = r1 + (r2 - r1) * t
      const th = R() * Math.PI * 2
      return add(lerpV(a, b, t), add(mul(v, Math.cos(th) * r), mul(w, Math.sin(th) * r)))
    },
    area: Math.PI * (r1 + r2) * L + 2 * Math.PI * (r1 * r1 + r2 * r2),
    bound: { c: lerpV(a, b, 0.5), r: L / 2 + Math.max(r1, r2) },
  }
}

export function sphere(c: V, r: number): Prim {
  return { d: (p) => len(sub(p, c)) - r, sample: (R) => add(c, mul(sphereDir(R), r)), area: 4 * Math.PI * r * r, bound: { c, r } }
}

/** A rounded box laid along a→b; `hy` is its thickness, `hz` its width (towards the camera). */
export function segBox(a: V, b: V, hy: number, hz: number, r: number) {
  const u = unit(sub(b, a))
  const Z: V = [0, 0, 1]
  const w = unit(sub(Z, mul(u, dot(Z, u))))
  const v = cross(w, u)
  const c = lerpV(a, b, 0.5)
  const hx = len(sub(b, a)) / 2
  const at = (x: number, y: number, z: number) => add(c, add(mul(u, x), add(mul(v, y), mul(w, z))))
  const faces = [
    { w: hy * hz, f: (R: () => number) => at((R() < 0.5 ? -1 : 1) * hx, (R() * 2 - 1) * hy, (R() * 2 - 1) * hz) },
    { w: hx * hz, f: (R: () => number) => at((R() * 2 - 1) * hx, (R() < 0.5 ? -1 : 1) * hy, (R() * 2 - 1) * hz) },
    { w: hx * hy, f: (R: () => number) => at((R() * 2 - 1) * hx, (R() * 2 - 1) * hy, (R() < 0.5 ? -1 : 1) * hz) },
  ]
  const fw = faces.reduce((s, f) => s + f.w, 0)
  const prim: Prim = {
    d(p) {
      const q = sub(p, c)
      const lx = Math.abs(dot(q, u)) - hx + r
      const ly = Math.abs(dot(q, v)) - hy + r
      const lz = Math.abs(dot(q, w)) - hz + r
      return Math.hypot(Math.max(lx, 0), Math.max(ly, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, ly, lz), 0) - r
    },
    sample(R) {
      let k = R() * fw
      for (const f of faces) {
        k -= f.w
        if (k <= 0) return f.f(R)
      }
      return faces[2].f(R)
    },
    area: 8 * (hx * hy + hy * hz + hx * hz),
    bound: { c, r: Math.hypot(hx, hy, hz) },
  }
  const corners: V[] = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push(at(sx * hx, sy * hy, sz * hz))
  // Corner index = sx*4 + sy*2 + sz (0/1 each); edges join corners that differ in one bit.
  const edges: [V, V][] = []
  for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) edges.push([corners[i], corners[i | bit]])
  return { prim, edges }
}

/** A cylinder from a to b. */
export function cylinder(a: V, b: V, r: number) {
  const ba = sub(b, a)
  const baba = dot(ba, ba)
  const L = Math.sqrt(baba)
  const [v, w] = basis(mul(ba, 1 / L))
  const prim: Prim = {
    d(p) {
      const pa = sub(p, a)
      const paba = dot(pa, ba)
      const x = len(sub(mul(pa, baba), mul(ba, paba))) - r * baba
      const y = Math.abs(paba - baba * 0.5) - baba * 0.5
      const x2 = x * x
      const y2 = y * y * baba
      const d = Math.max(x, y) < 0 ? -Math.min(x2, y2) : (x > 0 ? x2 : 0) + (y > 0 ? y2 : 0)
      return (Math.sign(d) * Math.sqrt(Math.abs(d))) / baba
    },
    sample(R) {
      const th = R() * Math.PI * 2
      const side = 2 * Math.PI * r * L
      const cap = Math.PI * r * r
      const k = R() * (side + 2 * cap)
      if (k < side) return add(lerpV(a, b, R()), add(mul(v, Math.cos(th) * r), mul(w, Math.sin(th) * r)))
      const rr = r * Math.sqrt(R())
      return add(k < side + cap ? a : b, add(mul(v, Math.cos(th) * rr), mul(w, Math.sin(th) * rr)))
    },
    area: 2 * Math.PI * r * L + 2 * Math.PI * r * r,
    bound: { c: lerpV(a, b, 0.5), r: Math.hypot(L / 2, r) },
  }
  const rim = (c: V) => (R: () => number): V => {
    const th = R() * Math.PI * 2
    return add(c, add(mul(v, Math.cos(th) * r), mul(w, Math.sin(th) * r)))
  }
  return { prim, rims: [rim(a), rim(b)] as const, ends: [a, b] as const }
}

// ——— Fields and sampling ——————————————————————————————————————————————————

export type Field = (p: V) => number

/** Union of primitives; `k` > 0 blends them smoothly (skin), 0 keeps hard seams (metal). */
export function union(prims: Prim[], k: number): Field {
  return (p) => {
    let d = prims[0].d(p)
    for (let i = 1; i < prims.length; i++) {
      // A primitive farther than the blend reach cannot change the result: skip it.
      const b = prims[i].bound
      if (b && len(sub(p, b.c)) - b.r >= d + k) continue
      const e = prims[i].d(p)
      if (k > 0) {
        const h = Math.max(k - Math.abs(d - e), 0) / k
        d = Math.min(d, e) - h * h * k * 0.25
      } else d = Math.min(d, e)
    }
    return d
  }
}

export const TETRA: V[] = [[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]]
export function grad(F: Field, p: V, e = 0.015): V {
  let g: V = [0, 0, 0]
  for (const k of TETRA) g = add(g, mul(k, F(add(p, mul(k, e)))))
  return unit(g)
}

export interface Sampled {
  pos: V[]
  nrm: V[]
}

/**
 * Points on the surface of F, seeded on the primitives and projected onto the blend.
 * `seed`, if given, rejects a seed before the (costly) projection: for thin bands
 * of the surface, where most seeds would be thrown away anyway.
 */
export function sampleSurface(
  F: Field,
  prims: Prim[],
  count: number,
  R: () => number,
  keep: (p: V, n: V) => boolean,
  seed?: (p: V, prim: Prim) => boolean,
): Sampled {
  const total = prims.reduce((s, p) => s + p.area, 0)
  const pos: V[] = []
  const nrm: V[] = []
  let tries = 0
  while (pos.length < count && tries++ < count * 40) {
    let k = R() * total
    let prim = prims[prims.length - 1]
    for (const q of prims) {
      k -= q.area
      if (k <= 0) {
        prim = q
        break
      }
    }
    let p = prim.sample(R)
    if (seed && !seed(p, prim)) continue
    if (F(p) < -0.3) continue // buried inside another part
    for (let i = 0; i < 2; i++) p = sub(p, mul(grad(F, p), F(p)))
    if (Math.abs(F(p)) > 0.04) continue
    const n = grad(F, p)
    if (!keep(p, n)) continue
    pos.push(p)
    nrm.push(n)
  }
  return { pos, nrm }
}

