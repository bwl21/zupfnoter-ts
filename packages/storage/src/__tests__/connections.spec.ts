import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { StorageConnection } from '@zupfnoter/types'

import { loadStorageContext, saveStorageContext } from '../connections.js'
import { createStorageProviderRegistry, type StorageProviderAdapter } from '../providerRegistry.js'

function connection(id: string, providerId: string): StorageConnection {
  return {
    id,
    providerId,
    label: id,
    rootPath: 'Noten',
    relativePath: 'Archiv',
    readOnly: true,
    configuration: {},
    status: 'connected',
  }
}

function adapter(
  providerId: string,
  resumeLoginFromRedirect: (connectionId: string) => Promise<boolean>,
): StorageProviderAdapter {
  return {
    descriptor: { id: providerId, label: providerId, availability: 'available' },
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
    search: vi.fn(async () => []),
    open: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    cleanup: vi.fn(async () => undefined),
    listFolders: vi.fn(async () => []),
    removeConnection: vi.fn(async () => undefined),
    resumeLoginFromRedirect,
  }
}

describe('storage connection strategy', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    })
  })

  it('persists and restores the provider-neutral active context', () => {
    saveStorageContext({
      system: 'dropbox',
      connectionId: 'private',
      rootPath: 'Noten',
      path: 'Archiv',
      loggedIn: true,
      pendingCandidates: ['not-persisted'],
    })

    expect(loadStorageContext()).toEqual({
      system: 'dropbox',
      connectionId: 'private',
      rootPath: 'Noten',
      path: 'Archiv',
      loggedIn: true,
      pendingCandidates: [],
    })
  })

  it('resumes OAuth through the provider of the preferred active connection', async () => {
    const firstResume = vi.fn(async () => false)
    const preferredResume = vi.fn(async () => true)
    const registry = createStorageProviderRegistry([
      adapter('first', firstResume),
      adapter('preferred', preferredResume),
    ])
    const first = connection('first-id', 'first')
    const preferred = connection('preferred-id', 'preferred')

    await expect(
      registry.resumeLoginFromRedirect([first, preferred], preferred.id),
    ).resolves.toEqual(preferred)
    expect(preferredResume).toHaveBeenCalledWith(preferred.id)
    expect(firstResume).not.toHaveBeenCalled()
  })
})
