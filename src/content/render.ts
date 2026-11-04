// Build-time HTML for the chapters, the timeline rail and the collection cards.
// Called from vite.config.ts, so it must not touch the DOM.
import { AUTHOR, YEAR } from './author.ts'
import { INTRO, STORAGE, type StorageItem } from './storage.ts'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const num = (i: number) => String(i + 1).padStart(2, '0')
const TOTAL = num(STORAGE.length - 1)

const chapter = (s: StorageItem, i: number) => `
<section class="chapter" id="c-${s.id}" data-shape="${s.id}" data-layout="${s.layout}" data-year="${s.year}" aria-labelledby="t-${s.id}">
  <div class="chapter__year" aria-hidden="true">${s.year}</div>
  <div class="chapter__stage">
    <article class="chapter__text">
      <div class="chapter__main">
        <p class="chapter__year-m" aria-hidden="true">${s.year}</p>
        <p class="eyebrow"><span class="eyebrow__num">${num(i)}<small>/${TOTAL}</small></span><b>${esc(s.family)}</b> ${esc(s.maker)}</p>
        <h2 class="chapter__title" id="t-${s.id}">${esc(s.name)}</h2>
        <p class="chapter__lead">${esc(s.lead)}</p>
      </div>
      <div class="chapter__aside">
        <dl class="chapter__stats">
          <div><dt>Año</dt><dd>${s.year}</dd></div>
          <div><dt>Capacidad</dt><dd>${esc(s.capacity)}</dd></div>
          <div><dt>Equivale a</dt><dd>${esc(s.equivalence)}</dd></div>
        </dl>
        <p class="label chapter__how">Cómo funciona</p>
        <ol class="steps">
          ${s.how.map((h) => `<li>${esc(h)}</li>`).join('\n          ')}
        </ol>
      </div>
    </article>
  </div>
</section>`

export function renderChapters(): string {
  const intro = `
<section class="chapter chapter--intro" id="c-byte" data-shape="byte" data-layout="top" aria-labelledby="t-byte">
  <div class="chapter__stage">
    <article class="chapter__text">
      <div class="chapter__main">
        <p class="eyebrow"><span class="eyebrow__num">00</span><b>${esc(INTRO.eyebrow)}</b></p>
        <h2 class="chapter__title" id="t-byte">${esc(INTRO.title)}</h2>
        <p class="chapter__lead">${esc(INTRO.body)}</p>
      </div>
    </article>
  </div>
</section>`
  return intro + STORAGE.map(chapter).join('\n')
}

export function renderRail(): string {
  return STORAGE.map(
    (s) =>
      `<li><a href="#c-${s.id}" data-rail="${s.id}"><span class="rail__year">${s.year}</span><span class="rail__name">${esc(s.cardName)}</span></a></li>`,
  ).join('')
}

/** The full spec sheet, in the HTML so it is indexable; the modal shows a copy of it. */
const sheet = (s: StorageItem) => `
  <div class="card__sheet" hidden>
    <p class="eyebrow"><span class="eyebrow__num">${s.year}</span><b>${esc(s.family)}</b> ${esc(s.maker)}</p>
    <h4 class="modal__title">${esc(s.name)}</h4>
    <p class="modal__lead">${esc(s.lead)}</p>
    <dl class="specs">
      ${s.specs.map((x) => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}
    </dl>
    <p class="label">Materiales</p>
    <ul class="chips">${s.materials.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
    <p class="label">Cómo funciona</p>
    <ol class="steps steps--compact">${s.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ol>
    <blockquote class="fact"><span class="label">✺ Dato</span>${esc(s.fact)}</blockquote>
  </div>`

/** Structured data: the page as an article about these seven objects. */
export function renderJsonLd(siteUrl: string): string {
  const url = siteUrl || undefined
  const image = siteUrl ? `${siteUrl}og-image.jpg` : undefined
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${siteUrl}#website`, name: 'Shongo', url, inLanguage: 'es', creator: { '@id': `${siteUrl}#author` } },
      {
        '@type': 'Person',
        '@id': `${siteUrl}#author`,
        name: AUTHOR.fullName,
        alternateName: AUTHOR.name,
        jobTitle: AUTHOR.role,
        url: AUTHOR.portfolio,
        sameAs: AUTHOR.links.map((l) => l.href),
      },
      {
        '@type': 'Article',
        '@id': `${siteUrl}#article`,
        headline: 'Historia del almacenamiento: del disquete a la nube',
        alternativeHeadline: 'La chispa de la memoria',
        description:
          'La evolución del almacenamiento de datos en siete objetos: disquete, disco duro, CD-ROM, DVD, memoria USB y la nube.',
        inLanguage: 'es',
        image,
        url,
        isPartOf: { '@id': `${siteUrl}#website` },
        author: { '@id': `${siteUrl}#author` },
        publisher: { '@id': `${siteUrl}#author` },
        copyrightHolder: { '@id': `${siteUrl}#author` },
        copyrightYear: YEAR,
        datePublished: '2026-11-04',
        about: STORAGE.map((s) => ({ '@type': 'Thing', name: s.name, description: s.summary })),
      },
      {
        '@type': 'ItemList',
        name: 'Siete sistemas de almacenamiento',
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: STORAGE.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${s.name} (${s.year})`,
          url: `${siteUrl}#c-${s.id}`,
        })),
      },
    ],
  }
  return `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`
}

export function renderCards(): string {
  return STORAGE.map(
    (s, i) => `
<li class="card" data-id="${s.id}">
  <div class="card__media">
    <canvas class="card__canvas" data-shape="${s.id}" aria-hidden="true"></canvas>
    <span class="card__family">${esc(s.family)}</span>
    <span class="card__index">${num(i)}</span>
  </div>
  <div class="card__head">
    <h3 class="card__name">${esc(s.cardName)}</h3>
    <span class="card__year">${s.year}</span>
  </div>
  <p class="card__desc">${esc(s.summary)}</p>
  <button class="card__more" type="button" data-open="${s.id}" aria-haspopup="dialog">
    Ver ficha técnica<span class="sr-only"> de ${esc(s.cardName)}</span> <span aria-hidden="true">→</span>
  </button>${sheet(s)}
</li>`,
  ).join('')
}

const external = (href: string, body: string, cls: string, rel = 'noopener') =>
  `<a class="${cls}" href="${esc(href)}" target="_blank" rel="${rel}">${body}<span class="sr-only"> (se abre en una pestaña nueva)</span></a>`

/** The closing credits: who made it, where to find them, and the colophon. */
export function renderFooter(): string {
  const links = AUTHOR.links
    .map(
      (l) => `
          <li>${external(
            l.href,
            `<span class="footer__link-label">${esc(l.label)}</span><span class="footer__link-handle">${esc(l.handle)}</span><span class="footer__arrow" aria-hidden="true">↗</span>`,
            'footer__link',
            'noopener me',
          )}</li>`,
    )
    .join('')
  return `
      <div class="footer__credit">
        <div class="footer__intro">
          <p class="tag">Créditos <b>Concepto, diseño y código</b></p>
          <h2 class="footer__title" id="footer-title">Creado por <em>${esc(AUTHOR.name)}</em></h2>
          <p class="footer__role"><b>${esc(AUTHOR.role)}.</b> Diseño y desarrollo experiencias web y móviles donde el movimiento ayuda a contar la historia.</p>
        </div>
        <div class="footer__actions">
          ${external(
            AUTHOR.portfolio,
            `<span class="footer__cta-text"><small>Portafolio</small>Ver mi trabajo</span><span class="footer__cta-arrow" aria-hidden="true">↗</span>`,
            'footer__cta',
            'noopener author',
          )}
          <ul class="footer__links" aria-label="Redes de ${esc(AUTHOR.name)}">${links}
          </ul>
        </div>
      </div>
      <dl class="footer__colophon">
        <div><dt>Proyecto</dt><dd>Shongo / Memoria — Crónica 01</dd></div>
        <div><dt>Stack</dt><dd>Three.js · GSAP · Lenis · Vite</dd></div>
        <div><dt>Tipografía</dt><dd>Syne · Instrument Serif · Space Grotesk · JetBrains Mono</dd></div>
        <div><dt>Referencia</dt><dd>La creación de Adán, Michelangelo (c. 1512)</dd></div>
      </dl>
      <p class="footer__big">Shongo<em>/memoria</em></p>
      <div class="footer__bar">
        <p>© ${YEAR} ${esc(AUTHOR.fullName)}. Todos los derechos reservados.</p>
        <a class="footer__top" href="#inicio">Volver arriba <span aria-hidden="true">↑</span></a>
      </div>`
}
