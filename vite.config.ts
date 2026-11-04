import { defineConfig } from 'vite'
import { AUTHOR } from './src/content/author.ts'
import { renderCards, renderChapters, renderFooter, renderJsonLd, renderRail } from './src/content/render.ts'

// The public URL (e.g. https://user.github.io/repo/). The GitHub Pages workflow passes it
// in as SITE_URL; locally it is empty and the absolute-URL tags are simply left out.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const SITE_URL = env.SITE_URL ? env.SITE_URL.replace(/\/?$/, '/') : ''
const TITLE = 'Historia del almacenamiento: del disquete a la nube · Shongo'
const DESCRIPTION =
  'La evolución del almacenamiento de datos en siete objetos: disquete, disco duro, CD-ROM, DVD, memoria USB y la nube. Cómo funciona cada uno, contado en 3D.'

function seoTags() {
  const image = SITE_URL ? `${SITE_URL}og-image.jpg` : './og-image.jpg'
  const tags = [
    SITE_URL && `<link rel="canonical" href="${SITE_URL}" />`,
    `<meta name="author" content="${AUTHOR.fullName}" />`,
    `<link rel="author" href="${AUTHOR.portfolio}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:locale" content="es_CO" />`,
    `<meta property="og:site_name" content="Shongo" />`,
    `<meta property="og:title" content="${TITLE}" />`,
    `<meta property="og:description" content="${DESCRIPTION}" />`,
    SITE_URL && `<meta property="og:url" content="${SITE_URL}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Una mano robótica y una humana a punto de tocarse, hechas de partículas." />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${TITLE}" />`,
    `<meta name="twitter:description" content="${DESCRIPTION}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    renderJsonLd(SITE_URL),
  ]
  return tags.filter(Boolean).join('\n    ')
}

// `base: './'` keeps every asset path relative, so the same build works on
// https://<user>.github.io/<repo>/ and on a custom domain without changes.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  worker: { format: 'es' },
  plugins: [
    {
      // The chapters, the timeline rail, the cards (with their spec sheets) and the SEO
      // tags are written into the HTML at build time: real, indexable HTML.
      name: 'shongo-content',
      transformIndexHtml(html) {
        return html
          .replace('<!--SEO-->', seoTags())
          .replace('<!--CHAPTERS-->', renderChapters())
          .replace('<!--RAIL-->', renderRail())
          .replace('<!--CARDS-->', renderCards())
          .replace('<!--FOOTER-->', renderFooter())
      },
      generateBundle() {
        const robots = ['User-agent: *', 'Allow: /', SITE_URL && `Sitemap: ${SITE_URL}sitemap.xml`].filter(Boolean).join('\n')
        this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots}\n` })
        if (SITE_URL)
          this.emitFile({
            type: 'asset',
            fileName: 'sitemap.xml',
            source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`,
          })
      },
    },
  ],
})
