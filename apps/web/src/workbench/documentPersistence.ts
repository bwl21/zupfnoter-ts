const DATABASE_NAME = 'zupfnoter.documents'
const DATABASE_VERSION = 1
const DOCUMENT_STORE = 'documents'
const CURRENT_DOCUMENT_KEY = 'current'

export const INDEXED_DB_DOCUMENT_MARKER = '__zupfnoter_document_in_indexeddb__'

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
