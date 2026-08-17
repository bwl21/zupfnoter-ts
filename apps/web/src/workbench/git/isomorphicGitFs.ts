import { Buffer as BrowserBuffer } from 'buffer'
import type { FsClient } from 'isomorphic-git'
import { normalizeWorkspacePath } from '../storage/workspaceFileSystem'
import type { WorkspaceFileSystem, WorkspaceFileStat } from '../storage/workspaceFileSystem'

interface BrowserGlobalWithBuffer {
  Buffer?: typeof BrowserBuffer
}

const browserGlobal = globalThis as typeof globalThis & BrowserGlobalWithBuffer
if (browserGlobal.Buffer === undefined) browserGlobal.Buffer = BrowserBuffer

interface IsomorphicGitPromises {
  readFile(path: string, options?: unknown): Promise<Uint8Array | string>
}

export type IsomorphicGitFs = FsClient & {
  promises: IsomorphicGitPromises
  setIgnoreCase(ignoreCase: boolean): void
}

/** Adapts the selected File System Access workspace to isomorphic-git's fs contract. */
export function createIsomorphicGitFs(workspace: WorkspaceFileSystem): IsomorphicGitFs {
  const gitWorkspace = createGitWorkspace(workspace)
  return {
    setIgnoreCase: gitWorkspace.setIgnoreCase,
    promises: {
      readFile: async (path: string, options?: unknown): Promise<Uint8Array | string> => {
        const rawData = await gitWorkspace.readFile(path)
        const data = isGitMetadataPath(path) ? rawData : normalizeGitTextBytes(rawData)
        return hasUtf8Encoding(options) ? new TextDecoder().decode(data) : data
      },
      writeFile: async (path: string, data: unknown): Promise<void> => {
        await gitWorkspace.writeFile(path, toUint8Array(data))
      },
      unlink: (path: string): Promise<void> => gitWorkspace.deleteFile(path),
      readdir: (path: string): Promise<string[]> => gitWorkspace.readdir(path),
      mkdir: (path: string): Promise<void> => gitWorkspace.mkdir(path),
      rmdir: async (path: string, options?: { recursive?: boolean }): Promise<void> => {
        await gitWorkspace.removeDirectory(path, options?.recursive === true)
      },
      stat: async (path: string): Promise<GitFileStat> => toGitStat(await gitWorkspace.stat(path)),
      lstat: async (path: string): Promise<GitFileStat> => toGitStat(await gitWorkspace.stat(path)),
      readlink: async (): Promise<never> => {
        throw new Error('Symbolische Links werden im lokalen Browser-Workspace nicht unterstützt')
      },
      symlink: async (): Promise<never> => {
        throw new Error('Symbolische Links werden im lokalen Browser-Workspace nicht unterstützt')
      },
      chmod: async (): Promise<void> => undefined,
    },
  }
}

/**
 * Git stores UTF-8 paths, while macOS commonly exposes decomposed Unicode
 * names through the File System Access API. Git itself treats those spellings
 * as the same filename on such a filesystem. The adapter therefore exposes
 * NFC paths to isomorphic-git and resolves them back to the actual workspace
 * spelling for file operations.
 */
interface GitWorkspace extends WorkspaceFileSystem {
  setIgnoreCase(ignoreCase: boolean): void
}

function createGitWorkspace(workspace: WorkspaceFileSystem): GitWorkspace {
  const directoryEntries = new Map<string, string[]>()
  let ignoreCase = false

  async function entriesAt(path: string): Promise<string[]> {
    const actualPath = await resolvePath(path)
    const entries = await workspace.readdir(actualPath)
    directoryEntries.set(canonicalPath(actualPath), entries)
    return entries
  }

  async function resolvePath(path: string): Promise<string> {
    const normalized = normalizeWorkspacePath(path)
    if (normalized === '') return ''
    const actualParts: string[] = []
    for (const part of normalized.split('/')) {
      const parent = actualParts.join('/')
      const entries = directoryEntries.get(canonicalPath(parent)) ?? await workspace.readdir(parent)
      directoryEntries.set(canonicalPath(parent), entries)
      const actualName = entries.find((entry) => canonicalName(entry) === canonicalName(part))
      actualParts.push(actualName ?? part)
    }
    return actualParts.join('/')
  }

  function invalidate(): void {
    directoryEntries.clear()
  }

  function setIgnoreCase(value: boolean): void {
    if (ignoreCase === value) return
    ignoreCase = value
    invalidate()
  }

  return {
    readFile: async (path) => workspace.readFile(await resolvePath(path)),
    writeFile: async (path, data) => {
      await workspace.writeFile(await resolvePath(path), data)
      invalidate()
    },
    deleteFile: async (path) => {
      await workspace.deleteFile(await resolvePath(path))
      invalidate()
    },
    removeDirectory: async (path, recursive) => {
      await workspace.removeDirectory(await resolvePath(path), recursive)
      invalidate()
    },
    mkdir: async (path) => {
      await workspace.mkdir(await resolvePath(path))
      invalidate()
    },
    readdir: async (path) => {
      const entries = await entriesAt(path)
      const visibleNames = new Map<string, string>()
      for (const entry of entries) {
        const normalized = entry.normalize('NFC')
        visibleNames.set(canonicalName(entry), visibleNames.get(canonicalName(entry)) ?? normalized)
      }
      return [...visibleNames.values()].sort((left, right) => left.localeCompare(right))
    },
    stat: async (path) => workspace.stat(await resolvePath(path)),
    exists: async (path) => workspace.exists(await resolvePath(path)),
    rename: async (oldPath, newPath) => {
      await workspace.rename(await resolvePath(oldPath), await resolvePath(newPath))
      invalidate()
    },
    setIgnoreCase,
  }
  function canonicalPath(path: string): string {
    return canonicalName(normalizeWorkspacePath(path))
  }

  function canonicalName(name: string): string {
    const normalized = name.normalize('NFC')
    return ignoreCase ? normalized.toLowerCase() : normalized
  }
}

interface GitFileStat {
  size: number
  mtimeMs: number
  ctimeMs: number
  ctime: Date
  mtime: Date
  dev: number
  ino: number
  mode: number
  uid: number
  gid: number
  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean
}

function toGitStat(stat: WorkspaceFileStat): GitFileStat {
  return {
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    ctimeMs: stat.mtimeMs,
    ctime: new Date(stat.mtimeMs),
    mtime: new Date(stat.mtimeMs),
    dev: 0,
    ino: 0,
    mode: stat.kind === 'directory' ? 0o040755 : 0o100644,
    uid: 0,
    gid: 0,
    isFile: () => stat.kind === 'file',
    isDirectory: () => stat.kind === 'directory',
    isSymbolicLink: () => false,
  }
}

function toUint8Array(data: unknown): Uint8Array {
  if (typeof data === 'string') return new TextEncoder().encode(data)
  if (data instanceof Uint8Array) return new Uint8Array(data)
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  throw new TypeError('Git-Dateiinhalt muss Text oder Binärdaten sein')
}

function isGitMetadataPath(path: string): boolean {
  return normalizeWorkspacePath(path).startsWith('.git/') || normalizeWorkspacePath(path) === '.git'
}

function normalizeGitTextBytes(data: Uint8Array): Uint8Array {
  if (data.includes(0) || !data.includes(13)) return data
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data)
    if (!text.includes('\r\n')) return data
    return new TextEncoder().encode(text.replace(/\r\n/g, '\n'))
  } catch {
    return data
  }
}

function hasUtf8Encoding(options: unknown): boolean {
  if (typeof options === 'string') return options.toLowerCase() === 'utf8' || options.toLowerCase() === 'utf-8'
  if (typeof options !== 'object' || options === null) return false
  const encoding = (options as { encoding?: unknown }).encoding
  return encoding === 'utf8' || encoding === 'utf-8'
}
