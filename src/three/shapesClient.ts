import type { BuildRequest } from './build'
import type { Shape } from './shapes'

/** Ask the worker for the point clouds; fall back to the main thread if workers fail. */
export function requestShapes(req: BuildRequest): Promise<Shape[]> {
  const local = () => import('./build').then((m) => m.buildShapes(req))
  try {
    const worker = new Worker(new URL('./shapes.worker.ts', import.meta.url), { type: 'module' })
    return new Promise((resolve) => {
      worker.onmessage = (e: MessageEvent<Shape[]>) => {
        worker.terminate()
        resolve(e.data)
      }
      worker.onerror = () => {
        worker.terminate()
        resolve(local())
      }
      worker.postMessage(req)
    })
  } catch {
    return local()
  }
}
