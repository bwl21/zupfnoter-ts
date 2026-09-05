import type { StorageConnection } from '@zupfnoter/types'
import type { StorageCommandState } from '@zupfnoter/types'

const CONNECTIONS_KEY = 'zupfnoter.storage.connections'
const CONTEXT_KEY = 'zupfnoter.storage.context'

/** Lädt ausschließlich nicht geheime Verbindungsmetadaten. */
export function loadStorageConnections(): StorageConnection[] {
  const raw = localStorage.getItem(CONNECTIONS_KEY)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((entry) => {
      const connection = toStorageConnection(entry)
      return connection === undefined ? [] : [connection]
    })
  } catch {
    return []
  }
}

export function saveStorageConnections(connections: StorageConnection[]): void {
  localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(connections))
}

export function createStorageConnection(providerId: string, label: string): StorageConnection {
  return {
    id: crypto.randomUUID(),
    providerId,
    label: label.trim() === '' ? providerId : label.trim(),
    rootPath: '',
    relativePath: '',
    readOnly: false,
    configuration: {},
    status: 'disconnected',
  }
}

/** Lädt den providerneutralen aktiven Speicher-Kontext. */
export function loadStorageContext(fallbackSystem = 'dropbox'): StorageCommandState {
  const fallback: StorageCommandState = {
    system: fallbackSystem,
    rootPath: '',
    path: '',
    loggedIn: false,
    pendingCandidates: [],
  }
  const raw = localStorage.getItem(CONTEXT_KEY)
  if (raw === null) return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return fallback
    const context = parsed as Record<string, unknown>
    if (typeof context.system !== 'string' || typeof context.path !== 'string') return fallback
    return {
      system: context.system,
      connectionId: typeof context.connectionId === 'string' ? context.connectionId : undefined,
      rootPath: typeof context.rootPath === 'string' ? context.rootPath : '',
      path: context.path,
      loggedIn: context.loggedIn === true,
      pendingCandidates: [],
    }
  } catch {
    return fallback
  }
}

/** Persistiert ausschließlich den providerneutralen aktiven Speicher-Kontext. */
export function saveStorageContext(state: StorageCommandState): void {
  localStorage.setItem(
    CONTEXT_KEY,
    JSON.stringify({
      system: state.system,
      connectionId: state.connectionId,
      rootPath: state.rootPath,
      path: state.path,
      loggedIn: state.loggedIn,
    }),
  )
}

/** Erzeugt den aktiven Kontext aus den Metadaten einer Verbindung. */
export function storageContextForConnection(connection: StorageConnection): StorageCommandState {
  return {
    system: connection.providerId,
    connectionId: connection.id,
    rootPath: connection.rootPath,
    path: connection.relativePath,
    loggedIn: connection.status === 'connected',
    pendingCandidates: [],
  }
}

function toStorageConnection(value: unknown): StorageConnection | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  if (
    !(
      typeof record.id === 'string' &&
      typeof record.providerId === 'string' &&
      typeof record.label === 'string' &&
      typeof record.configuration === 'object' &&
      record.configuration !== null &&
      (record.status === 'disconnected' ||
        record.status === 'connecting' ||
        record.status === 'connected' ||
        record.status === 'planned')
    )
  )
    return undefined
  return {
    id: record.id,
    providerId: record.providerId,
    label: record.label,
    rootPath: typeof record.rootPath === 'string' ? record.rootPath : '',
    relativePath: typeof record.relativePath === 'string' ? record.relativePath : '',
    readOnly: typeof record.readOnly === 'boolean' ? record.readOnly : false,
    configuration: record.configuration as Record<string, string>,
    status: record.status,
  }
}
