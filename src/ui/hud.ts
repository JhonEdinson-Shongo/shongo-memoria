/** A crosshair read-out that follows the pointer over the hero: the machine is watching. */
export function initHud(hero: HTMLElement) {
  const hud = hero.querySelector<HTMLElement>('.hud')
  if (!hud || matchMedia('(hover: none)').matches) return
  const x = hud.querySelector<HTMLElement>('[data-hud-x]')!
  const y = hud.querySelector<HTMLElement>('[data-hud-y]')!
  const pad = (n: number) => String(Math.max(0, Math.round(n))).padStart(4, '0')
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    hud.style.transform = `translate3d(${px}px, ${py}px, 0)`
    x.textContent = `X ${pad(px)}`
    y.textContent = `Y ${pad(py)}`
    hud.classList.add('is-on')
  })
  hero.addEventListener('pointerleave', () => hud.classList.remove('is-on'))
}
