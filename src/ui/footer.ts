/** Scale the footer wordmark so it fills the footer's width exactly, never past it. */
export function fitFooter() {
  const word = document.querySelector<HTMLElement>('.footer__big')
  const box = word?.parentElement
  if (!word || !box) return
  const fit = () => {
    word.style.fontSize = '100px'
    const natural = word.getBoundingClientRect().width
    const avail = box.clientWidth
    if (natural > 0) word.style.fontSize = `${Math.floor((100 * avail * 0.96) / natural)}px`
  }
  fit()
  document.fonts.ready.then(fit)
  let t = 0
  window.addEventListener('resize', () => {
    clearTimeout(t)
    t = window.setTimeout(fit, 120)
  })
}
