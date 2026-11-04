import gsap from 'gsap'
import type { Theme } from '../three/palette'
import type { Shape } from '../three/shapes'
import { Sketch } from './sketch'

interface ModalDeps {
  shapes: Map<string, Shape>
  theme: () => Theme
  onOpen: () => void
  onClose: () => void
  reduced: boolean
}

export function initModal(deps: ModalDeps) {
  const dialog = document.querySelector<HTMLDialogElement>('#spec-modal')!
  const body = dialog.querySelector<HTMLElement>('.modal__body')!
  const canvas = dialog.querySelector<HTMLCanvasElement>('.modal__canvas')!
  let sketch: Sketch | null = null

  function open(id: string) {
    const source = document.querySelector<HTMLElement>(`.card[data-id="${id}"] .card__sheet`)
    if (!source) return
    body.innerHTML = source.innerHTML
    body.querySelector('.modal__title')?.setAttribute('id', 'modal-title')
    const shape = deps.shapes.get(id)
    deps.onOpen()
    dialog.showModal()
    body.scrollTop = 0
    sketch = shape ? new Sketch(canvas, shape, deps.theme(), 5200) : null
    if (!sketch) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    const paused = document.documentElement.classList.contains('motion-paused')
    if (!deps.reduced && !paused) sketch?.play(0.35)
    if (!deps.reduced)
      gsap.fromTo(
        dialog.querySelectorAll('.modal__media, .modal__body > *'),
        { y: 24, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out', stagger: 0.035 },
      )
  }

  function close() {
    if (dialog.open) dialog.close()
  }

  dialog.addEventListener('close', () => {
    sketch?.stop()
    sketch = null
    deps.onClose()
  })
  // A click on the backdrop lands on the <dialog> itself.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close()
  })
  dialog.querySelector('.modal__close')!.addEventListener('click', close)
  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-open]')
    if (btn) open(btn.dataset.open!)
  })

  return {
    setTheme(theme: Theme) {
      sketch?.setTheme(theme)
    },
  }
}
