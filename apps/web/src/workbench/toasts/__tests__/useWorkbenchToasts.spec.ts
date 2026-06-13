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
})
