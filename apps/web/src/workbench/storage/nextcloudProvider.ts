import type { StorageCommandState } from '@zupfnoter/core'
import type { StorageDocument } from '@zupfnoter/types'

interface NextcloudCredentials {
  serverUrl: string
  username: string
  password: string
}

interface NextcloudProviderOptions {
  onConnected?: (connectionId: string) => void
}

export interface NextcloudProvider {
  system: string
  login(state?: StorageCommandState): Promise<void>
  logout(state?: StorageCommandState): Promise<void>
  list(path: StorageCommandState, recursive?: boolean): Promise<string[]>
  search(path: StorageCommandState, query: string): Promise<string[]>
  open(path: StorageCommandState, filename: string): Promise<string | undefined>
  save(path: StorageCommandState, filename: string, content: string | Blob): Promise<void>
  cleanup(state?: StorageCommandState): Promise<void>
  listFolders(state: StorageCommandState, path: string): Promise<Array<{ name: string; path: string }>>
  listDocuments(state: StorageCommandState): Promise<StorageDocument[]>
  openPreview(state: StorageCommandState, path: string): Promise<Blob | undefined>
  removeConnection(connectionId: string): Promise<void>
}

const credentialsByConnection = new Map<string, NextcloudCredentials>()

export function createNextcloudProvider(options: NextcloudProviderOptions = {}): NextcloudProvider {
  return {
    system: 'nextcloud',
    async login(state?: StorageCommandState): Promise<void> {
      const connectionId = connectionKey(state)
      const serverUrlInput = window.prompt('Nextcloud-Server-URL', 'https://cloud.example.org')
      const usernameInput = window.prompt('Nextcloud-Benutzername')
      const passwordInput = window.prompt('Nextcloud-App-Passwort (nicht das normale Passwort)')
      const serverUrl = normalizeServerUrl(serverUrlInput ?? '')
      const username = usernameInput?.trim() ?? ''
      const password = passwordInput ?? ''
      const validationProblems: string[] = []

      if (serverUrlInput === null) {
        validationProblems.push('• Server-URL: Eingabe abgebrochen.')
      } else if (serverUrlInput.trim() === '') {
        validationProblems.push('• Server-URL: Es wurde keine URL eingegeben.')
      } else if (serverUrl === '') {
        validationProblems.push('• Server-URL: Ungültig. Bitte die vollständige Adresse mit http:// oder https:// eingeben, zum Beispiel https://cloud.example.org.')
      }
      if (usernameInput === null) {
        validationProblems.push('• Benutzername: Eingabe abgebrochen.')
      } else if (username === '') {
        validationProblems.push('• Benutzername: Es wurde kein Benutzername eingegeben. Verwende den tatsächlichen Nextcloud-Loginnamen, nicht zwingend den Anzeigenamen oder die E-Mail-Adresse.')
      }
      if (passwordInput === null) {
        validationProblems.push('• App-Passwort: Eingabe abgebrochen.')
      } else if (password === '') {
        validationProblems.push('• App-Passwort: Es wurde kein App-Passwort eingegeben. Verwende ein in Nextcloud erzeugtes App-Passwort, nicht das normale Konto-Passwort.')
      }
      if (validationProblems.length > 0) {
        throw new Error([
          'Nextcloud-Anmeldung kann nicht gestartet werden.',
          '',
          ...validationProblems,
          '',
          'Es wurde noch keine Verbindung zu Nextcloud hergestellt.',
        ].join('\n'))
      }
      const credentials = { serverUrl, username, password }
      const response = await request(credentials, 'PROPFIND', '', { Depth: '0' })
      if (!response.ok) throw new Error(`Nextcloud-Anmeldung fehlgeschlagen: ${response.status}`)
      credentialsByConnection.set(connectionId, credentials)
      options.onConnected?.(connectionId)
    },
    async logout(state?: StorageCommandState): Promise<void> {
      credentialsByConnection.delete(connectionKey(state))
    },
    async list(state: StorageCommandState, recursive = false): Promise<string[]> {
      const entries = await listEntries(state, recursive ? 'infinity' : '1')
      return entries.filter((entry) => !entry.isFolder && entry.path.toLowerCase().endsWith('.abc')).map((entry) => entry.path).sort()
    },
    async search(state: StorageCommandState, query: string): Promise<string[]> {
      const entries = await listEntries(state, 'infinity')
      const normalizedQuery = query.toLocaleLowerCase()
      return entries
        .filter((entry) => !entry.isFolder && entry.path.toLowerCase().endsWith('.abc'))
        .map((entry) => entry.path)
        .filter((path) => path.toLocaleLowerCase().includes(normalizedQuery))
        .sort()
    },
    async open(state: StorageCommandState, filename: string): Promise<string | undefined> {
      const response = await requestForState(state, 'GET', targetPath(state, filename))
      if (response.status === 404) return undefined
      if (!response.ok) throw new Error(`Nextcloud-Datei konnte nicht geöffnet werden: ${response.status}`)
      return response.text()
    },
    async save(state: StorageCommandState, filename: string, content: string | Blob): Promise<void> {
      const response = await requestForState(state, 'PUT', targetPath(state, filename), {
        'Content-Type': content instanceof Blob ? content.type || 'application/octet-stream' : 'text/plain;charset=utf-8',
      }, content)
      if (!response.ok) throw new Error(`Nextcloud-Datei konnte nicht gespeichert werden: ${response.status}`)
    },
    async cleanup(state?: StorageCommandState): Promise<void> {
      credentialsByConnection.delete(connectionKey(state))
    },
    async listFolders(state: StorageCommandState, path: string): Promise<Array<{ name: string; path: string }>> {
      const entries = await listEntries({ ...state, path: normalizePath(path) }, '1')
      return entries.filter((entry) => entry.isFolder && entry.path !== '').map((entry) => ({ name: lastPathPart(entry.path), path: entry.path })).sort((left, right) => left.name.localeCompare(right.name))
    },
    async listDocuments(state: StorageCommandState): Promise<StorageDocument[]> {
      const entries = await listEntries(state, '1')
      const files = entries.filter((entry) => !entry.isFolder && !entry.name.startsWith('.') && entry.name.toLowerCase().endsWith('.abc'))
      return files.map((entry) => ({
        path: entry.path,
        name: entry.name,
        modifiedAt: entry.modifiedAt,
        previewPdfPaths: [],
        previewHtmlPaths: [],
      })).sort((left, right) => left.name.localeCompare(right.name))
    },
    async openPreview(state: StorageCommandState, path: string): Promise<Blob | undefined> {
      const response = await requestForState(state, 'GET', targetPath(state, path))
      if (response.status === 404) return undefined
      if (!response.ok) throw new Error(`Nextcloud-Vorschau konnte nicht geöffnet werden: ${response.status}`)
      return new Blob([await response.arrayBuffer()], { type: path.toLocaleLowerCase().endsWith('.html') ? 'text/html;charset=utf-8' : 'application/pdf' })
    },
    async removeConnection(connectionId: string): Promise<void> {
      credentialsByConnection.delete(connectionId)
    },
  }
}

interface WebDavEntry {
  name: string
  path: string
  isFolder: boolean
  modifiedAt?: string
}

async function listEntries(state: StorageCommandState, depth: '1' | 'infinity'): Promise<WebDavEntry[]> {
  const response = await requestForState(state, 'PROPFIND', currentPath(state), { Depth: depth })
  if (!response.ok) throw new Error(`Nextcloud-Verzeichnis konnte nicht gelesen werden: ${response.status}`)
  return parsePropfind(await response.text(), currentPath(state))
}

function parsePropfind(xml: string, current: string): WebDavEntry[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror') !== null) throw new Error('Ungültige Antwort von Nextcloud')
  return [...document.getElementsByTagNameNS('*', 'response')].flatMap((response): WebDavEntry[] => {
    const href = response.getElementsByTagNameNS('*', 'href')[0]?.textContent
    if (href === null || href === undefined) return []
    const path = decodeURIComponent(new URL(href, window.location.origin).pathname.split('/remote.php/dav/files/').slice(1).join('/').split('/').slice(1).join('/')).replace(/^\/+|\/+$/g, '')
    if (path === current || path === '') return []
    const resourceType = response.getElementsByTagNameNS('*', 'resourcetype')[0]
    const isFolder = resourceType?.getElementsByTagNameNS('*', 'collection').length !== 0
    const modifiedAt = response.getElementsByTagNameNS('*', 'getlastmodified')[0]?.textContent ?? undefined
    return [{ name: lastPathPart(path), path, isFolder, modifiedAt }]
  })
}

async function requestForState(state: StorageCommandState, method: string, path: string, headers: Record<string, string> = {}, body?: BodyInit): Promise<Response> {
  const credentials = credentialsByConnection.get(connectionKey(state))
  if (credentials === undefined) throw new Error('Nextcloud ist nicht verbunden')
  return request(credentials, method, path, headers, body)
}

async function request(credentials: NextcloudCredentials, method: string, path: string, headers: Record<string, string> = {}, body?: BodyInit): Promise<Response> {
  const url = `${credentials.serverUrl}/remote.php/dav/files/${encodeURIComponent(credentials.username)}/${path.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`
  return fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`,
      ...headers,
    },
    body,
  })
}

function connectionKey(state?: StorageCommandState): string {
  return state?.connectionId ?? 'default'
}

function currentPath(state: StorageCommandState): string {
  return normalizePath([state.rootPath ?? '', state.path].filter(Boolean).join('/'))
}

function targetPath(state: StorageCommandState, filename: string): string {
  return normalizePath([currentPath(state), filename].filter(Boolean).join('/'))
}

function normalizePath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter((part: string) => part !== '' && part !== '.')
  if (parts.some((part) => part === '..')) throw new Error('Nextcloud-Pfad darf den Wurzelordner nicht verlassen')
  return parts.join('/')
}

function normalizeServerUrl(url: string): string {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
    return parsed.origin
  } catch {
    return ''
  }
}

function lastPathPart(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] ?? path
}
