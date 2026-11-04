import { SHAPE_ORDER } from '../content/storage'
import { heroShape } from './hands'
import { cloudShape } from './cloud'
import { byteShape, objectShapeById, type Shape } from './shapes'
import type { TextMask } from './textmasks'
import { usbShape } from './usb'

export interface BuildRequest {
  n: number
  byte: TextMask
  usb: TextMask
}

/** Every point cloud of the page, in scroll order. Pure computation: runs in a worker. */
export function buildShapes({ n, byte, usb }: BuildRequest): Shape[] {
  return SHAPE_ORDER.map((id) =>
    id === 'hero' ? heroShape(n) : id === 'byte' ? byteShape(n, byte) : id === 'usb' ? usbShape(n, usb) : id === 'cloud' ? cloudShape(n) : objectShapeById(id, n),
  )
}

/** The typed arrays to transfer (not copy) back to the main thread. */
export function buffersOf(shapes: Shape[]): ArrayBuffer[] {
  const out: ArrayBuffer[] = []
  for (const s of shapes)
    for (const a of [s.pos, s.tone, s.shade, s.rgb]) if (a && !out.includes(a.buffer as ArrayBuffer)) out.push(a.buffer as ArrayBuffer)
  return out
}
