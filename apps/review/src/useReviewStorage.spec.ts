import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageConnection, StorageDocument } from '@zupfnoter/types'
import { useReviewStorage } from './useReviewStorage'

const provider = vi.hoisted(() => ({ listDocuments: vi.fn(), open: vi.fn() }))
const connections: StorageConnection[] = ['one', 'two'].map((id) => ({
  id, label: id, providerId: 'dropbox', rootPath: '', relativePath: '',
  readOnly: true, configuration: {}, status: 'connected',
}))
vi.mock('@zupfnoter/storage', async (original) => ({
  ...await original<typeof import('@zupfnoter/storage')>(),
  loadStorageConnections: () => structuredClone(connections),
  loadStorageContext: () => ({ connectionId: 'one' }),
  saveStorageConnections: vi.fn(), saveStorageContext: vi.fn(),
  createStorageProviderRegistry: () => ({
    adapterForConnection: () => provider,
    resumeLoginFromRedirect: async () => undefined,
  }),
}))

function setup() {
  const render = vi.fn()
  let controller: ReturnType<typeof useReviewStorage> | undefined
  const wrapper = mount(defineComponent({
    setup() { controller = useReviewStorage(render); return () => null },
  }))
  if (controller === undefined) throw new Error('Controller not mounted')
  return { wrapper, controller, render }
}

beforeEach(() => { vi.clearAllMocks() })

describe('Review storage lifecycle', () => {
  it('ignores an old connection list after switching connections', async () => {
    let resolveOld: ((documents: StorageDocument[]) => void) | undefined
    provider.listDocuments.mockImplementationOnce(() => new Promise<StorageDocument[]>((resolve) => { resolveOld = resolve }))
    provider.listDocuments.mockResolvedValueOnce([{ name: 'new.abc' }])
    const { wrapper, controller } = setup()
    const old = controller.loadStorageDocuments()
    const second = controller.storageConnections.value[1]
    if (second === undefined) throw new Error('Missing second connection')
    await controller.selectStorageConnection(second)
    resolveOld?.([{ name: 'old.abc', path: 'old.abc', previewPdfPaths: [], previewHtmlPaths: [] }])
    await old
    expect(controller.storageDocuments.value).toEqual([{ name: 'new.abc' }])
    expect(controller.storageLoading.value).toBe(false)
    wrapper.unmount()
  })

  it('does not replace the document after unmount', async () => {
    let resolveOpen: ((abc: string) => void) | undefined
    provider.open.mockImplementationOnce(() => new Promise<string>((resolve) => { resolveOpen = resolve }))
    const { wrapper, controller, render } = setup()
    const opening = controller.openStorageDocument({ name: 'test.abc', path: 'test.abc', previewPdfPaths: [], previewHtmlPaths: [] })
    wrapper.unmount()
    resolveOpen?.('X:1\nK:C\nC')
    await opening
    expect(render).not.toHaveBeenCalled()
  })
})
