import { renderWorkbenchPreviews, type WorkbenchRenderResult } from './renderPipeline'
import type {
  RenderWorkerRequest,
  RenderWorkerProgress,
  RenderWorkerPerf,
  RenderWorkerResponse,
} from './renderWorker'

type RenderInput = Omit<RenderWorkerRequest, 'id'>
type WorkerPort = Pick<Worker, 'onmessage' | 'postMessage' | 'terminate'>

/** Besitzt Worker, Request-Reihenfolge und Debounce; kennt keine Workbench-Stores. */
export function createRenderController(options: {
  createWorker: () => WorkerPort
  readInput: () => RenderInput
  onResult: (result: WorkbenchRenderResult) => void
  onError: (message: string) => void
  onInfo: (message: string) => void
  onWarning: (message: string) => void
}) {
  let worker: WorkerPort | undefined
  let requestId = 0
  let pendingId: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  function start(): void {
    if (disposed || worker !== undefined) return
    try {
      worker = options.createWorker()
      worker.onmessage = (
        event: MessageEvent<RenderWorkerProgress | RenderWorkerPerf | RenderWorkerResponse>,
      ) => {
        if (disposed || event.data?.id !== pendingId) return
        const message = event.data
        if (message.kind === 'progress') options.onInfo(message.message)
        if (message.kind === 'perf')
          options.onInfo(`worker: perf total ${message.totalMs.toFixed(3)} ms`)
        if (message.kind === 'result') {
          pendingId = undefined
          if (message.result !== undefined) options.onResult(message.result)
          if (message.error !== undefined) options.onError(message.error)
        }
      }
    } catch (error) {
      options.onWarning(
        `worker: unavailable: ${error instanceof Error ? error.message : String(error)}`,
      )
      worker = undefined
    }
  }

  function render(): void {
    if (disposed) return
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    const input = options.readInput()
    pendingId = ++requestId
    try {
      if (worker !== undefined) {
        worker.postMessage({ ...input, id: pendingId } satisfies RenderWorkerRequest)
      } else {
        options.onInfo(`worker: render extract ${input.extractNr}`)
        options.onResult(renderWorkbenchPreviews(input.abcText, input.extractNr, input))
        pendingId = undefined
        options.onInfo('worker: render complete in 0.000 sec')
      }
    } catch (error) {
      pendingId = undefined
      options.onError(error instanceof Error ? error.message : String(error))
    }
  }

  function schedule(delayMs = 100): void {
    if (disposed) return
    // Bereits unterwegs befindliche Ergebnisse gehören nicht mehr zum Dokument.
    pendingId = undefined
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(render, delayMs)
  }

  function dispose(): void {
    disposed = true
    pendingId = undefined
    if (timer !== undefined) clearTimeout(timer)
    worker?.terminate()
    worker = undefined
  }

  return { start, render, schedule, dispose }
}
