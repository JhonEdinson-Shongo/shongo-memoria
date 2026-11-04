import { TONE, type Shape } from './shapes'

export type Theme = 'dark' | 'light'
type RGB = [number, number, number]

interface Palette {
  base: RGB
  acid: RGB
  infra: RGB
  uv: RGB
  dust: RGB
  /** The human arm: shadow → highlight, driven by the fresco's brightness. */
  skinLo: RGB
  skinHi: RGB
  /** The machine's plating: shadow → highlight. */
  metalLo: RGB
  metalHi: RGB
  /** The cloud's vapour: shadow → highlight. Never black, never lost on the paper. */
  vaporLo: RGB
  vaporHi: RGB
}

// Night: bone-white on black, with an infrared machine, acid joints and UV hydraulics.
// Day: black ink on raw paper, same signals, darkened so they hold on white.
export const PALETTES: Record<Theme, Palette> = {
  dark: {
    base: [0.94, 0.93, 0.9],
    acid: [0.79, 1, 0.23],
    infra: [1, 0.3, 0.11],
    uv: [0.5, 0.43, 1],
    dust: [0.42, 0.42, 0.48],
    skinLo: [0.03, 0.03, 0.035],
    skinHi: [1, 0.96, 0.9],
    metalLo: [0.03, 0.03, 0.04],
    metalHi: [0.78, 0.82, 0.92],
    vaporLo: [0.12, 0.1, 0.32],
    vaporHi: [0.94, 0.95, 1],
  },
  light: {
    base: [0.04, 0.04, 0.06],
    acid: [0.36, 0.5, 0],
    infra: [0.94, 0.22, 0.03],
    uv: [0.3, 0.18, 0.95],
    dust: [0.4, 0.4, 0.44],
    skinLo: [0.03, 0.03, 0.05],
    skinHi: [0.78, 0.76, 0.72],
    metalLo: [0.05, 0.05, 0.08],
    metalHi: [0.72, 0.73, 0.76],
    vaporLo: [0.2, 0.15, 0.62],
    vaporHi: [0.58, 0.64, 0.9],
  },
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

export function toneColor(tone: number, theme: Theme): RGB {
  const p = PALETTES[theme]
  const id = Math.floor(tone)
  const f = tone - id
  switch (id) {
    case TONE.acid: return p.acid
    case TONE.infra: return p.infra
    case TONE.uv: return p.uv
    case TONE.dust: return p.dust
    case TONE.iris: {
      // Diffraction on a disc: infrared → acid → ultraviolet → infrared.
      const s = f * 3
      if (s < 1) return mix(p.infra, p.acid, s)
      if (s < 2) return mix(p.acid, p.uv, s - 1)
      return mix(p.uv, p.infra, s - 2)
    }
    default: return p.base
  }
}

const cache = new Map<string, Float32Array>()

export function colorsFor(shape: Shape, theme: Theme): Float32Array {
  const key = `${shape.id}:${theme}`
  const hit = cache.get(key)
  if (hit) return hit
  const n = shape.tone.length
  const out = new Float32Array(n * 3)
  const p = PALETTES[theme]
  for (let i = 0; i < n; i++) {
    let c: RGB
    const t = shape.tone[i]
    const light = shape.shade ? shape.shade[i] : 1
    if (t === TONE.skin) c = mix(p.skinLo, p.skinHi, light)
    else if (t === TONE.metal) c = mix(p.metalLo, p.metalHi, light)
    else if (t === TONE.vapor) c = mix(p.vaporLo, p.vaporHi, light)
    else if (t === TONE.uv && shape.shade) c = mix(p.metalLo, p.uv, light)
    else if (t === TONE.image && shape.rgb) c = [shape.rgb[i * 3], shape.rgb[i * 3 + 1], shape.rgb[i * 3 + 2]]
    else {
      c = toneColor(shape.tone[i], theme)
      // Solid objects carry baked light: shadowed points fade towards the ground.
      if (shape.shade && t !== TONE.dust && t !== TONE.infra && t !== TONE.acid) {
        const k = 0.2 + 0.8 * light
        c = theme === 'dark' ? [c[0] * k, c[1] * k, c[2] * k] : mix([0.72, 0.71, 0.68], c, k)
      }
    }
    out[i * 3] = c[0]
    out[i * 3 + 1] = c[1]
    out[i * 3 + 2] = c[2]
  }
  cache.set(key, out)
  return out
}

export const css = (c: RGB, a = 1) =>
  `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`
