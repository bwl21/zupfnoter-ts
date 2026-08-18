import type { WorkspaceFileStat, WorkspaceFileSystem } from './workspaceFileSystem'

export type ProjectPath = string & { readonly __projectPath: unique symbol }

export interface ProjectEntry {
  name: string
  path: ProjectPath
  kind: 'file' | 'directory'
}

export interface ProjectFileSystem {
  readFile(path: ProjectPath | string): Promise<Uint8Array>
  writeFile(path: ProjectPath | string, data: Uint8Array | string): Promise<void>
  deleteFile(path: ProjectPath | string): Promise<void>
  removeDirectory(path: ProjectPath | string, recursive?: boolean): Promise<void>
  mkdir(path: ProjectPath | string): Promise<void>
  readdir(path: ProjectPath | string): Promise<string[]>
  listDirectory(path: ProjectPath | string): Promise<ProjectEntry[]>
  stat(path: ProjectPath | string): Promise<WorkspaceFileStat>
  exists(path: ProjectPath | string): Promise<boolean>
  rename(oldPath: ProjectPath | string, newPath: ProjectPath | string): Promise<void>
}

export const PROJECT_MARKER_PATH = '.zupfnoter-project' as ProjectPath

export interface ProjectMarker {
  type: 'zupfnoter-project'
  version: 1
  id: string
}

export class ProjectPathError extends Error {
  readonly path: string

  constructor(path: string, message = `Ungültiger Projektpfad: ${path}`) {
    super(message)
    this.name = 'ProjectPathError'
    this.path = path
  }
}

export class ProjectMarkerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectMarkerError'
  }
}

export function validateProjectPath(path: string): ProjectPath {
  if (typeof path !== 'string' || path.length === 0 || path.includes('\0')) throw new ProjectPathError(path)
  if (path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:([\\/]|$)/.test(path)) throw new ProjectPathError(path)
  if (path.includes('\\')) throw new ProjectPathError(path)
  const parts = path.split('/')
  if (parts.some((part) => part === '' || part === '.' || part === '..')) throw new ProjectPathError(path)
  return path as ProjectPath
}

function validatedPath(path: ProjectPath | string): ProjectPath {
  if (path === '') return '' as ProjectPath
  return validateProjectPath(path)
}

function isGitPath(path: string): boolean {
  return path === '.git' || path.startsWith('.git/')
}

function isKnownProjectFile(path: string): boolean {
  return path === PROJECT_MARKER_PATH
    || isGitPath(path)
    || /\.(abc|json|ya?ml|pdf|html?|svg)$/i.test(path)
}

function assertWritablePath(path: ProjectPath): void {
  if (!isKnownProjectFile(path)) {
    throw new ProjectPathError(path, `Datei darf durch die Projekt-Schreib-Policy nicht geschrieben werden: ${path}`)
  }
}

export function isAllowedProjectWritePath(path: string): boolean {
  try {
    return isKnownProjectFile(validateProjectPath(path))
  } catch {
    return false
  }
}

/** Additional heuristic only; the marker remains the real project boundary. */
export function validateProjectRootName(name: string): void {
  const normalized = name.trim().toLocaleLowerCase()
  const criticalNames = new Set(['/', 'users', 'home', 'windows', 'system', 'applications', 'program files'])
  if (criticalNames.has(normalized) || /^[a-z]:[\\/]?$/.test(normalized)) {
    throw new ProjectMarkerError(`Der ausgewählte Ordner „${name}“ ist keine plausible Zupfnoter-Projektwurzel`)
  }
}

export function createProjectFileSystem(
  workspace: WorkspaceFileSystem,
  options: { requestWritePermission?: () => Promise<void> } = {},
): ProjectFileSystem {
  const path = (value: ProjectPath | string): ProjectPath => validatedPath(value)
  const beforeWrite = async (value: ProjectPath): Promise<void> => {
    assertWritablePath(value)
    await options.requestWritePermission?.()
  }
  return {
    readFile: (value) => workspace.readFile(path(value)),
    writeFile: async (value, data) => {
      const normalized = path(value)
      await beforeWrite(normalized)
      await workspace.writeFile(normalized, data)
    },
    deleteFile: async (value) => {
      const normalized = path(value)
      await beforeWrite(normalized)
      await workspace.deleteFile(normalized)
    },
    removeDirectory: async (value, recursive) => {
      const normalized = path(value)
      if (!isGitPath(normalized)) throw new ProjectPathError(normalized, `Ordner darf nicht durch die Projekt-Policy gelöscht werden: ${normalized}`)
      await beforeWrite(normalized)
      await workspace.removeDirectory(normalized, recursive)
    },
    mkdir: async (value) => {
      const normalized = path(value)
      if (!isGitPath(normalized)) throw new ProjectPathError(normalized, `Ordner darf nicht durch die Projekt-Policy angelegt werden: ${normalized}`)
      await beforeWrite(normalized)
      await workspace.mkdir(normalized)
    },
    readdir: (value) => workspace.readdir(path(value)),
    listDirectory: async (value) => {
      const normalized = path(value)
      const entries = workspace.listDirectory !== undefined
        ? await workspace.listDirectory(normalized)
        : await Promise.all((await workspace.readdir(normalized)).map(async (name) => ({ name, kind: (await workspace.stat(validateProjectPath(normalized === '' ? name : `${normalized}/${name}`))).kind })))
      return entries.map((entry) => {
        const child = validateProjectPath(normalized === '' ? entry.name : `${normalized}/${entry.name}`)
        return { name: entry.name, path: child, kind: entry.kind }
      })
    },
    stat: (value) => workspace.stat(path(value)),
    exists: (value) => workspace.exists(path(value)),
    rename: async (oldValue, newValue) => {
      const oldPath = path(oldValue)
      const newPath = path(newValue)
      assertWritablePath(oldPath)
      assertWritablePath(newPath)
      await options.requestWritePermission?.()
      await workspace.rename(oldPath, newPath)
    },
  }
}

export async function readProjectMarker(fs: ProjectFileSystem): Promise<ProjectMarker> {
  let raw: Uint8Array
  try {
    raw = await fs.readFile(PROJECT_MARKER_PATH)
  } catch {
    throw new ProjectMarkerError(`Kein Zupfnoter-Projektmarker (${PROJECT_MARKER_PATH}) gefunden`)
  }
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder().decode(raw))
  } catch {
    throw new ProjectMarkerError('Der Zupfnoter-Projektmarker enthält kein gültiges JSON')
  }
  if (!isProjectMarker(value)) throw new ProjectMarkerError('Der Zupfnoter-Projektmarker hat einen unbekannten Typ oder eine unbekannte Version')
  return value
}

export async function createProjectMarker(fs: ProjectFileSystem, id: string): Promise<ProjectMarker> {
  if (await fs.exists(PROJECT_MARKER_PATH)) throw new ProjectMarkerError('Dieses Verzeichnis ist bereits als Zupfnoter-Projekt eingerichtet')
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) throw new ProjectMarkerError('Die Projekt-ID ist ungültig')
  const marker: ProjectMarker = { type: 'zupfnoter-project', version: 1, id }
  await fs.writeFile(PROJECT_MARKER_PATH, `${JSON.stringify(marker, null, 2)}\n`)
  return marker
}

function isProjectMarker(value: unknown): value is ProjectMarker {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return record.type === 'zupfnoter-project' && record.version === 1 && typeof record.id === 'string' && record.id.length > 0
}
