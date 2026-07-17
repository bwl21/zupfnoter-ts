import type { StorageCommandState } from '@zupfnoter/core'
import type { StorageDocument } from '@zupfnoter/types'

interface DropboxTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  expiresAt?: number
  token_type?: string
  scope?: string
}

interface DropboxEntry {
  '.tag': 'file' | 'folder' | 'deleted'
  name: string
  path_display?: string
  server_modified?: string
}

interface DropboxListFolderResponse {
  entries: DropboxEntry[]
  cursor: string
  has_more: boolean
}

interface DropboxListFolderContinueResponse {
  entries: DropboxEntry[]
  cursor: string
  has_more: boolean
}

interface DropboxSearchMatchMetadata {
  metadata?: {
    path_display?: string
    name?: string
  }
}

interface DropboxSearchV2Response {
  matches: Array<{
    metadata?: DropboxSearchMatchMetadata
  }>
}

export interface DropboxProvider {
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
}

const TOKEN_KEY_PREFIX = 'zupfnoter.storage.dropbox.token.'
const AUTH_STATE_KEY_PREFIX = 'zupfnoter.storage.dropbox.authstate.'
const REDIRECT_URI = `${window.location.origin}${window.location.pathname}`
const LEGACY_DROPBOX_APP_KEY = 'zwydv2vbgp30e05'

export function createDropboxProvider(): DropboxProvider {
  return {
    system: 'dropbox',
    async login(state?: StorageCommandState): Promise<void> {
      const connectionId = connectionKey(state)
      const appKey = resolveDropboxAppKey()
      const oauthState = crypto.randomUUID()
      const verifier = createCodeVerifier()
      const challenge = await createCodeChallenge(verifier)
      localStorage.setItem(authStateKey(connectionId), JSON.stringify({ state: oauthState, verifier }))
      const url = new URL('https://www.dropbox.com/oauth2/authorize')
      url.searchParams.set('client_id', appKey)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('redirect_uri', REDIRECT_URI)
      url.searchParams.set('token_access_type', 'offline')
      url.searchParams.set('state', oauthState)
      url.searchParams.set('code_challenge', challenge)
      url.searchParams.set('code_challenge_method', 'S256')
      window.location.assign(url.toString())
    },
    async logout(state?: StorageCommandState): Promise<void> {
      const connectionId = connectionKey(state)
      const token = loadToken(connectionId)
      if (token !== undefined) {
        await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.access_token}`,
          },
        })
      }
      localStorage.removeItem(tokenKey(connectionId))
      localStorage.removeItem(authStateKey(connectionId))
    },
    async list(path: StorageCommandState, recursive = false): Promise<string[]> {
      const folder = resolveStorageFolder(path)
      const entries = await listDropboxEntries(connectionKey(path), folder, recursive)
      return entries
        .filter((entry) => entry['.tag'] !== 'deleted')
        .filter((entry) => entry['.tag'] === 'file')
        .map((entry) => entry.path_display ?? entry.name)
        .filter((name) => name.toLowerCase().endsWith('.abc'))
        .sort()
    },
    async search(path: StorageCommandState, query: string): Promise<string[]> {
      const folder = resolveStorageFolder(path)
      const response = await authenticatedDropboxFetch(connectionKey(path), 'https://api.dropboxapi.com/2/files/search_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          options: {
            path: folder === '' ? '' : `/${folder}`,
            filename_only: true,
            max_results: 100,
            order_by: 'relevance',
          },
        }),
      })
      if (!response.ok) {
        throw new Error(`Dropbox search failed: ${response.status} ${await readDropboxErrorMessage(response)}`)
      }
      const payload = await response.json() as DropboxSearchV2Response
      return payload.matches
        .map((match) => match.metadata?.metadata?.path_display ?? match.metadata?.metadata?.name)
        .filter((name): name is string => typeof name === 'string')
        .filter((name) => name.toLowerCase().endsWith('.abc'))
        .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
        .sort()
    },
    async open(path: StorageCommandState, filename: string): Promise<string | undefined> {
      const target = resolveDropboxTarget(resolveStorageFolder(path), filename)
      const response = await authenticatedDropboxFetch(connectionKey(path), 'https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          'Dropbox-API-Arg': JSON.stringify({ path: `/${target}` }),
        },
      })
      if (!response.ok) {
        throw new Error(`Dropbox open failed: ${response.status} ${await readDropboxErrorMessage(response)}`)
      }
      return await response.text()
    },
    async save(path: StorageCommandState, filename: string, content: string | Blob): Promise<void> {
      const target = resolveDropboxTarget(resolveStorageFolder(path), filename)
      const response = await authenticatedDropboxFetch(connectionKey(path), 'https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: `/${target}`,
            mode: 'overwrite',
            autorename: false,
            mute: false,
            strict_conflict: false,
          }),
        },
        body: content,
      })
      if (!response.ok) {
        throw new Error(`Dropbox save failed: ${response.status} ${await readDropboxErrorMessage(response)}`)
      }
    },
    async cleanup(state?: StorageCommandState): Promise<void> {
      localStorage.removeItem(authStateKey(connectionKey(state)))
    },
    async listFolders(state: StorageCommandState, path: string): Promise<Array<{ name: string; path: string }>> {
      const folder = normalizeFolderPath(path)
      const entries = await listDropboxEntries(connectionKey(state), folder, false)
      return entries
        .filter((entry) => entry['.tag'] === 'folder')
        .filter((entry) => !entry.name.startsWith('.'))
        .map((entry) => ({ name: entry.name, path: normalizeFolderPath(entry.path_display ?? joinPath(folder, entry.name)) }))
        .sort((left, right) => left.name.localeCompare(right.name))
    },
    async listDocuments(state: StorageCommandState): Promise<StorageDocument[]> {
      const entries = await listDropboxEntries(connectionKey(state), resolveStorageFolder(state), false)
      const files = entries.filter((entry) => entry['.tag'] === 'file' && !entry.name.startsWith('.'))
      return files
        .filter((entry) => entry.name.toLowerCase().endsWith('.abc'))
        .map((entry) => ({
          path: entry.path_display ?? entry.name,
          name: entry.name,
          modifiedAt: entry.server_modified,
          previewPdfPaths: files
            .filter((candidate) => candidate.name.toLowerCase().endsWith('.pdf'))
            .filter((candidate) => isRelatedPreview(entry.name, candidate.name))
            .map((candidate) => candidate.path_display ?? candidate.name),
          previewHtmlPaths: files
            .filter((candidate) => candidate.name.toLowerCase().endsWith('.html'))
            .filter((candidate) => isRelatedPreview(entry.name, candidate.name))
            .map((candidate) => candidate.path_display ?? candidate.name),
        }))
        .sort((left, right) => left.name.localeCompare(right.name))
    },
    async openPreview(state: StorageCommandState, path: string): Promise<Blob | undefined> {
      const target = resolveDropboxTarget(resolveStorageFolder(state), path)
      const response = await authenticatedDropboxFetch(connectionKey(state), 'https://content.dropboxapi.com/2/files/download', { method: 'POST', headers: { 'Dropbox-API-Arg': JSON.stringify({ path: `/${target}` }) } })
      if (!response.ok) throw new Error(`Dropbox PDF preview failed: ${response.status} ${await readDropboxErrorMessage(response)}`)
      const content = await response.arrayBuffer()
      return new Blob([content], { type: previewContentType(path) })
    },
  }
}

function previewContentType(path: string): string {
  return path.toLocaleLowerCase().endsWith('.html') ? 'text/html;charset=utf-8' : 'application/pdf'
}

function isRelatedPreview(abcName: string, previewName: string): boolean {
  const stem = abcName.replace(/\.abc$/i, '').toLocaleLowerCase()
  const previewStem = previewName.replace(/\.(pdf|html)$/i, '').toLocaleLowerCase()
  return previewStem === stem || previewStem.startsWith(`${stem}-`) || previewStem.startsWith(`${stem}_`) || previewStem.startsWith(`${stem}.`)
}

export async function resumeDropboxLoginFromRedirect(connectionId: string): Promise<boolean> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (code === null || state === null) return false
  const authState = loadAuthState(connectionId)
  if (authState === undefined || authState.state !== state) return false
  await exchangeCodeForToken(code, authState.verifier, connectionId)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState({}, '', url.toString())
  return true
}

async function exchangeCodeForToken(code: string, verifier: string, connectionId: string): Promise<void> {
  const appKey = resolveDropboxAppKey()
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: appKey,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }).toString(),
  })
  if (!response.ok) {
    throw new Error(`Dropbox token exchange failed: ${response.status}`)
  }
  const token = await response.json() as DropboxTokenResponse
  persistDropboxToken(connectionId, token)
  localStorage.removeItem(authStateKey(connectionId))
}

async function listDropboxEntries(connectionId: string, folder: string, recursive: boolean): Promise<DropboxEntry[]> {
  const firstResponse = await authenticatedDropboxFetch(connectionId, 'https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: folder === '' ? '' : `/${folder}`,
      recursive,
      include_deleted: false,
      include_has_explicit_shared_members: false,
      include_mounted_folders: true,
      include_non_downloadable_files: true,
    }),
  })
  if (!firstResponse.ok) {
    throw new Error(`Dropbox list failed: ${firstResponse.status} ${await readDropboxErrorMessage(firstResponse)}`)
  }
  const payload = await firstResponse.json() as DropboxListFolderResponse
  const entries = [...payload.entries]
  let cursor = payload.cursor
  let hasMore = payload.has_more
  while (hasMore) {
    const continueResponse = await authenticatedDropboxFetch(connectionId, 'https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cursor }),
    })
    if (!continueResponse.ok) {
      throw new Error(`Dropbox list failed: ${continueResponse.status} ${await readDropboxErrorMessage(continueResponse)}`)
    }
    const continuePayload = await continueResponse.json() as DropboxListFolderContinueResponse
    entries.push(...continuePayload.entries)
    cursor = continuePayload.cursor
    hasMore = continuePayload.has_more
  }
  return entries
}

function resolveDropboxAppKey(): string {
  const appKey = import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined
  if (appKey !== undefined && appKey.trim() !== '') {
    return appKey.trim()
  }
  return LEGACY_DROPBOX_APP_KEY
}

export function removeDropboxConnection(connectionId: string): void {
  localStorage.removeItem(tokenKey(connectionId))
  localStorage.removeItem(authStateKey(connectionId))
}

function loadToken(connectionId: string): DropboxTokenResponse | undefined {
  const raw = localStorage.getItem(tokenKey(connectionId))
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as DropboxTokenResponse
  } catch {
    return undefined
  }
}

async function authenticatedDropboxFetch(connectionId: string, url: string, init: RequestInit): Promise<Response> {
  const token = await validDropboxToken(connectionId)
  const response = await fetchWithDropboxToken(url, init, token.access_token)
  if (response.status !== 401 || token.refresh_token === undefined) return response

  const refreshedToken = await refreshDropboxToken(connectionId, token)
  return fetchWithDropboxToken(url, init, refreshedToken.access_token)
}

async function validDropboxToken(connectionId: string): Promise<DropboxTokenResponse> {
  const token = loadToken(connectionId)
  if (token === undefined) {
    throw new Error('Dropbox not logged in')
  }
  if (token.refresh_token !== undefined && token.expiresAt !== undefined && token.expiresAt <= Date.now() + 60_000) {
    return refreshDropboxToken(connectionId, token)
  }
  return token
}

async function refreshDropboxToken(connectionId: string, previousToken: DropboxTokenResponse): Promise<DropboxTokenResponse> {
  const refreshToken = previousToken.refresh_token
  if (refreshToken === undefined || refreshToken === '') {
    throw new Error('Dropbox access token expired; please reconnect')
  }
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: resolveDropboxAppKey(),
    }).toString(),
  })
  if (!response.ok) {
    throw new Error(`Dropbox token refresh failed: ${response.status} ${await readDropboxErrorMessage(response)}`)
  }
  const refreshed = await response.json() as DropboxTokenResponse
  const nextToken: DropboxTokenResponse = {
    ...refreshed,
    refresh_token: refreshed.refresh_token ?? refreshToken,
  }
  persistDropboxToken(connectionId, nextToken)
  return nextToken
}

function persistDropboxToken(connectionId: string, token: DropboxTokenResponse): void {
  const expiresAt = token.expires_in === undefined
    ? token.expiresAt
    : Date.now() + token.expires_in * 1000
  localStorage.setItem(tokenKey(connectionId), JSON.stringify({ ...token, expiresAt }))
}

async function fetchWithDropboxToken(url: string, init: RequestInit, accessToken: string): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  return fetch(url, { ...init, headers })
}

function loadAuthState(connectionId: string): { state: string; verifier: string } | undefined {
  const raw = localStorage.getItem(authStateKey(connectionId))
  if (raw === null) return undefined
  try {
    const parsed = JSON.parse(raw) as { state?: unknown; verifier?: unknown }
    if (typeof parsed.state !== 'string' || typeof parsed.verifier !== 'string') return undefined
    return { state: parsed.state, verifier: parsed.verifier }
  } catch {
    return undefined
  }
}

function connectionKey(state?: StorageCommandState): string {
  return state?.connectionId ?? 'default'
}

function tokenKey(connectionId: string): string {
  return `${TOKEN_KEY_PREFIX}${connectionId}`
}

function authStateKey(connectionId: string): string {
  return `${AUTH_STATE_KEY_PREFIX}${connectionId}`
}

function normalizeFolderPath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '')
}

function joinPath(folder: string, filename: string): string {
  const normalizedFolder = normalizeFolderPath(folder)
  const normalizedFile = filename.replace(/^\/+/, '')
  return normalizedFolder === '' ? normalizedFile : `${normalizedFolder}/${normalizedFile}`
}

function resolveDropboxTarget(folder: string, filename: string): string {
  const normalizedFilename = filename.replace(/^\/+/, '')
  if (normalizedFilename.includes('/')) {
    return normalizedFilename
  }
  return joinPath(folder, normalizedFilename)
}

function resolveStorageFolder(state: StorageCommandState): string {
  const root = normalizeFolderPath(state.rootPath ?? '')
  const relative = normalizeFolderPath(state.path)
  if (relative.split('/').some((part) => part === '..')) {
    throw new Error('Storage path must stay inside the connection root')
  }
  return joinPath(root, relative)
}

function createCodeVerifier(): string {
  return arrayBufferToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return arrayBufferToBase64Url(new Uint8Array(digest))
}

async function readDropboxErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json() as { error_summary?: string; error?: unknown }
      if (typeof payload.error_summary === 'string' && payload.error_summary.trim() !== '') {
        return payload.error_summary
      }
      return JSON.stringify(payload)
    } catch {
      return response.statusText
    }
  }
  try {
    const text = await response.text()
    return text.trim() === '' ? response.statusText : text
  } catch {
    return response.statusText
  }
}

function arrayBufferToBase64Url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
