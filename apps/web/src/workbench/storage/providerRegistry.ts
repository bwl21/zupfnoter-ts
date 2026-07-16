import type { StorageConnection, StorageProviderDescriptor } from '@zupfnoter/types'
import type { StorageCommandState } from '@zupfnoter/core'

export interface StorageProviderAdapter {
  descriptor: StorageProviderDescriptor
  login(state: StorageCommandState): Promise<void>
  logout(state: StorageCommandState): Promise<void>
  list(state: StorageCommandState, recursive?: boolean): Promise<string[]>
  search(state: StorageCommandState, query: string): Promise<string[]>
  open(state: StorageCommandState, filename: string): Promise<string | undefined>
  save(state: StorageCommandState, filename: string, content: string): Promise<void>
  cleanup(state: StorageCommandState): Promise<void>
  listFolders(state: StorageCommandState, path: string): Promise<Array<{ name: string; path: string }>>
  removeConnection(connectionId: string): Promise<void>
}

export function createStorageProviderRegistry(adapters: StorageProviderAdapter[]): {
  descriptors: StorageProviderDescriptor[]
  adapterFor(state: StorageCommandState, connections: StorageConnection[]): StorageProviderAdapter
  adapterForConnection(connection: StorageConnection): StorageProviderAdapter | undefined
} {
  const byId = new Map(adapters.map((adapter) => [adapter.descriptor.id, adapter]))
  return {
    descriptors: adapters.map((adapter) => adapter.descriptor),
    adapterFor: (state, connections) => {
      const connection = connections.find((entry) => entry.id === state.connectionId)
      const providerId = connection?.providerId ?? state.system
      const adapter = byId.get(providerId)
      if (adapter === undefined) throw new Error(`Storage provider is not implemented: ${providerId}`)
      return adapter
    },
    adapterForConnection: (connection) => byId.get(connection.providerId),
  }
}
