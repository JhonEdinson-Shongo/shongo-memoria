import type { Theme } from '../three/palette'
import type { Shape } from '../three/shapes'
import { Sketch } from './sketch'

/**
 * Native horizontal scroll with snap points, plus buttons, a progress line and
 * mouse drag. Touch and trackpads use the browser's own scrolling.
 */
export function initCarousel(root: HTMLElement, shapes: Map<string, Shape>, theme: Theme, reduced: boolean) {
  const track = root.querySelector<HTMLElement>('.carousel__track')!
  const prev = root.querySelector<HTMLButtonElement>('[data-dir="-1"]')!
  const next = root.querySelector<HTMLButtonElement>('[data-dir="1"]')!
  const bar = root.querySelector<HTMLElement>('.carousel__progress span')!
  const cards = Array.from(track.querySelectorAll<HTMLElement>('.card'))

  const step = () => {
    const c = cards[0]
    if (!c) return 300
    const gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0
    return c.getBoundingClientRect().width + gap
  }
  const update = () => {
    const max = track.scrollWidth - track.clientWidth
    const p = max > 0 ? track.scrollLeft / max : 0
    bar.style.transform = `scaleX(${Math.max(0.06, p)})`
    prev.disabled = track.scrollLeft < 4
    next.disabled = track.scrollLeft > max - 4
  }
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduced ? 'auto' : 'smooth' }))
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduced ? 'auto' : 'smooth' }))
  track.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)
  update()

  // Mouse drag. Snap is paused while dragging, and a drag does not count as a click.
  let down = false
  let moved = 0
  let startX = 0
  let startLeft = 0
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    down = true
    moved = 0
    startX = e.clientX
    startLeft = track.scrollLeft
  })
  window.addEventListener('pointermove', (e) => {
    if (!down) return
    const dx = e.clientX - startX
    moved = Math.max(moved, Math.abs(dx))
    if (moved > 4) {
      track.classList.add('is-dragging')
      track.scrollLeft = startLeft - dx
    }
  })
  window.addEventListener('pointerup', () => {
    if (!down) return
    down = false
    track.classList.remove('is-dragging')
  })
  track.addEventListener('click', (e) => {
    if (moved > 4) {
      e.stopPropagation()
      e.preventDefault()
      moved = 0
    }
  }, true)

  // Thumbnails: drawn once, static (no hover motion).
  const sketches: Sketch[] = []
  cards.forEach((card) => {
    const canvas = card.querySelector<HTMLCanvasElement>('.card__canvas')!
    const shape = shapes.get(canvas.dataset.shape!)
    if (shape) sketches.push(new Sketch(canvas, shape, theme))
  })
  window.addEventListener('resize', () => sketches.forEach((s) => s.draw()))

  return {
    setTheme(t: Theme) {
      sketches.forEach((s) => s.setTheme(t))
    },
  }
}
