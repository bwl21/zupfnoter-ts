import type { StorageCommandState } from '@zupfnoter/core'
import type { StorageDocument } from '@zupfnoter/types'
import {
  createWorkspaceFileSystem,
  type WorkspaceDirectoryHandle,
  type WorkspaceFileSystem,
  WorkspaceFileSystemError,
} from './workspaceFileSystem'
import {
  createProjectFileSystem,
  createProjectMarker,
  readProjectMarker,
  type ProjectFileSystem,
  type ProjectMarker,
  type ProjectEntry,
  validateProjectPath,
  validateProjectRootName,
} from './projectFileSystem'

interface FileSystemPickerWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<WorkspaceDirectoryHandle>
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
const projectsByConnection = new Map<string, ProjectFileSystem>()
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
      const savedPermission = await savedDirectory?.queryPermission?.({ mode: 'read' })
      const directory = savedDirectory !== undefined && savedPermission === 'granted' ? savedDirectory : await picker({ mode: 'read' })
      directoriesByConnection.set(connectionKey(state), directory)
      clearProjects(connectionKey(state))
      await saveDirectory(key, directory)
      await validateSelectedProject(directory)
    },
    async logout(state?: StorageCommandState): Promise<void> {
      directoriesByConnection.delete(connectionKey(state))
      clearProjects(connectionKey(state))
    },
    async list(state: StorageCommandState, recursive = false): Promise<string[]> {
      const project = await projectForState(state)
      return collectEntries(project, normalizePath(state.path), recursive, (entry) => entry.kind === 'file' && entry.path.toLowerCase().endsWith('.abc'))
    },
    async search(state: StorageCommandState, query: string): Promise<string[]> {
      const project = await projectForState(state)
      const normalizedQuery = query.toLocaleLowerCase()
      return collectEntries(project, normalizePath(state.path), true, (entry) => entry.kind === 'file'
        && entry.path.toLocaleLowerCase().endsWith('.abc')
        && entry.path.toLocaleLowerCase().includes(normalizedQuery))
    },
    async open(state: StorageCommandState, filename: string): Promise<string | undefined> {
      try {
        const project = await projectForState(state)
        const data = await project.readFile(resolveLocalTargetPath(state.path, filename))
        return new TextDecoder().decode(data)
      } catch (error) {
        if (isNotFoundError(error)) return undefined
        throw error
      }
    },
    async save(state: StorageCommandState, filename: string, content: string | Blob): Promise<void> {
      const project = await projectForState(state)
      const data = typeof content === 'string' ? content : new Uint8Array(await content.arrayBuffer())
      await project.writeFile(resolveLocalTargetPath(state.path, filename), data)
    },
    async cleanup(state?: StorageCommandState): Promise<void> {
      directoriesByConnection.delete(connectionKey(state))
      clearProjects(connectionKey(state))
    },
    async listFolders(state: StorageCommandState, path: string): Promise<Array<{ name: string; path: string }>> {
      const project = await projectForState(state)
      const folders: Array<{ name: string; path: string }> = []
      for (const entry of await project.listDirectory(normalizePath(path))) {
        if (entry.kind === 'directory') folders.push({ name: entry.name, path: joinPath(path, entry.name) })
      }
      return folders.sort((left, right) => left.name.localeCompare(right.name))
    },
    async listDocuments(state: StorageCommandState): Promise<StorageDocument[]> {
      const project = await projectForState(state)
      const entries = await collectEntryDetails(project, normalizePath(state.path), false)
      return entries
        .filter((entry) => entry.kind === 'file' && !entry.name.startsWith('.') && entry.name.toLowerCase().endsWith('.abc'))
        .map((entry) => ({ path: entry.path, name: entry.name, previewPdfPaths: [], previewHtmlPaths: [] }))
        .sort((left, right) => left.name.localeCompare(right.name))
    },
    async openPreview(state: StorageCommandState, path: string): Promise<Blob | undefined> {
      try {
        const project = await projectForState(state)
        const data = await project.readFile(resolveLocalTargetPath(state.path, path))
        return new Blob([toArrayBuffer(data)])
      } catch (error) {
        if (isNotFoundError(error)) return undefined
        throw error
      }
    },
    async removeConnection(connectionId: string): Promise<void> {
      directoriesByConnection.delete(connectionId)
      clearProjects(connectionId)
      await deleteDirectory(connectionId)
    },
  }
}

/** Returns the same selected local folder through the shared workspace contract. */
export async function getLocalWorkspaceFileSystem(connectionId: string, rootPath = ''): Promise<ProjectFileSystem> {
  const cacheKey = projectKey(connectionId, rootPath)
  const cached = projectsByConnection.get(cacheKey)
  if (cached !== undefined) return cached
  const directory = directoriesByConnection.get(connectionId) ?? await loadDirectory(connectionId)
  if (directory === undefined) throw new WorkspaceFileSystemError('ENOTCONN', rootPath, 'Kein lokaler Zielordner ausgewählt')
  directoriesByConnection.set(connectionId, directory)
  await validateSelectedProject(directory)
  const project = await projectFileSystemForDirectory(directory, rootPath)
  projectsByConnection.set(cacheKey, project)
  return project
}

async function collectEntries(
  project: ProjectFileSystem,
  basePath: string,
  recursive: boolean,
  predicate: (entry: ProjectEntry) => boolean,
): Promise<string[]> {
  const entries = await collectEntryDetails(project, basePath, recursive)
  return entries.filter(predicate).map((entry) => entry.path).sort()
}

async function collectEntryDetails(project: ProjectFileSystem, basePath: string, recursive: boolean): Promise<ProjectEntry[]> {
  const result: ProjectEntry[] = []
  for (const entry of await project.listDirectory(basePath)) {
    const path = joinPath(basePath, entry.name)
    const detail = { ...entry, path: path as ProjectEntry['path'] }
    result.push(detail)
    if (recursive && entry.kind === 'directory') {
      result.push(...await collectEntryDetails(project, path, true))
    }
  }
  return result
}

async function projectForState(state: StorageCommandState): Promise<ProjectFileSystem> {
  return getLocalWorkspaceFileSystem(connectionKey(state), state.rootPath ?? '')
}

function connectionKey(state?: StorageCommandState): string {
  return state?.connectionId ?? 'default'
}

function normalizePath(path: string): string {
  if (path === '') return ''
  return validateProjectPath(path)
}

function joinPath(left: string, right: string): string {
  return normalizePath([left, right].filter(Boolean).join('/'))
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(data.byteLength)
  new Uint8Array(copy).set(data)
  return copy
}

async function validateSelectedProject(directory: WorkspaceDirectoryHandle): Promise<ProjectMarker> {
  validateProjectRootName(directory.name)
  const project = createProjectFileSystem(createWorkspaceFileSystem(directory))
  return readProjectMarker(project)
}

async function requestDirectoryWritePermission(directory: WorkspaceDirectoryHandle): Promise<void> {
  const current = await directory.queryPermission?.({ mode: 'readwrite' })
  if (current === 'granted') return
  const requested = await directory.requestPermission?.({ mode: 'readwrite' })
  if (requested !== 'granted') throw new Error('Schreibberechtigung für das Zupfnoter-Projekt wurde nicht erteilt')
}

async function projectFileSystemForDirectory(directory: WorkspaceDirectoryHandle, rootPath: string): Promise<ProjectFileSystem> {
  let root = directory
  for (const part of normalizePath(rootPath).split('/').filter(Boolean)) root = await root.getDirectoryHandle(part)
  return createProjectFileSystem(createWorkspaceFileSystem(root), { requestWritePermission: () => requestDirectoryWritePermission(directory) })
}

export async function createLocalProject(connectionId: string, id: string): Promise<ProjectMarker> {
  const directory = directoriesByConnection.get(connectionId) ?? await loadDirectory(connectionId)
  if (directory === undefined) throw new WorkspaceFileSystemError('ENOTCONN', '', 'Kein lokaler Zielordner ausgewählt')
  await requestDirectoryWritePermission(directory)
  const project = createProjectFileSystem(createWorkspaceFileSystem(directory), { requestWritePermission: () => requestDirectoryWritePermission(directory) })
  const marker = await createProjectMarker(project, id)
  clearProjects(connectionId)
  return marker
}

/** Forgets the persisted local project capability and its in-memory wrapper. */
export async function forgetProject(projectId: string): Promise<void> {
  directoriesByConnection.delete(projectId)
  clearProjects(projectId)
  await deleteDirectory(projectId)
}

function projectKey(connectionId: string, rootPath: string): string {
  return `${connectionId}:${normalizePath(rootPath)}`
}

function clearProjects(connectionId: string): void {
  const prefix = `${connectionId}:`
  for (const key of projectsByConnection.keys()) {
    if (key.startsWith(prefix)) projectsByConnection.delete(key)
  }
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
