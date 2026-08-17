import type { InjectionKey } from 'vue'

const DATABASE_NAME = 'zupfnoter.documents'
const DATABASE_VERSION = 1
const DOCUMENT_STORE = 'documents'
const CURRENT_DOCUMENT_KEY = 'current'
const SAVED_DOCUMENT_KEY_PREFIX = 'saved:'

export const INDEXED_DB_DOCUMENT_MARKER = '__zupfnoter_document_in_indexeddb__'
export const CURRENT_DOCUMENT_LOCAL_STORAGE_KEY = 'zupfnoter.abc.current'
export const INITIAL_DOCUMENT_KEY: InjectionKey<string | undefined> = Symbol('zupfnoter.initial-document')

function openDocumentDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB ist in diesem Browser nicht verfügbar.'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DOCUMENT_STORE)) {
        request.result.createObjectStore(DOCUMENT_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB konnte nicht geöffnet werden.'))
  })
}

export async function saveCurrentDocumentToIndexedDb(documentText: string): Promise<void> {
  const database = await openDocumentDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(DOCUMENT_STORE, 'readwrite')
      transaction.objectStore(DOCUMENT_STORE).put(documentText, CURRENT_DOCUMENT_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Dokument konnte nicht in IndexedDB gespeichert werden.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Speichern in IndexedDB wurde abgebrochen.'))
    })
  } finally {
    database.close()
  }
}

export async function loadCurrentDocumentFromIndexedDb(): Promise<string | undefined> {
  const database = await openDocumentDatabase()
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const transaction = database.transaction(DOCUMENT_STORE, 'readonly')
      const request = transaction.objectStore(DOCUMENT_STORE).get(CURRENT_DOCUMENT_KEY)
      request.onsuccess = () => {
        const value: unknown = request.result
        resolve(typeof value === 'string' ? value : undefined)
      }
      request.onerror = () => reject(request.error ?? new Error('Dokument konnte nicht aus IndexedDB geladen werden.'))
    })
  } finally {
    database.close()
  }
}

export async function saveSavedDocumentSnapshot(snapshotKey: string, documentText: string): Promise<void> {
  const database = await openDocumentDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(DOCUMENT_STORE, 'readwrite')
      transaction.objectStore(DOCUMENT_STORE).put(documentText, `${SAVED_DOCUMENT_KEY_PREFIX}${snapshotKey}`)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Gespeicherter Versionsstand konnte nicht in IndexedDB gespeichert werden.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Speichern des Versionsstands wurde abgebrochen.'))
    })
  } finally {
    database.close()
  }
}

export async function loadSavedDocumentSnapshot(snapshotKey: string): Promise<string | undefined> {
  const database = await openDocumentDatabase()
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const transaction = database.transaction(DOCUMENT_STORE, 'readonly')
      const request = transaction.objectStore(DOCUMENT_STORE).get(`${SAVED_DOCUMENT_KEY_PREFIX}${snapshotKey}`)
      request.onsuccess = () => {
        const value: unknown = request.result
        resolve(typeof value === 'string' ? value : undefined)
      }
      request.onerror = () => reject(request.error ?? new Error('Gespeicherter Versionsstand konnte nicht aus IndexedDB geladen werden.'))
    })
  } finally {
    database.close()
  }
}

function isUsableDocumentText(value: string): boolean {
  return value.trim() !== '' && /^X:\s*\S/m.test(value)
}

export async function loadInitialDocument(): Promise<string | undefined> {
  try {
    const indexedDocument = await loadCurrentDocumentFromIndexedDb()
    if (indexedDocument !== undefined && isUsableDocumentText(indexedDocument)) {
      return indexedDocument
    }
  } catch {
    // Fall back to the legacy LocalStorage representation below.
  }

  if (typeof localStorage === 'undefined') return undefined
  const localDocument = localStorage.getItem(CURRENT_DOCUMENT_LOCAL_STORAGE_KEY)
  if (localDocument === null || localDocument === INDEXED_DB_DOCUMENT_MARKER) return undefined
  return isUsableDocumentText(localDocument) ? localDocument : undefined
}
