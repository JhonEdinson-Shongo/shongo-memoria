// Self-hosted fonts (latin subset covers Spanish): no third-party request blocks the first paint.
import '@fontsource/syne/latin-700.css'
import '@fontsource/syne/latin-800.css'
import '@fontsource/instrument-serif/latin-400-italic.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import 'lenis/dist/lenis.css'
import './styles/main.css'
import gsap from 'gsap'
import type { Shape } from './three/shapes'
import type { PointStage } from './three/stage'
import { requestShapes } from './three/shapesClient'
import { rasterizeTexts } from './three/textmasks'
import { initCarousel } from './ui/carousel'
import { fitFooter } from './ui/footer'
import { initHud } from './ui/hud'
import { initModal } from './ui/modal'
import { initMotionToggle } from './ui/motion'
import { initScroll } from './ui/scroll'
import { currentTheme, initThemeToggle } from './ui/theme'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function boot() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const small = window.innerWidth < 860 || mem < 4
  const N = small ? 48000 : 110000

  // 1 — Everything light starts now: the hero's intro is pure CSS, text is already in the HTML.
  fitFooter()
  initHud(document.querySelector('.hero')!)
  document.querySelectorAll('[data-count]').forEach((el) => (el.textContent = N.toLocaleString('es-CO')))

  const shapes = new Map<string, Shape>()
  let stage: PointStage | null = null
  let carousel: ReturnType<typeof initCarousel> | null = null
  let paused = false
  initMotionToggle((p) => {
    paused = p
    stage?.setPaused(p)
  }, reduced)
  const scroll = initScroll(reduced)
  const modal = initModal({
    shapes,
    theme: currentTheme,
    reduced,
    onOpen: () => scroll.lenis?.stop(),
    onClose: () => scroll.lenis?.start(),
  })
  initThemeToggle((t) => {
    stage?.setTheme(t)
    carousel?.setTheme(t)
    modal.setTheme(t)
  })

  // 2 — The heavy part, off the critical path: three.js loads as its own chunk while a
  //     worker builds the point clouds. The main thread only rasterizes two text masks.
  const stageModule = import('./three/stage')
  await Promise.race([
    Promise.all([document.fonts.load('800 120px "Syne"'), document.fonts.load('500 40px "JetBrains Mono"')]),
    wait(1500),
  ]).catch(() => undefined)
  const built = await requestShapes({ n: N, ...rasterizeTexts() })
  built.forEach((s) => shapes.set(s.id, s))
  carousel = initCarousel(document.querySelector('.carousel')!, shapes, currentTheme(), reduced)

  try {
    const { PointStage } = await stageModule
    stage = new PointStage(document.querySelector<HTMLCanvasElement>('#stage')!, built, currentTheme(), reduced)
    stage.setPaused(paused)
  } catch (err) {
    console.warn('WebGL no disponible; se muestra la versión estática.', err)
    document.documentElement.classList.add('no-webgl')
  }

  if (stage) {
    const s = stage
    scroll.attachStage(s)
    gsap.to(s.intro, { value: 1, duration: reduced ? 0 : 3.4, ease: 'power2.out' })
    gsap.ticker.add((time, deltaMs) => s.frame(time, Math.min(deltaMs / 1000, 0.05)))
  }
  document.documentElement.classList.add('is-ready')
}

boot()
