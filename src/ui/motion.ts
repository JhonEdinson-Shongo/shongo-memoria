/**
 * WCAG 2.2.2 (Pause, Stop, Hide): the marquee, the spinning sticker, the blinking
 * hint and the idle sway all move on their own, so the reader can stop them.
 * Starts paused when the system asks for reduced motion; the choice is remembered.
 */
export function initMotionToggle(onChange: (paused: boolean) => void, reduced: boolean) {
  const btn = document.querySelector<HTMLButtonElement>('#motion-toggle')
  if (!btn) return
  let paused = reduced
  try {
    const saved = localStorage.getItem('shongo-motion')
    if (saved) paused = saved === 'paused'
  } catch {
    /* storage unavailable: fall back to the system setting */
  }
  const apply = () => {
    document.documentElement.classList.toggle('motion-paused', paused)
    btn.setAttribute('aria-pressed', String(paused))
    onChange(paused)
  }
  btn.addEventListener('click', () => {
    paused = !paused
    try {
      localStorage.setItem('shongo-motion', paused ? 'paused' : 'running')
    } catch {
      /* not remembered, still applied */
    }
    apply()
  })
  apply()
}
