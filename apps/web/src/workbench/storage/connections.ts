import type { StorageConnection } from '@zupfnoter/types'

const CONNECTIONS_KEY = 'zupfnoter.storage.connections'

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

function toStorageConnection(value: unknown): StorageConnection | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  if (!(typeof record.id === 'string'
    && typeof record.providerId === 'string'
    && typeof record.label === 'string'
    && typeof record.configuration === 'object'
    && record.configuration !== null
    && (record.status === 'disconnected' || record.status === 'connecting' || record.status === 'connected' || record.status === 'planned'))) return undefined
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
