# Shongo · La chispa de la memoria

Una crónica del almacenamiento, del disquete a la nube, contada con una sola nube de
partículas que cambia de forma mientras haces scroll.

**Stack:** Vite + TypeScript, Three.js (shaders propios), GSAP (ScrollTrigger, SplitText) y Lenis.
Despliegue en GitHub Pages con GitHub Actions.

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tipa con tsc y genera dist/
npm run preview   # sirve dist/ tal como quedará publicado
```

`?theme=dark` o `?theme=light` en la URL fuerza un tema (útil para compartir o revisar).

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube este proyecto a la rama `main`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada push a `main` ejecuta `.github/workflows/deploy.yml`, que compila y publica `dist/`.

`vite.config.ts` usa `base: './'`, así que funciona igual en `usuario.github.io/repo/` y
en un dominio propio, sin cambiar nada.

## SEO y rendimiento

- **URL pública:** el workflow pasa `SITE_URL` (la URL de GitHub Pages) al build. Con ella se
  generan la URL canónica, Open Graph / Twitter, el JSON-LD, `robots.txt` y `sitemap.xml`.
  Para probarlo en local: `SITE_URL=https://usuario.github.io/repo/ npm run build`.
- **Contenido indexable:** capítulos, tarjetas y fichas técnicas completas se escriben en el
  HTML al compilar (`src/content/render.ts`); la modal muestra una copia de la ficha.
- **Datos estructurados:** `WebSite` + `Article` + `ItemList` (los siete objetos).
- **Imagen social:** `public/og-image.jpg` (1200×630) e iconos en `public/`.
- **Fuentes propias** (`@fontsource`, subconjunto latino) con respaldos ajustados en métricas,
  para que el cambio de fuente no mueva el layout (CLS).
- **Carga:** la portada se anima solo con CSS (el título nunca se oculta → LCP inmediato);
  Three.js va en un chunk aparte y las nubes de puntos se calculan en un Web Worker
  (`src/three/shapes.worker.ts`).

## Cómo está armado

```
src/
  content/storage.ts   ← todo el texto: capítulos, tarjetas y fichas técnicas
  content/author.ts    ← autoría: nombre, portafolio y redes (footer, meta author y JSON-LD)
  content/render.ts    ← genera el HTML de capítulos, rail, tarjetas y footer al compilar
  three/shapes.ts      ← convierte cada objeto en N puntos (y la «S» del prólogo)
  three/hands.ts       ← la portada: mano humana y mano robótica (campos de distancia)
  three/usb.ts         ← la memoria USB sólida
  three/cloud.ts       ← la nube (volumen de vapor) sobre racks de servidores
  three/sdf.ts         ← primitivas y muestreo de superficies
  three/shapes.worker.ts ← calcula todas las formas fuera del hilo principal
  three/shaders.ts     ← el morph en GPU: cada punto viaja de la forma A a la B
  three/stage.ts       ← escena, tema, puntero, chispa entre los dedos
  three/palette.ts     ← pigmentos de cada tema (también para las miniaturas)
  ui/scroll.ts         ← Lenis + una línea de tiempo GSAP medida en píxeles de scroll
  ui/carousel.ts       ← carrusel con scroll nativo, botones y arrastre
  ui/modal.ts          ← ficha técnica en <dialog>
  ui/sketch.ts         ← miniaturas 2D de las mismas nubes de puntos
  styles/main.css      ← textura de lienzo, layouts, temas
```

### Agregar un capítulo

1. Añade el objeto en `STORAGE` (`src/content/storage.ts`) y su id en `SHAPE_ORDER`.
2. Escribe su forma en `src/three/shapes.ts` con las primitivas de `kit()`
   (aristas, caras, anillos, esferas) y regístrala en `OBJECTS`.
3. Elige `layout`: `right` (modelo a la derecha), `left` o `top` (modelo arriba, texto abajo).

### Cómo funciona el morph

Todas las formas tienen exactamente N puntos, ordenados de izquierda a derecha. El
vertex shader recibe la posición del punto en la forma actual y en la siguiente, y lo
mueve con un retraso propio y un remolino a mitad de camino. ScrollTrigger solo anima
un número, `morph`. Por ejemplo, 2,5 significa «a mitad entre la forma 2 y la 3».

## Créditos

- Brazo humano: detalle de *La creación de Adán*, Michelangelo Buonarroti (c. 1512). Dominio público, vía
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Michelangelo_-_Creation_of_Adam_(cropped).jpg).
- Tipografías: Syne, Instrument Serif, Space Grotesk, JetBrains Mono (Google Fonts, OFL).
- El brazo robótico se genera por código (`robotParts` en `src/three/hands.ts`): carcasas redondeadas, articulaciones oscuras y contorno infrarrojo.
