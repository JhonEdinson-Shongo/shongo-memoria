import type { Theme } from '../three/palette'

export const currentTheme = (): Theme =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'

/** The initial theme is set by an inline script in index.html, before first paint. */
export function initThemeToggle(onChange: (t: Theme) => void) {
  const btn = document.querySelector<HTMLButtonElement>('#theme-toggle')!
  const sync = () => {
    const t = currentTheme()
    btn.setAttribute('aria-pressed', String(t === 'light'))
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#060607' : '#ecebe6')
  }
  btn.addEventListener('click', () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('shongo-theme', next)
    } catch {
      /* private mode: the choice just isn't remembered */
    }
    sync()
    onChange(next)
  })
  sync()
}
