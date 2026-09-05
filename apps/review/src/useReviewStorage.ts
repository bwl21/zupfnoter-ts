import { computed, ref, onMounted, onScopeDispose } from 'vue'
import {
  createDropboxProvider,
  createStorageConnection,
  createStorageProviderRegistry,
  loadStorageConnections,
  loadStorageContext,
  removeDropboxConnection,
  resumeDropboxLoginFromRedirect,
  saveStorageConnections,
  saveStorageContext,
  storageContextForConnection,
} from '@zupfnoter/storage'
import type { StorageConnection, StorageDocument } from '@zupfnoter/types'

type StorageSheetView = 'documents' | 'connections'

/** Review-Speicherablauf; die Dokumentübernahme ist ein expliziter Callback. */
export function useReviewStorage(renderDocument: (abcText: string) => void) {
  let disposed = false
  let requestVersion = 0
  onScopeDispose(() => {
    disposed = true
    requestVersion += 1
  })
  const storageOpen = ref(false)
  const storageSheetView = ref<StorageSheetView>('documents')
  const storageConnections = ref<StorageConnection[]>(loadStorageConnections())
  const initialStorageContext = loadStorageContext()
  const activeStorageConnectionId = ref(
    storageConnections.value.some(
      (connection) => connection.id === initialStorageContext.connectionId,
    )
      ? initialStorageContext.connectionId
      : storageConnections.value[0]?.id,
  )
  const storageDocuments = ref<StorageDocument[]>([])
  const storageQuery = ref('')
  const storageLoading = ref(false)
  const storageError = ref('')
  const dropboxProvider = createDropboxProvider({
    onTokenRefreshed: (connectionId) => updateConnectionStatus(connectionId, 'connected'),
  })
  const storageProviderRegistry = createStorageProviderRegistry([
    {
      descriptor: { id: 'dropbox', label: 'Dropbox', availability: 'available' },
      login: (state) => dropboxProvider.login(state),
      logout: (state) => dropboxProvider.logout(state),
      list: (state, recursive) => dropboxProvider.list(state, recursive),
      search: (state, query) => dropboxProvider.search(state, query),
      open: (state, filename) => dropboxProvider.open(state, filename),
      save: (state, filename, content) => dropboxProvider.save(state, filename, content),
      cleanup: (state) => dropboxProvider.cleanup(state),
      listFolders: (state, path) => dropboxProvider.listFolders(state, path),
      listDocuments: (state) => dropboxProvider.listDocuments(state),
      openPreview: (state, path) => dropboxProvider.openPreview(state, path),
      removeConnection: async (connectionId) => removeDropboxConnection(connectionId),
      resumeLoginFromRedirect: (connectionId) => resumeDropboxLoginFromRedirect(connectionId),
    },
  ])

  const activeStorageConnection = computed(() =>
    storageConnections.value.find(
      (connection) => connection.id === activeStorageConnectionId.value,
    ),
  )
  const filteredStorageDocuments = computed(() => {
    const query = storageQuery.value.trim().toLocaleLowerCase()
    if (query === '') return storageDocuments.value
    return storageDocuments.value.filter((entry) => entry.name.toLocaleLowerCase().includes(query))
  })
  function persistConnections(): void {
    saveStorageConnections(storageConnections.value)
  }

  function activateStorageConnection(connection: StorageConnection): void {
    if (activeStorageConnectionId.value !== connection.id) {
      requestVersion += 1
      storageLoading.value = false
    }
    activeStorageConnectionId.value = connection.id
    saveStorageContext(storageContextForConnection(connection))
  }

  function updateConnectionStatus(connectionId: string, status: StorageConnection['status']): void {
    if (disposed) return
    const connection = storageConnections.value.find((entry) => entry.id === connectionId)
    if (connection === undefined) return
    connection.status = status
    persistConnections()
    if (connection.id === activeStorageConnectionId.value) activateStorageConnection(connection)
  }

  async function connectStorage(connection?: StorageConnection): Promise<void> {
    const target = connection ?? createStorageConnection('dropbox', 'Dropbox')
    if (connection === undefined) storageConnections.value.push(target)
    activateStorageConnection(target)
    updateConnectionStatus(target.id, 'connecting')
    const adapter = storageProviderRegistry.adapterForConnection(target)
    if (adapter === undefined) throw new Error(`${target.providerId} ist noch nicht verfügbar.`)
    await adapter.login(storageContextForConnection(target))
  }

  async function loadStorageDocuments(connection = activeStorageConnection.value): Promise<void> {
    if (connection === undefined || connection.status !== 'connected') return
    const request = ++requestVersion
    storageLoading.value = true
    storageError.value = ''
    try {
      const adapter = storageProviderRegistry.adapterForConnection(connection)
      if (adapter?.listDocuments === undefined)
        throw new Error(`${connection.providerId} unterstützt keine Dateiliste.`)
      const documents = await adapter.listDocuments(storageContextForConnection(connection))
      if (disposed || request !== requestVersion) return
      storageDocuments.value = documents
    } catch (error) {
      if (disposed || request !== requestVersion) return
      storageError.value = error instanceof Error ? error.message : String(error)
      if (storageError.value.includes('not logged in'))
        updateConnectionStatus(connection.id, 'disconnected')
    } finally {
      if (!disposed && request === requestVersion) storageLoading.value = false
    }
  }

  async function openStorage(): Promise<void> {
    storageSheetView.value = 'documents'
    storageOpen.value = true
    await loadStorageDocuments()
  }

  function showStorageConnections(): void {
    storageSheetView.value = 'connections'
  }

  function showStorageDocuments(): void {
    storageSheetView.value = 'documents'
  }

  async function selectStorageConnection(connection: StorageConnection): Promise<void> {
    activateStorageConnection(connection)
    storageDocuments.value = []
    if (connection.status === 'connected') await loadStorageDocuments(connection)
    storageSheetView.value = 'documents'
  }

  async function disconnectStorage(connection: StorageConnection): Promise<void> {
    const request = ++requestVersion
    storageLoading.value = true
    try {
      const adapter = storageProviderRegistry.adapterForConnection(connection)
      if (adapter === undefined)
        throw new Error(`${connection.providerId} ist noch nicht verfügbar.`)
      await adapter.logout(storageContextForConnection(connection))
      if (disposed || request !== requestVersion) return
      updateConnectionStatus(connection.id, 'disconnected')
      storageDocuments.value = []
    } finally {
      if (!disposed && request === requestVersion) storageLoading.value = false
    }
  }

  async function openStorageDocument(storageDocument: StorageDocument): Promise<void> {
    const connection = activeStorageConnection.value
    if (connection === undefined) return
    const request = ++requestVersion
    storageLoading.value = true
    storageError.value = ''
    try {
      const adapter = storageProviderRegistry.adapterForConnection(connection)
      if (adapter === undefined)
        throw new Error(`${connection.providerId} ist noch nicht verfügbar.`)
      const content = await adapter.open(
        storageContextForConnection(connection),
        storageDocument.path,
      )
      if (disposed || request !== requestVersion) return
      if (content === undefined) throw new Error('Die ABC-Datei wurde nicht gefunden.')
      renderDocument(content)
      storageOpen.value = false
    } catch (error) {
      if (disposed || request !== requestVersion) return
      storageError.value = error instanceof Error ? error.message : String(error)
    } finally {
      if (!disposed && request === requestVersion) storageLoading.value = false
    }
  }

  onMounted(async () => {
    try {
      const connection = await storageProviderRegistry.resumeLoginFromRedirect(
        storageConnections.value,
        activeStorageConnectionId.value,
      )
      if (disposed) return
      if (connection !== undefined) {
        activateStorageConnection(connection)
        updateConnectionStatus(connection.id, 'connected')
        storageOpen.value = true
        await loadStorageDocuments(connection)
      }
    } catch (error) {
      if (disposed) return
      storageError.value = error instanceof Error ? error.message : String(error)
      const connectionId = activeStorageConnectionId.value
      if (connectionId !== undefined) updateConnectionStatus(connectionId, 'disconnected')
    }
  })

  return {
    storageOpen,
    storageSheetView,
    storageConnections,
    storageDocuments,
    storageQuery,
    storageLoading,
    storageError,
    activeStorageConnectionId,
    activeStorageConnection,
    filteredStorageDocuments,
    openStorage,
    loadStorageDocuments,
    showStorageConnections,
    showStorageDocuments,
    selectStorageConnection,
    connectStorage,
    disconnectStorage,
    openStorageDocument,
  }
}
