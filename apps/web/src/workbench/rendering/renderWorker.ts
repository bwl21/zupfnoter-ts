import { renderWorkbenchPreviews } from './renderPipeline'

export interface RenderWorkerRequest {
  id: number
  abcText: string
  extractNr: number
}

export interface RenderWorkerProgress {
  id: number
  kind: 'progress'
  message: string
}

export interface RenderWorkerPerf {
  id: number
  kind: 'perf'
  totalMs: number
  scoreMs: number
  modelMs: number
  sheetMs: number
  svgMs: number
}

export interface RenderWorkerResponse {
  id: number
  kind: 'result'
  result?: Awaited<ReturnType<typeof renderWorkbenchPreviews>>
  error?: string
}

type RenderWorkerMessage = RenderWorkerRequest | RenderWorkerProgress | RenderWorkerPerf | RenderWorkerResponse

self.onmessage = (event: MessageEvent<RenderWorkerRequest>) => {
  const { id, abcText, extractNr } = event.data
  const postProgress = (message: string): void => {
    const progress: RenderWorkerProgress = { id, kind: 'progress', message }
    self.postMessage(progress satisfies RenderWorkerMessage)
  }

  try {
    const startedAt = performance.now()
    postProgress(`worker: render extract ${extractNr}`)
    const result = renderWorkbenchPreviews(abcText, extractNr)
    const totalMs = performance.now() - startedAt
    postProgress(`worker: render complete in ${totalMs.toFixed(3)} ms`)
    const perf: RenderWorkerPerf = {
      id,
      kind: 'perf',
      totalMs,
      scoreMs: totalMs,
      modelMs: 0,
      sheetMs: 0,
      svgMs: 0,
    }
    self.postMessage(perf satisfies RenderWorkerMessage)
    const response: RenderWorkerResponse = { id, kind: 'result', result }
    self.postMessage(response satisfies RenderWorkerMessage)
  } catch (error) {
    const response: RenderWorkerResponse = {
      id,
      kind: 'result',
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response satisfies RenderWorkerMessage)
  }
}
