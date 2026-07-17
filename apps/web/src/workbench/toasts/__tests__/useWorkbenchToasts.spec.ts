import { afterEach, describe, expect, it, vi } from 'vitest'

import { useWorkbenchToasts } from '../useWorkbenchToasts'

describe('useWorkbenchToasts', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('surfaces diagnostics without ABC position exactly once', () => {
    vi.useFakeTimers()

    const { toasts, syncDiagnostics } = useWorkbenchToasts()
    const diagnostic = {
      severity: 'error' as const,
      message: 'Layout failed without source anchor',
      source: 'harpnotes-layout',
    }

    syncDiagnostics([diagnostic])
    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0]?.title).toBe('harpnotes-layout')
    expect(toasts.value[0]?.message).toBe('Layout failed without source anchor')

    syncDiagnostics([diagnostic])
    expect(toasts.value).toHaveLength(1)
  })

  it('shows an explicit information toast', () => {
    vi.useFakeTimers()
    const { toasts, pushToast } = useWorkbenchToasts()

    pushToast({
      severity: 'info',
      title: 'Datei',
      message: 'Öffnen wird mit Phase 5.6 ergänzt.',
    })

    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0]).toMatchObject({
      severity: 'info',
      title: 'Datei',
    })
  })

  it('keeps persistent errors visible until they are dismissed', () => {
    vi.useFakeTimers()
    const { toasts, pushToast } = useWorkbenchToasts()

    pushToast({
      severity: 'danger',
      title: 'Speichern nicht möglich',
      message: 'Dropbox access token expired',
      persistent: true,
    })
    vi.advanceTimersByTime(10_000)

    expect(toasts.value).toHaveLength(1)
    expect(toasts.value[0]?.persistent).toBe(true)
  })
})
