// Builds the point clouds off the main thread, so scrolling and input stay responsive.
import { buildShapes, buffersOf, type BuildRequest } from './build'

addEventListener('message', (e: MessageEvent<BuildRequest>) => {
  const shapes = buildShapes(e.data)
  ;(self as unknown as { postMessage(m: unknown, t: Transferable[]): void }).postMessage(shapes, buffersOf(shapes))
})
