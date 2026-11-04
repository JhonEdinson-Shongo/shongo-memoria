// Thumbnails for the cards and the modal: the same point sculptures, drawn with a
// 2D canvas. One WebGL context for the page is enough; these cost a few thousand
// fillRect calls and only animate while hovered or open.
import { colorsFor, css, type Theme } from '../three/palette'
import type { Shape } from '../three/shapes'

export class Sketch {
  private ctx: CanvasRenderingContext2D
  private idx: Int32Array
  private colors: string[] = []
  private raf = 0
  private angle = 0
  private phase = 0
  private w = 0
  private h = 0

  constructor(private canvas: HTMLCanvasElement, private shape: Shape, theme: Theme, count = 2600) {
    this.ctx = canvas.getContext('2d')!
    const n = shape.tone.length
    const step = Math.max(1, Math.floor(n / count))
    const picked: number[] = []
    for (let i = 0; i < n; i += step) if (shape.tone[i] !== 4) picked.push(i) // skip dust
    this.idx = Int32Array.from(picked)
    this.setTheme(theme)
  }

  setTheme(theme: Theme) {
    const rgb = colorsFor(this.shape, theme)
    const a = theme === 'dark' ? 0.78 : 0.86
    this.colors = Array.from(this.idx, (i) => css([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]], a))
    this.draw()
  }

  private fit() {
    const r = this.canvas.getBoundingClientRect()
    const pr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(r.width * pr))
    const h = Math.max(1, Math.round(r.height * pr))
    if (w !== this.w || h !== this.h) {
      this.canvas.width = this.w = w
      this.canvas.height = this.h = h
    }
  }

  draw() {
    this.fit()
    const { ctx, w, h } = this
    ctx.clearRect(0, 0, w, h)
    const p = this.shape.pos
    const s = Math.min(w, h) * 0.38
    const ca = Math.cos(this.angle)
    const sa = Math.sin(this.angle)
    const dot = Math.max(1.2, Math.min(w, h) / 190)
    for (let k = 0; k < this.idx.length; k++) {
      const i = this.idx[k] * 3
      const x = p[i] * ca + p[i + 2] * sa
      const z = -p[i] * sa + p[i + 2] * ca
      const persp = 3.2 / (3.2 - z)
      ctx.fillStyle = this.colors[k]
      ctx.fillRect(w / 2 + x * s * persp, h / 2 - p[i + 1] * s * persp, dot, dot)
    }
  }

  play(speed = 0.5) {
    if (this.raf) return
    let last = performance.now()
    const tick = (now: number) => {
      // A slow sway rather than a full turn, so discs never end up edge-on.
      this.phase += ((now - last) / 1000) * speed
      this.angle = Math.sin(this.phase) * 0.85
      last = now
      this.draw()
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }
}
