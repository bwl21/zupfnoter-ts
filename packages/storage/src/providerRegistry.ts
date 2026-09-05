import type {
  StorageConnection,
  StorageDocument,
  StorageProviderDescriptor,
} from '@zupfnoter/types'
import type { StorageCommandState } from '@zupfnoter/core'

export interface StorageProviderAdapter {
  descriptor: StorageProviderDescriptor
  login(state: StorageCommandState): Promise<void>
  logout(state: StorageCommandState): Promise<void>
  list(state: StorageCommandState, recursive?: boolean): Promise<string[]>
  search(state: StorageCommandState, query: string): Promise<string[]>
  open(state: StorageCommandState, filename: string): Promise<string | undefined>
  save(state: StorageCommandState, filename: string, content: string | Blob): Promise<void>
  cleanup(state: StorageCommandState): Promise<void>
  listFolders(
    state: StorageCommandState,
    path: string,
  ): Promise<Array<{ name: string; path: string }>>
  listDocuments?(state: StorageCommandState): Promise<StorageDocument[]>
  openPreview?(state: StorageCommandState, path: string): Promise<Blob | undefined>
  removeConnection(connectionId: string): Promise<void>
  resumeLoginFromRedirect?(connectionId: string): Promise<boolean>
}

export function createStorageProviderRegistry(adapters: StorageProviderAdapter[]): {
  descriptors: StorageProviderDescriptor[]
  adapterFor(state: StorageCommandState, connections: StorageConnection[]): StorageProviderAdapter
  adapterForConnection(connection: StorageConnection): StorageProviderAdapter | undefined
  resumeLoginFromRedirect(
    connections: readonly StorageConnection[],
    preferredConnectionId?: string,
  ): Promise<StorageConnection | undefined>
} {
  const byId = new Map(adapters.map((adapter) => [adapter.descriptor.id, adapter]))
  return {
    descriptors: adapters.map((adapter) => adapter.descriptor),
    adapterFor: (state, connections) => {
      const connection = connections.find((entry) => entry.id === state.connectionId)
      const providerId = connection?.providerId ?? state.system
      const adapter = byId.get(providerId)
      if (adapter === undefined)
        throw new Error(`Storage provider is not implemented: ${providerId}`)
      return adapter
    },
    adapterForConnection: (connection) => byId.get(connection.providerId),
    resumeLoginFromRedirect: async (connections, preferredConnectionId) => {
      const orderedConnections = [...connections].sort((left, right) => {
        if (left.id === preferredConnectionId) return -1
        if (right.id === preferredConnectionId) return 1
        return 0
      })
      for (const connection of orderedConnections) {
        const resume = byId.get(connection.providerId)?.resumeLoginFromRedirect
        if (resume !== undefined && (await resume(connection.id))) return connection
      }
      return undefined
    },
  }
}
