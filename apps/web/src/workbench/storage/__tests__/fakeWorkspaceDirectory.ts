import type { WorkspaceDirectoryHandle, WorkspaceFileHandle } from '../workspaceFileSystem'

type FakeEntry = FakeFileEntry | FakeDirectoryEntry

interface FakeFileEntry {
  kind: 'file'
  data: Uint8Array
  modified: number
}

interface FakeDirectoryEntry {
  kind: 'directory'
  name: string
  entries: Map<string, FakeEntry>
}

export function createFakeWorkspaceDirectory(): WorkspaceDirectoryHandle {
  return new FakeDirectoryHandle({ kind: 'directory', name: '', entries: new Map() })
}

class FakeDirectoryHandle implements WorkspaceDirectoryHandle {
  readonly kind = 'directory' as const
  readonly name: string

  constructor(private readonly entry: FakeDirectoryEntry) {
    this.name = entry.name
  }

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}): Promise<WorkspaceDirectoryHandle> {
    const current = this.entry.entries.get(name)
    if (current?.kind === 'directory') return new FakeDirectoryHandle(current)
    if (current?.kind === 'file') throw domError('TypeMismatchError')
    if (options.create !== true) throw domError('NotFoundError')
    const directory: FakeDirectoryEntry = { kind: 'directory', name, entries: new Map() }
    this.entry.entries.set(name, directory)
    return new FakeDirectoryHandle(directory)
  }

  async getFileHandle(name: string, options: { create?: boolean } = {}): Promise<WorkspaceFileHandle> {
    const current = this.entry.entries.get(name)
    if (current?.kind === 'file') return new FakeFileHandle(current)
    if (current?.kind === 'directory') throw domError('TypeMismatchError')
    if (options.create !== true) throw domError('NotFoundError')
    const file: FakeFileEntry = { kind: 'file', data: new Uint8Array(), modified: Date.now() }
    this.entry.entries.set(name, file)
    return new FakeFileHandle(file)
  }

  async removeEntry(name: string, options: { recursive?: boolean } = {}): Promise<void> {
    const current = this.entry.entries.get(name)
    if (current === undefined) throw domError('NotFoundError')
    if (current.kind === 'directory' && current.entries.size > 0 && options.recursive !== true) throw domError('InvalidModificationError')
    this.entry.entries.delete(name)
  }

  async *entries(): AsyncIterableIterator<[string, WorkspaceFileHandle | WorkspaceDirectoryHandle]> {
    for (const [name, entry] of this.entry.entries) {
      yield [name, entry.kind === 'file' ? new FakeFileHandle(entry) : new FakeDirectoryHandle(entry)]
    }
  }
}

class FakeFileHandle implements WorkspaceFileHandle {
  readonly kind = 'file' as const

  constructor(private readonly entry: FakeFileEntry) {}

  async getFile(): Promise<File> {
    return new File([toArrayBuffer(this.entry.data)], 'workspace-file', { lastModified: this.entry.modified })
  }

  async createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void> }> {
    let nextData = this.entry.data
    return {
      write: async (data) => {
        nextData = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(await data.arrayBuffer())
      },
      close: async () => {
        this.entry.data = nextData
        this.entry.modified = Date.now()
      },
    }
  }
}

function domError(name: string): DOMException {
  return new DOMException(name, name)
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(data.byteLength)
  new Uint8Array(copy).set(data)
  return copy
}
