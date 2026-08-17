/** A file statistic relative to the selected local workspace. */
export interface WorkspaceFileStat {
  kind: 'file' | 'directory'
  size: number
  mtimeMs: number
}

/**
 * The small filesystem contract shared by storage and local Git.
 * Paths are always slash-separated and relative to the selected workspace.
 */
export interface WorkspaceFileSystem {
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, data: Uint8Array | string): Promise<void>
  deleteFile(path: string): Promise<void>
  removeDirectory(path: string, recursive?: boolean): Promise<void>
  mkdir(path: string): Promise<void>
  readdir(path: string): Promise<string[]>
  stat(path: string): Promise<WorkspaceFileStat>
  exists(path: string): Promise<boolean>
  rename(oldPath: string, newPath: string): Promise<void>
}

export interface WorkspaceFileHandle {
  readonly kind: 'file'
  getFile(): Promise<File>
  createWritable(): Promise<{
    write(data: string | Blob): Promise<void>
    close(): Promise<void>
  }>
}

export interface WorkspaceDirectoryHandle {
  readonly kind: 'directory'
  readonly name: string
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<WorkspaceDirectoryHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<WorkspaceFileHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  entries(): AsyncIterableIterator<[string, WorkspaceFileHandle | WorkspaceDirectoryHandle]>
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>
}

export class WorkspaceFileSystemError extends Error {
  readonly code: string
  readonly path: string

  constructor(code: string, path: string, message: string) {
    super(message)
    this.name = 'WorkspaceFileSystemError'
    this.code = code
    this.path = path
  }
}

/** Creates a WorkspaceFileSystem backed by one File System Access directory handle. */
export function createWorkspaceFileSystem(root: WorkspaceDirectoryHandle): WorkspaceFileSystem {
  return {
    readFile: async (path) => {
      const handle = await fileHandleAt(root, path)
      const file = await handle.getFile()
      return new Uint8Array(await file.arrayBuffer())
    },
    writeFile: async (path, data) => {
      const handle = await fileHandleAt(root, path, true)
      const writable = await handle.createWritable()
      try {
        await writable.write(typeof data === 'string' ? data : new Blob([toArrayBuffer(data)]))
      } finally {
        await writable.close()
      }
    },
    deleteFile: async (path) => {
      const normalized = normalizeWorkspacePath(path)
      if (normalized === '') throw new WorkspaceFileSystemError('EINVAL', path, 'Eine Datei darf nicht der Workspace selbst sein')
      const stat = await statAt(root, normalized)
      if (stat.kind === 'directory') throw new WorkspaceFileSystemError('EISDIR', path, `Kein Datei-Pfad: ${path}`)
      await removeEntry(root, normalized, false)
    },
    removeDirectory: async (path, recursive = false) => {
      const normalized = normalizeWorkspacePath(path)
      if (normalized === '') throw new WorkspaceFileSystemError('EINVAL', path, 'Der Workspace darf nicht gelöscht werden')
      const stat = await statAt(root, normalized)
      if (stat.kind !== 'directory') throw new WorkspaceFileSystemError('ENOTDIR', path, `Kein Ordner-Pfad: ${path}`)
      await removeEntry(root, normalized, recursive)
    },
    mkdir: async (path) => {
      await directoryAt(root, path, true)
    },
    readdir: async (path) => {
      const directory = await directoryAt(root, path)
      const names: string[] = []
      for await (const [name] of directory.entries()) names.push(name)
      return names.sort((left, right) => left.localeCompare(right))
    },
    stat: (path) => statAt(root, path),
    exists: async (path) => {
      try {
        await statAt(root, path)
        return true
      } catch (error) {
        if (isFileSystemNotFoundError(error)) return false
        throw error
      }
    },
    rename: async (oldPath, newPath) => {
      const source = normalizeWorkspacePath(oldPath)
      const target = normalizeWorkspacePath(newPath)
      if (source === '' || target === '') throw new WorkspaceFileSystemError('EINVAL', `${oldPath} -> ${newPath}`, 'Leere Pfade können nicht umbenannt werden')
      await copyEntry(root, source, target)
      const sourceStat = await statAt(root, source)
      if (sourceStat.kind === 'directory') await removeEntry(root, source, true)
      else await removeEntry(root, source, false)
    },
  }
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(data.byteLength)
  new Uint8Array(copy).set(data)
  return copy
}

export function normalizeWorkspacePath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter((part) => part !== '' && part !== '.')
  if (parts.some((part) => part === '..')) throw new WorkspaceFileSystemError('EINVAL', path, 'Workspace-Pfade dürfen den Workspace nicht verlassen')
  return parts.join('/')
}

async function directoryAt(root: WorkspaceDirectoryHandle, path: string, create = false): Promise<WorkspaceDirectoryHandle> {
  let directory = root
  for (const part of normalizeWorkspacePath(path).split('/').filter(Boolean)) {
    try {
      directory = await directory.getDirectoryHandle(part, { create })
    } catch (error) {
      throw normalizeHandleError(error, path)
    }
  }
  return directory
}

async function fileHandleAt(root: WorkspaceDirectoryHandle, path: string, create = false): Promise<WorkspaceFileHandle> {
  const parts = normalizeWorkspacePath(path).split('/').filter(Boolean)
  const name = parts.pop()
  if (name === undefined) throw new WorkspaceFileSystemError('EISDIR', path, `Kein Datei-Pfad: ${path}`)
  const directory = await directoryAt(root, parts.join('/'), create)
  try {
    return await directory.getFileHandle(name, { create })
  } catch (error) {
    throw normalizeHandleError(error, path)
  }
}

async function statAt(root: WorkspaceDirectoryHandle, path: string): Promise<WorkspaceFileStat> {
  const normalized = normalizeWorkspacePath(path)
  if (normalized === '') return { kind: 'directory', size: 0, mtimeMs: 0 }
  const parts = normalized.split('/')
  const name = parts.pop()
  if (name === undefined) return { kind: 'directory', size: 0, mtimeMs: 0 }
  const parent = await directoryAt(root, parts.join('/'))
  try {
    await parent.getDirectoryHandle(name)
    return { kind: 'directory', size: 0, mtimeMs: 0 }
  } catch (directoryError) {
    if (!isTypeMismatchError(directoryError) && !isFileSystemNotFoundError(directoryError)) {
      throw normalizeHandleError(directoryError, path)
    }
  }
  try {
    const file = await parent.getFileHandle(name)
    const info = await file.getFile()
    return { kind: 'file', size: info.size, mtimeMs: info.lastModified }
  } catch (fileError) {
    throw normalizeHandleError(fileError, path)
  }
}

async function removeEntry(root: WorkspaceDirectoryHandle, path: string, recursive: boolean): Promise<void> {
  const parts = normalizeWorkspacePath(path).split('/').filter(Boolean)
  const name = parts.pop()
  if (name === undefined) throw new WorkspaceFileSystemError('EINVAL', path, 'Leerer Pfad')
  const directory = await directoryAt(root, parts.join('/'))
  try {
    await directory.removeEntry(name, { recursive })
  } catch (error) {
    throw normalizeHandleError(error, path)
  }
}

async function copyEntry(root: WorkspaceDirectoryHandle, source: string, target: string): Promise<void> {
  const sourceStat = await statAt(root, source)
  if (sourceStat.kind === 'file') {
    await createWorkspaceFileSystem(root).writeFile(target, await createWorkspaceFileSystem(root).readFile(source))
    return
  }
  await directoryAt(root, target, true)
  for (const name of await createWorkspaceFileSystem(root).readdir(source)) {
    await copyEntry(root, `${source}/${name}`, `${target}/${name}`)
  }
}

function normalizeHandleError(error: unknown, path: string): WorkspaceFileSystemError | unknown {
  if (isFileSystemNotFoundError(error)) return new WorkspaceFileSystemError('ENOENT', path, `Datei oder Ordner nicht gefunden: ${path}`)
  if (isTypeMismatchError(error)) return new WorkspaceFileSystemError('ENOTDIR', path, `Pfad ist kein Ordner: ${path}`)
  return error
}

function isFileSystemNotFoundError(error: unknown): boolean {
  return (error instanceof DOMException && error.name === 'NotFoundError')
    || (error instanceof WorkspaceFileSystemError && error.code === 'ENOENT')
}

function isTypeMismatchError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TypeMismatchError'
}
