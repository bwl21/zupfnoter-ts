import type { StorageCommandState } from '@zupfnoter/core'
import type { StorageDocument } from '@zupfnoter/types'
import {
  createWorkspaceFileSystem,
  type WorkspaceDirectoryHandle,
  type WorkspaceFileHandle,
  type WorkspaceFileSystem,
  WorkspaceFileSystemError,
} from './workspaceFileSystem'

interface FileSystemPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<WorkspaceDirectoryHandle>
}

interface LocalFsProvider {
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

const directoriesByConnection = new Map<string, WorkspaceDirectoryHandle>()
const DIRECTORY_DATABASE = 'zupfnoter-local-storage'
const DIRECTORY_STORE = 'directories'

export function createLocalFsProvider(): LocalFsProvider {
  return {
    system: 'local',
    async login(state?: StorageCommandState): Promise<void> {
      const picker = (window as FileSystemPickerWindow).showDirectoryPicker
      if (picker === undefined) throw new Error('Dieser Browser unterstützt keinen lokalen Ordnerzugriff. Bitte einen Chromium-basierten Browser verwenden.')
      const key = connectionKey(state)
      const savedDirectory = await loadDirectory(key)
      const savedPermission = await savedDirectory?.queryPermission?.({ mode: 'readwrite' })
      const directory = savedDirectory !== undefined && savedPermission === 'granted' ? savedDirectory : await picker()
      directoriesByConnection.set(connectionKey(state), directory)
      await saveDirectory(key, directory)
    },
    async logout(state?: StorageCommandState): Promise<void> {
      directoriesByConnection.delete(connectionKey(state))
    },
    async list(state: StorageCommandState, recursive = false): Promise<string[]> {
      const directory = await directoryForPath(state, state.path)
      return collectEntries(directory, normalizePath(state.path), recursive, (entry) => !entry.isFolder && entry.path.toLowerCase().endsWith('.abc'))
    },
    async search(state: StorageCommandState, query: string): Promise<string[]> {
      const directory = await directoryForPath(state, state.path)
      const normalizedQuery = query.toLocaleLowerCase()
      return collectEntries(directory, normalizePath(state.path), true, (entry) => !entry.isFolder
        && entry.path.toLocaleLowerCase().endsWith('.abc')
        && entry.path.toLocaleLowerCase().includes(normalizedQuery))
    },
    async open(state: StorageCommandState, filename: string): Promise<string | undefined> {
      try {
        const file = await fileForPath(state, resolveLocalTargetPath(state.path, filename))
        return file.getFile().then((value) => value.text())
      } catch (error) {
        if (isNotFoundError(error)) return undefined
        throw error
      }
    },
    async save(state: StorageCommandState, filename: string, content: string | Blob): Promise<void> {
      const file = await fileForPath(state, resolveLocalTargetPath(state.path, filename), true)
      const writable = await file.createWritable()
      await writable.write(content)
      await writable.close()
    },
    async cleanup(state?: StorageCommandState): Promise<void> {
      directoriesByConnection.delete(connectionKey(state))
    },
    async listFolders(state: StorageCommandState, path: string): Promise<Array<{ name: string; path: string }>> {
      const directory = await directoryForPath(state, path)
      const folders: Array<{ name: string; path: string }> = []
      for await (const [name, entry] of directory.entries()) {
        if (entry.kind === 'directory') folders.push({ name, path: joinPath(path, name) })
      }
      return folders.sort((left, right) => left.name.localeCompare(right.name))
    },
    async listDocuments(state: StorageCommandState): Promise<StorageDocument[]> {
      const directory = await directoryForPath(state, state.path)
      const entries = await collectEntryDetails(directory, normalizePath(state.path), false)
      return entries
        .filter((entry) => !entry.isFolder && !entry.name.startsWith('.') && entry.name.toLowerCase().endsWith('.abc'))
        .map((entry) => ({ path: entry.path, name: entry.name, previewPdfPaths: [], previewHtmlPaths: [] }))
        .sort((left, right) => left.name.localeCompare(right.name))
    },
    async openPreview(state: StorageCommandState, path: string): Promise<Blob | undefined> {
      try {
        const file = await fileForPath(state, resolveLocalTargetPath(state.path, path))
        return file.getFile()
      } catch (error) {
        if (isNotFoundError(error)) return undefined
        throw error
      }
    },
    async removeConnection(connectionId: string): Promise<void> {
      directoriesByConnection.delete(connectionId)
      await deleteDirectory(connectionId)
    },
  }
}

/** Returns the same selected local folder through the shared workspace contract. */
export async function getLocalWorkspaceFileSystem(connectionId: string, rootPath = ''): Promise<WorkspaceFileSystem> {
  const directory = directoriesByConnection.get(connectionId) ?? await loadDirectory(connectionId)
  if (directory === undefined) throw new WorkspaceFileSystemError('ENOTCONN', rootPath, 'Kein lokaler Zielordner ausgewählt')
  let workspaceRoot = directory
  for (const part of normalizePath(rootPath).split('/').filter(Boolean)) workspaceRoot = await workspaceRoot.getDirectoryHandle(part)
  return createWorkspaceFileSystem(workspaceRoot)
}

interface LocalEntry {
  name: string
  path: string
  isFolder: boolean
}

async function collectEntries(
  directory: WorkspaceDirectoryHandle,
  basePath: string,
  recursive: boolean,
  predicate: (entry: LocalEntry) => boolean,
): Promise<string[]> {
  const entries = await collectEntryDetails(directory, basePath, recursive)
  return entries.filter(predicate).map((entry) => entry.path).sort()
}

async function collectEntryDetails(directory: WorkspaceDirectoryHandle, basePath: string, recursive: boolean): Promise<LocalEntry[]> {
  const result: LocalEntry[] = []
  for await (const [name, entry] of directory.entries()) {
    const path = joinPath(basePath, name)
    const detail = { name, path, isFolder: entry.kind === 'directory' }
    result.push(detail)
    if (recursive && entry.kind === 'directory') {
      result.push(...await collectEntryDetails(entry, path, true))
    }
  }
  return result
}

async function directoryForPath(state: StorageCommandState, path: string): Promise<WorkspaceDirectoryHandle> {
  const key = connectionKey(state)
  let directory = directoriesByConnection.get(key)
  directory ??= await loadDirectory(key)
  if (directory !== undefined) directoriesByConnection.set(key, directory)
  if (directory === undefined) throw new Error('Kein lokaler Zielordner ausgewählt')
  const combinedPath = [state.rootPath ?? '', path].filter(Boolean).join('/')
  for (const part of normalizePath(combinedPath).split('/').filter(Boolean)) directory = await directory.getDirectoryHandle(part)
  return directory
}

async function fileForPath(state: StorageCommandState, path: string, create = false): Promise<WorkspaceFileHandle> {
  const parts = normalizePath(path).split('/').filter(Boolean)
  const name = parts.pop()
  if (name === undefined) throw new Error('Dateiname fehlt')
  const directory = await directoryForPath(state, parts.join('/'))
  return directory.getFileHandle(name, { create })
}

function connectionKey(state?: StorageCommandState): string {
  return state?.connectionId ?? 'default'
}

function normalizePath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter((part) => part !== '' && part !== '.')
  if (parts.some((part) => part === '..')) throw new Error('Lokaler Pfad darf den Zielordner nicht verlassen')
  return parts.join('/')
}

function joinPath(left: string, right: string): string {
  return normalizePath([left, right].filter(Boolean).join('/'))
}

export function resolveLocalTargetPath(currentPath: string, targetPath: string): string {
  const current = normalizePath(currentPath)
  const target = normalizePath(targetPath)
  if (current === '' || target === current || target.startsWith(`${current}/`)) return target
  return joinPath(current, target)
}

function isNotFoundError(error: unknown): boolean {
  return (error instanceof DOMException && error.name === 'NotFoundError')
    || (error instanceof WorkspaceFileSystemError && error.code === 'ENOENT')
}

async function loadDirectory(key: string): Promise<WorkspaceDirectoryHandle | undefined> {
  if (typeof indexedDB === 'undefined') return undefined
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DIRECTORY_DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(DIRECTORY_STORE)
    request.onerror = () => reject(request.error ?? new Error('Lokaler Speicher konnte nicht geöffnet werden'))
    request.onsuccess = () => {
      const transaction = request.result.transaction(DIRECTORY_STORE, 'readonly')
      const read = transaction.objectStore(DIRECTORY_STORE).get(key)
      read.onerror = () => reject(read.error ?? new Error('Lokaler Ordner konnte nicht gelesen werden'))
      read.onsuccess = () => resolve(read.result as WorkspaceDirectoryHandle | undefined)
    }
  })
}

async function saveDirectory(key: string, directory: WorkspaceDirectoryHandle): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DIRECTORY_DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(DIRECTORY_STORE)
    request.onerror = () => reject(request.error ?? new Error('Lokaler Speicher konnte nicht geöffnet werden'))
    request.onsuccess = () => {
      const transaction = request.result.transaction(DIRECTORY_STORE, 'readwrite')
      transaction.objectStore(DIRECTORY_STORE).put(directory, key)
      transaction.onerror = () => reject(transaction.error ?? new Error('Lokaler Ordner konnte nicht gespeichert werden'))
      transaction.oncomplete = () => resolve()
    }
  })
}

async function deleteDirectory(key: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DIRECTORY_DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(DIRECTORY_STORE)
    request.onerror = () => reject(request.error ?? new Error('Lokaler Speicher konnte nicht geöffnet werden'))
    request.onsuccess = () => {
      const transaction = request.result.transaction(DIRECTORY_STORE, 'readwrite')
      transaction.objectStore(DIRECTORY_STORE).delete(key)
      transaction.onerror = () => reject(transaction.error ?? new Error('Lokaler Ordner konnte nicht gelöscht werden'))
      transaction.oncomplete = () => resolve()
    }
  })
}
