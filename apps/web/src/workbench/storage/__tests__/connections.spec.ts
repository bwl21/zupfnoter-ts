import { beforeEach, describe, expect, it } from 'vitest'

import { createStorageConnection, loadStorageConnections, saveStorageConnections } from '../connections'
import { createStorageProviderRegistry, type StorageProviderAdapter } from '../providerRegistry'

describe('storage connections', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists multiple named connections across a reload', () => {
    const connections = [
      createStorageConnection('dropbox', 'Privat'),
      createStorageConnection('dropbox', 'Verein'),
      createStorageConnection('dropbox', 'Unterricht'),
      createStorageConnection('dropbox', 'Archiv'),
      createStorageConnection('dropbox', 'Projekt'),
    ]
    saveStorageConnections(connections)

    expect(loadStorageConnections()).toEqual(connections)
    expect(loadStorageConnections().every((connection) => connection.rootPath === '' && connection.readOnly === false)).toBe(true)
  })

  it('migrates pre-root connections to the provider root with write access', () => {
    localStorage.setItem('zupfnoter.storage.connections', JSON.stringify([{
      id: 'legacy', providerId: 'dropbox', label: 'Alt', configuration: {}, status: 'connected',
    }]))

    expect(loadStorageConnections()).toEqual([{
      id: 'legacy', providerId: 'dropbox', label: 'Alt', rootPath: '', relativePath: '', readOnly: false, configuration: {}, status: 'connected',
    }])
  })

  it('dispatches through the adapter of the active connection', async () => {
    const calls: string[] = []
    const createAdapter = (id: string): StorageProviderAdapter => ({
      descriptor: { id, label: id, availability: 'available' },
      login: async () => { calls.push(`${id}:login`) },
      logout: async () => undefined,
      list: async () => [],
      search: async () => [],
      open: async () => undefined,
      save: async () => undefined,
      cleanup: async () => undefined,
      listFolders: async () => [],
      removeConnection: async () => undefined,
    })
    const registry = createStorageProviderRegistry([createAdapter('dropbox'), createAdapter('nextcloud')])
    const connection = createStorageConnection('nextcloud', 'Server')
    const state = { system: 'nextcloud', connectionId: connection.id, path: '', loggedIn: false, pendingCandidates: [] }

    await registry.adapterFor(state, [connection]).login(state)

    expect(calls).toEqual(['nextcloud:login'])
  })
})
