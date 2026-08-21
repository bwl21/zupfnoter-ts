import git, { type FsClient, type ReadCommitResult } from 'isomorphic-git'
import { createIsomorphicGitFs, type IsomorphicGitFs } from './isomorphicGitFs'
import type { WorkspaceFileSystem } from '../storage/workspaceFileSystem'

const WORKTREE = '/'
const GITDIR = '/.git'
const EMPTY_TREE_OID = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

export type GitFileState = 'unmodified' | 'added' | 'modified' | 'deleted' | 'untracked' | 'conflicted'

export interface GitFileStatus {
  path: string
  state: GitFileState
  staged: boolean
  unstaged: boolean
}

export interface GitCommitFile {
  path: string
  state: 'added' | 'modified' | 'deleted'
}

export interface GitCommit {
  oid: string
  shortOid: string
  message: string
  tags: string[]
  author?: GitIdentity
  committer?: GitIdentity
}

export interface GitIdentity {
  name: string
  email: string
  timestamp?: number
}

export interface GitLogOptions {
  depth?: number
  ref?: string
}

export interface GitService {
  isRepository(): Promise<boolean>
  init(): Promise<void>
  status(): Promise<GitFileStatus[]>
  stage(paths: string[]): Promise<void>
  unstage(paths: string[]): Promise<void>
  commit(message: string): Promise<string>
  log(options?: GitLogOptions): Promise<GitCommit[]>
  historyForPath(path: string, options?: GitLogOptions): Promise<GitCommit[]>
  filesChangedInCommit(revision: string): Promise<GitCommitFile[]>
  currentBranch(): Promise<string | undefined>
  branches(): Promise<string[]>
  createBranch(name: string): Promise<void>
  checkout(ref: string): Promise<void>
  readWorkspaceFile(path: string): Promise<Uint8Array>
  getFileAtRevision(revision: string, path: string): Promise<Uint8Array | undefined>
}

export interface GitServiceOptions {
  author?: GitIdentity
  defaultBranch?: string
}

/** Local-only Git operations backed by the same workspace files as Zupfnoter. */
export function createGitService(workspace: WorkspaceFileSystem, options: GitServiceOptions = {}): GitService {
  const fs = createIsomorphicGitFs(workspace)
  const cache: Record<string, unknown> = {}
  const author = options.author ?? { name: 'Zupfnoter', email: 'zupfnoter@localhost' }
  const defaultBranch = options.defaultBranch ?? 'main'

  return {
    async isRepository(): Promise<boolean> {
      try {
        return (await workspace.stat('.git')).kind === 'directory'
      } catch (error) {
        if (isMissingWorkspacePath(error)) return false
        throw error
      }
    },
    async init(): Promise<void> {
      if (await this.isRepository()) {
        throw new Error('Im Workspace existiert bereits ein Git-Repository. Es wird nicht überschrieben.')
      }
      await git.init({ fs, dir: WORKTREE, gitdir: GITDIR, defaultBranch })
      await git.setConfig({ fs, dir: WORKTREE, gitdir: GITDIR, path: 'user.name', value: author.name })
      await git.setConfig({ fs, dir: WORKTREE, gitdir: GITDIR, path: 'user.email', value: author.email })
    },
    async status(): Promise<GitFileStatus[]> {
      const ignoreCase = await requireRepository(workspace, fs)
      const matrix = await git.statusMatrix({
        fs,
        dir: WORKTREE,
        gitdir: GITDIR,
        filepaths: ['.'],
        // Reading the status must not rewrite .git/index just to display the UI.
        // This is especially important for a browser workspace and large folders.
        refresh: false,
        filter: (path) => !path.startsWith('.git/'),
      })
      const statuses: GitFileStatus[] = []
      for (const entry of matrix) {
        const status = toGitFileStatus(entry)
        if (status.state === 'unmodified') continue
        statuses.push(status)
      }
      statuses.sort((left, right) => left.path.localeCompare(right.path))
      const normalizedStatuses = await removeCaseNormalizationNoise(statuses, fs, ignoreCase)
      const result: GitFileStatus[] = []
      for (const status of normalizedStatuses) {
        if (!status.staged && (status.state === 'modified' || status.state === 'deleted') && await isWorkspaceFileAtHead(fs, status.path)) continue
        result.push(status)
      }
      return result
    },
    async stage(paths: string[]): Promise<void> {
      await requireRepository(workspace, fs)
      for (const path of uniquePaths(paths)) {
        const current = await statusForPath(fs, path)
        if (current?.workdir === 0 && current.head !== 0) await git.remove({ fs, dir: WORKTREE, gitdir: GITDIR, filepath: path })
        else await git.add({ fs, dir: WORKTREE, gitdir: GITDIR, filepath: path })
      }
    },
    async unstage(paths: string[]): Promise<void> {
      await requireRepository(workspace, fs)
      for (const path of uniquePaths(paths)) await git.resetIndex({ fs, dir: WORKTREE, gitdir: GITDIR, filepath: path })
    },
    async commit(message: string): Promise<string> {
      await requireRepository(workspace, fs)
      const trimmedMessage = message.trim()
      if (trimmedMessage === '') throw new Error('Eine Commit-Nachricht ist erforderlich')
      return git.commit({
        fs,
        dir: WORKTREE,
        gitdir: GITDIR,
        message: trimmedMessage,
        author,
        committer: author,
        disallowEmpty: true,
      })
    },
    async log(logOptions = {}): Promise<GitCommit[]> {
      await requireRepository(workspace, fs)
      const entries = await git.log({ fs, dir: WORKTREE, gitdir: GITDIR, depth: logOptions.depth ?? 50, ref: logOptions.ref, cache })
      const tagsByCommit = await loadTagsByCommit(fs)
      return entries.map((entry) => toGitCommit(entry, tagsByCommit.get(entry.oid) ?? []))
    },
    async historyForPath(path: string, logOptions = {}): Promise<GitCommit[]> {
      await requireRepository(workspace, fs)
      const normalizedPath = path.replace(/^\/+/, '').replace(/\\/g, '/')
      if (normalizedPath === '' || normalizedPath.startsWith('.git/')) return []
      try {
        const entries = await git.log({
          fs,
          dir: WORKTREE,
          gitdir: GITDIR,
          filepath: normalizedPath,
          ref: logOptions.ref,
          depth: logOptions.depth ?? 50,
          follow: true,
          force: true,
          cache,
        })
        const tagsByCommit = await loadTagsByCommit(fs)
        return entries.map((entry) => toGitCommit(entry, tagsByCommit.get(entry.oid) ?? []))
      } catch (error) {
        if (isMissingGitObjectError(error)) return []
        throw error
      }
    },
    async filesChangedInCommit(revision: string): Promise<GitCommitFile[]> {
      await requireRepository(workspace, fs)
      const oid = await resolveRevision(fs, revision)
      const currentCommit = await git.readCommit({ fs, dir: WORKTREE, gitdir: GITDIR, oid })
      const parent = currentCommit.commit.parent[0]
      const walked: unknown = await git.walk({
        fs,
        dir: WORKTREE,
        gitdir: GITDIR,
        trees: [
          git.TREE({ ref: parent ?? EMPTY_TREE_OID }),
          git.TREE({ ref: oid }),
        ],
        map: async (path, entries) => {
          if (path === '') return undefined
          const previous = entries[0] ?? null
          const current = entries[1] ?? null
          const previousType = previous === null ? undefined : await previous.type()
          const currentType = current === null ? undefined : await current.type()
          if (previousType !== 'blob' && currentType !== 'blob') return undefined
          const previousOid = previousType === 'blob' && previous !== null ? await previous.oid() : undefined
          const currentOid = currentType === 'blob' && current !== null ? await current.oid() : undefined
          if (previousOid === currentOid) return undefined
          return { path, state: previousOid === undefined ? 'added' : currentOid === undefined ? 'deleted' : 'modified' } satisfies GitCommitFile
        },
      })
      if (!Array.isArray(walked)) return []
      return walked.filter(isGitCommitFile).sort((left, right) => left.path.localeCompare(right.path))
    },
    async currentBranch(): Promise<string | undefined> {
      await requireRepository(workspace, fs)
      const branch = await git.currentBranch({ fs, dir: WORKTREE, gitdir: GITDIR, fullname: false })
      return typeof branch === 'string' ? branch : undefined
    },
    async branches(): Promise<string[]> {
      await requireRepository(workspace, fs)
      return git.listBranches({ fs, dir: WORKTREE, gitdir: GITDIR })
    },
    async createBranch(name: string): Promise<void> {
      await requireRepository(workspace, fs)
      const trimmedName = name.trim()
      if (trimmedName === '') throw new Error('Ein Branch-Name ist erforderlich')
      await git.branch({ fs, dir: WORKTREE, gitdir: GITDIR, ref: trimmedName })
    },
    async checkout(ref: string): Promise<void> {
      await requireRepository(workspace, fs)
      const changes = await this.status()
      if (changes.length > 0) throw new Error('Branchwechsel ist mit ungespeicherten Änderungen nicht möglich')
      const trimmedRef = ref.trim()
      if (trimmedRef === '') throw new Error('Ein Ziel für den Branchwechsel ist erforderlich')
      await git.checkout({ fs, dir: WORKTREE, gitdir: GITDIR, ref: trimmedRef })
    },
    async readWorkspaceFile(path: string): Promise<Uint8Array> {
      await requireRepository(workspace, fs)
      return workspace.readFile(path)
    },
    async getFileAtRevision(revision: string, path: string): Promise<Uint8Array | undefined> {
      await requireRepository(workspace, fs)
      try {
        const oid = await resolveRevision(fs, revision)
        const result = await git.readBlob({ fs, dir: WORKTREE, gitdir: GITDIR, oid, filepath: path })
        return result.blob
      } catch (error) {
        if (isMissingGitObjectError(error)) return undefined
        throw error
      }
    },
  }
}

async function resolveRevision(fs: FsClient, revision: string): Promise<string> {
  try {
    return await git.resolveRef({ fs, dir: WORKTREE, gitdir: GITDIR, ref: revision })
  } catch {
    return git.expandOid({ fs, dir: WORKTREE, gitdir: GITDIR, oid: revision })
  }
}

async function loadTagsByCommit(fs: FsClient): Promise<Map<string, string[]>> {
  const tagsByCommit = new Map<string, string[]>()
  const tagNames = await git.listTags({ fs, dir: WORKTREE, gitdir: GITDIR })
  await Promise.all(tagNames.map(async (tagName) => {
    try {
      const oid = await resolveTagTarget(fs, tagName)
      const tags = tagsByCommit.get(oid) ?? []
      tags.push(tagName)
      tagsByCommit.set(oid, tags)
    } catch {
      // Ignore stale/broken tag references while keeping the commit history usable.
    }
  }))
  for (const tags of tagsByCommit.values()) tags.sort((left, right) => left.localeCompare(right))
  return tagsByCommit
}

async function resolveTagTarget(fs: FsClient, tagName: string): Promise<string> {
  let oid = await git.resolveRef({ fs, dir: WORKTREE, gitdir: GITDIR, ref: `refs/tags/${tagName}` })
  for (let depth = 0; depth < 8; depth += 1) {
    const object = await git.readObject({ fs, dir: WORKTREE, gitdir: GITDIR, oid, format: 'parsed' })
    if (object.type !== 'tag' || object.format !== 'parsed') return oid
    oid = object.object.object
  }
  throw new Error(`Tag ${tagName} verweist auf zu viele verschachtelte Tag-Objekte`)
}

async function requireRepository(workspace: WorkspaceFileSystem, fs: IsomorphicGitFs): Promise<boolean> {
  if (!await workspace.exists('.git/HEAD')) throw new Error('Der lokale Workspace ist noch kein Git-Repository')
  let ignoreCase = false
  try {
    const configured = await git.getConfig({ fs, dir: WORKTREE, gitdir: GITDIR, path: 'core.ignorecase' })
    ignoreCase = configured === true || configured === 'true'
  } catch {
    // Repositories without this optional setting use case-sensitive paths.
  }
  fs.setIgnoreCase(ignoreCase)
  return ignoreCase
}

function isGitCommitFile(value: unknown): value is GitCommitFile {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { path?: unknown; state?: unknown }
  return typeof candidate.path === 'string'
    && (candidate.state === 'added' || candidate.state === 'modified' || candidate.state === 'deleted')
}

async function removeCaseNormalizationNoise(statuses: GitFileStatus[], fs: IsomorphicGitFs, ignoreCase: boolean): Promise<GitFileStatus[]> {
  if (!ignoreCase) return statuses
  const groups = new Map<string, GitFileStatus[]>()
  for (const status of statuses) {
    const key = status.path.normalize('NFC').toLowerCase()
    const group = groups.get(key) ?? []
    group.push(status)
    groups.set(key, group)
  }
  const hidden = new Set<string>()
  for (const group of groups.values()) {
    const deleted = group.find((entry) => entry.state === 'deleted' && !entry.staged)
    const untracked = group.find((entry) => entry.state === 'untracked' && !entry.staged)
    if (deleted !== undefined && untracked !== undefined && await sameGitFileContent(fs, deleted.path, untracked.path)) {
      hidden.add(deleted.path)
      hidden.add(untracked.path)
    }
  }
  return statuses.filter((status) => !hidden.has(status.path))
}

async function isWorkspaceFileAtHead(fs: IsomorphicGitFs, path: string): Promise<boolean> {
  try {
    const oid = await resolveRevision(fs, 'HEAD')
    const revision = await git.readBlob({ fs, dir: WORKTREE, gitdir: GITDIR, oid, filepath: path })
    const workspace = await fs.promises.readFile(path)
    return bytesEqual(revision.blob, toBytes(workspace))
  } catch {
    return false
  }
}

async function sameGitFileContent(fs: IsomorphicGitFs, leftPath: string, rightPath: string): Promise<boolean> {
  try {
    const left = await fs.promises.readFile(leftPath)
    const right = await fs.promises.readFile(rightPath)
    return bytesEqual(toBytes(left), toBytes(right))
  } catch {
    return false
  }
}

function toBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === 'string' ? new TextEncoder().encode(data) : data
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

async function statusForPath(fs: FsClient, path: string): Promise<GitStatusMatrixEntry | undefined> {
  const matrix = await git.statusMatrix({ fs, dir: WORKTREE, gitdir: GITDIR, filepaths: [path] })
  const entry = matrix.find((candidate) => candidate[0] === path)
  if (entry === undefined) return undefined
  return { head: entry[1], workdir: entry[2], stage: entry[3] }
}

type GitStatusMatrixRow = [string, number, number, number]
interface GitStatusMatrixEntry {
  head: number
  workdir: number
  stage: number
}

function toGitFileStatus(entry: GitStatusMatrixRow): GitFileStatus {
  const [path, head, workdir, stage] = entry
  const staged = head !== stage
  const unstaged = workdir !== stage
  let state: GitFileState
  if (head === 0 && stage === 0) state = 'untracked'
  else if (workdir === 0) state = 'deleted'
  else if (head === 0) state = 'added'
  else if (head !== workdir || staged) state = 'modified'
  else state = 'unmodified'
  return { path, state, staged, unstaged }
}

function toGitCommit(entry: ReadCommitResult, tags: string[] = []): GitCommit {
  return {
    oid: entry.oid,
    shortOid: entry.oid.slice(0, 7),
    message: entry.commit.message.trim(),
    tags,
    author: entry.commit.author === undefined ? undefined : toIdentity(entry.commit.author),
    committer: entry.commit.committer === undefined ? undefined : toIdentity(entry.commit.committer),
  }
}

function toIdentity(identity: { name: string; email: string; timestamp: number }): GitIdentity {
  return { name: identity.name, email: identity.email, timestamp: identity.timestamp }
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((path) => path.replace(/^\/+/, '').replace(/\\/g, '/')).filter((path) => path !== '' && !path.startsWith('.git/')))]
}

function isMissingGitObjectError(error: unknown): boolean {
  return error instanceof Error && /not found|no such|does not exist|missing|could not find/i.test(error.message)
}

function isMissingWorkspacePath(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error as { code?: unknown }).code === 'ENOENT'
}
