import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRenderController } from '../renderController'
import { renderWorkbenchPreviews } from '../renderPipeline'

vi.mock('../renderPipeline', () => ({ renderWorkbenchPreviews: vi.fn(() => ({ scoreSvg: 'fallback' })) }))
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

function setup() {
  const worker: Pick<Worker, 'onmessage' | 'postMessage' | 'terminate'> = {
    onmessage: null, postMessage: vi.fn(), terminate: vi.fn(),
  }
  const options = {
    createWorker: () => worker,
    readInput: () => ({ abcText: 'X:1\nK:C\nC', extractNr: 0 }),
    onResult: vi.fn(), onError: vi.fn(), onInfo: vi.fn(), onWarning: vi.fn(),
  }
  const controller = createRenderController(options)
  return { worker, options, controller,
    result: (id: number) => worker.onmessage?.call(worker as Worker, new MessageEvent('message', {
      data: { id, kind: 'result', result: { scoreSvg: String(id) } },
    })),
  }
}

describe('render controller', () => {
  it('rejects stale results already during the next debounce', () => {
    vi.useFakeTimers()
    const { controller, result, options } = setup()
    controller.start()
    controller.render()
    controller.schedule()
    result(1)
    expect(options.onResult).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    result(2)
    expect(options.onResult).toHaveBeenCalledWith({ scoreSvg: '2' })
    controller.dispose()
  })

  it('terminates the worker and prevents post-unmount timers and callbacks', () => {
    vi.useFakeTimers()
    const { controller, result, options, worker } = setup()
    controller.start()
    controller.render()
    controller.schedule()
    controller.dispose()
    result(1)
    vi.advanceTimersByTime(100)
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(worker.postMessage).toHaveBeenCalledOnce()
    expect(options.onResult).not.toHaveBeenCalled()
  })

  it('uses the same render pipeline when workers are unavailable', () => {
    const { options } = setup()
    const controller = createRenderController({ ...options, createWorker: () => { throw new Error('unavailable') } })
    controller.start()
    controller.render()
    expect(renderWorkbenchPreviews).toHaveBeenCalledWith('X:1\nK:C\nC', 0, options.readInput())
    expect(options.onResult).toHaveBeenCalledWith({ scoreSvg: 'fallback' })
    controller.dispose()
  })
})
