import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'
import { SHAPE_ORDER, type ShapeId } from '../content/storage'
import type { PointStage, StageState } from '../three/stage'

gsap.registerPlugin(ScrollTrigger, SplitText)

const narrow = () => window.innerWidth < 860 || window.innerWidth / window.innerHeight < 0.9

/** Where the cloud sits, and how big, while a given section is on screen. */
function keyframe(el: HTMLElement, stage: PointStage): StageState {
  const { halfW, halfH } = stage
  const layout = el.dataset.layout
  const morph = Math.max(0, SHAPE_ORDER.indexOf(el.dataset.shape as ShapeId))
  const base = { morph, spin: -0.35, tilt: 0, opacity: layout === 'fade' ? 0 : 1 }
  // Long, thin objects read small at the same fit; give them a little more room.
  const fit = el.dataset.shape === 'usb' ? 1.45 : el.dataset.shape === 'floppy35' ? 1.1 : 1
  if (layout === 'hero')
    return narrow()
      ? { ...base, spin: 0, nx: 0.04, ny: 0.2, scale: halfW * 2.3 }
      : { ...base, spin: 0, nx: 0, ny: 0.22, scale: Math.min(halfW * 1.6, halfH * 2.8) }
  // Phones: the object sits in the top band, above the text card that starts at 28vh.
  if (narrow()) return { ...base, nx: 0, ny: 0.63, scale: Math.min(halfW * 0.55, halfH * 0.21) * fit }
  if (el.dataset.shape === 'byte') return { ...base, spin: -0.1, nx: 0, ny: 0.38, scale: Math.min(halfW * 0.5, halfH * 0.46) }
  const side = Math.min(halfW * 0.33, halfH * 0.6)
  switch (layout) {
    case 'right': return { ...base, nx: 0.48, ny: 0, scale: side * fit }
    case 'left': return { ...base, nx: -0.48, ny: 0, scale: side * fit }
    case 'top': return { ...base, nx: 0, ny: 0.42, scale: Math.min(halfW * 0.4, halfH * 0.34) * fit }
    default: return { ...base, nx: 0, ny: 0.1, scale: side * 1.25 }
  }
}

/** Scrolling and text reveals start at once; the 3D stage is attached when it is ready. */
export function initScroll(reduced: boolean) {
  let stage: PointStage | null = null
  const lenis = reduced ? null : new Lenis({ anchors: true, lerp: 0.09 })
  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((t) => lenis.raf(t * 1000))
    gsap.ticker.lagSmoothing(0)
  }

  const hero = document.querySelector<HTMLElement>('.hero')!
  let tl: gsap.core.Timeline | null = null
  let st: ScrollTrigger | null = null

  // One timeline, measured in scroll pixels: a morph starts when a section's top enters
  // the viewport and ends as it reaches the top; in between sections the object turns.
  function build() {
    // A sticky stage taller than the screen would hide its last lines; let it scroll
    // until its bottom is in view, then stick (negative top).
    document.querySelectorAll<HTMLElement>('.chapter__stage').forEach((el) => {
      el.style.top = ''
      if (getComputedStyle(el).position !== 'sticky') return
      const over = el.offsetHeight - window.innerHeight
      if (over > 0) el.style.top = `${-over}px`
    })
    if (!stage) return
    tl?.kill()
    st?.kill()
    const sections = Array.from(document.querySelectorAll<HTMLElement>('section[data-shape]'))
    const vh = window.innerHeight
    const top = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY
    const current = stage
    const kfs = sections.map((s) => keyframe(s, current))
    const max = ScrollTrigger.maxScroll(window)

    Object.assign(stage.state, kfs[0])
    tl = gsap.timeline({ paused: true })
    for (let i = 1; i < sections.length; i++) {
      const k = kfs[i]
      const start = Math.max(0, top(sections[i]) - vh * 0.95)
      const end = Math.max(start + 1, top(sections[i]) - vh * 0.05)
      tl.to(stage.state, { ...k, duration: end - start, ease: 'power1.inOut' }, start)
      const next = i + 1 < sections.length ? top(sections[i + 1]) - vh * 0.95 : max
      if (next > end + 1 && k.opacity > 0) tl.to(stage.state, { spin: k.spin + 0.7, duration: next - end, ease: 'none' }, end)
    }
    tl.set({}, {}, Math.max(max, tl.duration()))
    st = ScrollTrigger.create({ start: 0, end: Math.max(max, 1), scrub: reduced ? true : 0.9, animation: tl })

    // Place the hero's labels and hint around the two arms.
    const box = stage.heroBox(kfs[0])
    const machine = stage.project([-0.42, 0.15], kfs[0])
    const human = stage.project([0.42, 0.15], kfs[0])
    const set = (k: string, v: number) => hero.style.setProperty(k, `${Math.round(v)}px`)
    set('--gap-x', box.gapX)
    set('--gap-y', box.gapY)
    set('--fig-top', box.top)
    set('--fig-bottom', box.bottom)
    const keepIn = (x: number) => Math.min(Math.max(x, 120), window.innerWidth - 120)
    set('--machine-x', keepIn(machine.x))
    // Never above the hero's top row (short landscape screens).
    const keepBelow = (y: number) => Math.max(y, 160)
    set('--machine-y', keepBelow(machine.y))
    set('--human-x', keepIn(human.x))
    set('--human-y', keepBelow(human.y))
  }

  hero.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a, button')) return
    stage?.pulse()
  })

  // ——— Text reveals ——————————————————————————————————————————————————————————
  if (!reduced) {
    const chapters = Array.from(document.querySelectorAll<HTMLElement>('.chapter'))
    const setupChapter = (section: HTMLElement, i: number, all: HTMLElement[]) => {
      const text = section.querySelector<HTMLElement>('.chapter__text')!
      const title = text.querySelector<HTMLElement>('.chapter__title')!
      const split = new SplitText(title, { type: 'words', mask: 'words' })
      const rest = text.querySelectorAll('.eyebrow, .chapter__lead, .chapter__stats > div, .chapter__how, .steps li')
      const reveal = gsap.timeline({
        scrollTrigger: { trigger: section, start: 'top 55%', toggleActions: 'play none none reverse' },
      })
      reveal
        .from(split.words, { yPercent: 115, duration: 1, ease: 'power4.out', stagger: 0.045 })
        .from(rest, { y: 26, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06 }, '<0.12')

      const year = section.querySelector<HTMLElement>('.chapter__year')
      if (year) {
        const to = Number(section.dataset.year)
        const prevYear = Number(all[i - 1]?.getAttribute('data-year')) || to - 12
        const counter = { v: prevYear }
        reveal.fromTo(counter, { v: prevYear }, {
          v: to,
          duration: 1.1,
          ease: 'power2.out',
          snap: { v: 1 },
          onUpdate: () => (year.textContent = String(Math.round(counter.v))),
        }, 0)
        reveal.from(year, { autoAlpha: 0, duration: 0.8 }, 0)
        gsap.fromTo(year, { yPercent: 18 }, {
          yPercent: -18,
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
        })
      }
    }
    chapters.forEach((section, i) => setupChapter(section, i, chapters))

    // Plays once, then hands the cards back to CSS: an inline transform left behind
    // would push them down (clipped by the track) and block the hover lift.
    gsap.from('.collection__head > *, .card', {
      y: 40,
      autoAlpha: 0,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.07,
      clearProps: 'all',
      scrollTrigger: { trigger: '.collection', start: 'top 70%', once: true },
    })
  }

  // The top bar gets a backing once the hero is behind us, so text never runs under it.
  ScrollTrigger.create({
    start: () => window.innerHeight * 0.6,
    // Past the end of the page, never at it: at 'max' the class would drop on the last pixel.
    end: () => ScrollTrigger.maxScroll(window) + 10,
    toggleClass: { targets: '.topbar', className: 'is-scrolled' },
  })

  // ——— Timeline rail ———————————————————————————————————————————————————————————
  const rail = document.querySelector<HTMLElement>('.rail')!
  const firstCh = document.querySelector<HTMLElement>('#c-floppy8')!
  const lastCh = document.querySelector<HTMLElement>('#c-cloud')!
  ScrollTrigger.create({
    trigger: firstCh,
    endTrigger: lastCh,
    start: 'top 60%',
    end: 'bottom 40%',
    toggleClass: { targets: rail, className: 'is-visible' },
  })
  gsap.fromTo('.rail__fill', { scaleY: 0 }, {
    scaleY: 1,
    ease: 'none',
    scrollTrigger: { trigger: firstCh, endTrigger: lastCh, start: 'top center', end: 'bottom center', scrub: true },
  })
  document.querySelectorAll<HTMLElement>('.chapter[data-year]').forEach((section) => {
    const link = rail.querySelector(`[data-rail="${section.dataset.shape}"]`)
    ScrollTrigger.create({
      trigger: section,
      start: 'top center',
      end: 'bottom center',
      onToggle: (self) => link?.classList.toggle('is-active', self.isActive),
    })
  })

  // ——— Rebuild on real resizes (not the mobile address bar showing and hiding) ———
  let lastW = window.innerWidth
  let timer = 0
  window.addEventListener('resize', () => {
    stage?.resize()
    if (Math.abs(window.innerWidth - lastW) < 2 && narrow()) return
    lastW = window.innerWidth
    clearTimeout(timer)
    timer = window.setTimeout(() => {
      ScrollTrigger.refresh()
      build()
    }, 180)
  })

  build()
  // Fonts and images can change the page height after the first build.
  window.addEventListener('load', () => {
    ScrollTrigger.refresh()
    build()
  })

  return {
    lenis,
    attachStage(s: PointStage) {
      stage = s
      ScrollTrigger.refresh()
      build()
      hero.classList.add('has-stage')
    },
  }
}
