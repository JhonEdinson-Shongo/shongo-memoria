// Text drawn once on the main thread (it needs the page fonts), then handed to the
// shape worker as plain alpha masks. A few milliseconds of work; the heavy point
// sampling happens off the main thread.

export interface TextMask {
  w: number
  h: number
  /** One byte per pixel: the text's alpha. */
  alpha: Uint8Array
  /** Width of the bits row (byte mask only), to tell which digit a pixel belongs to. */
  bitsWidth?: number
}

export const BITS = '0 1 0 1 0 0 1 1'

function raster(w: number, h: number, draw: (g: CanvasRenderingContext2D) => number | void): TextMask {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.fillStyle = '#fff'
  const extra = draw(g)
  const rgba = g.getImageData(0, 0, w, h).data
  const alpha = new Uint8Array(w * h)
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]
  return { w, h, alpha, bitsWidth: typeof extra === 'number' ? extra : undefined }
}

export function rasterizeTexts() {
  const byte = raster(1024, 640, (g) => {
    g.textAlign = 'center'
    g.textBaseline = 'alphabetic'
    g.font = '800 430px "Syne", "Arial Black", sans-serif'
    g.fillText('S', 512, 400)
    g.font = '500 76px "JetBrains Mono", ui-monospace, monospace'
    g.fillText(BITS, 512, 580)
    return g.measureText(BITS).width
  })
  const usb = raster(512, 96, (g) => {
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '800 64px "Syne", "Arial Black", sans-serif'
    g.fillText('SHONGO', 256, 52)
  })
  return { byte, usb }
}
