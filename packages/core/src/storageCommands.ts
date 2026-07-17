import { CommandError, type CommandArguments, type CommandDefinition, type CommandResult, type CommandStack } from './commands.js'
import { extractSongFilebase } from './extractSongConfig.js'
import type { StorageConnection, StorageConnectionStatus } from '@zupfnoter/types'

/**
 * Wird ausgegeben, wenn ein Speicherkommando kein beschreibbares Ziel hat.
 * Web-Anwendungen können darauf den Speicherverbindungsdialog öffnen; andere
 * Laufzeiten behandeln den Fehler wie jeden anderen Command-Fehler.
 */
export class StorageTargetUnavailableError extends CommandError {
  constructor(message: string) {
    super(message)
    this.name = 'StorageTargetUnavailableError'
  }
}

export interface StorageCommandState {
  system: string
  /** Aktive, persistierte Verbindungs-ID. */
  connectionId?: string
  /** Fester Anbieterpfad der aktiven Verbindungswurzel. */
  rootPath?: string
  /** Aktueller Pfad relativ zu rootPath. */
  path: string
  loggedIn: boolean
  pendingCandidates: string[]
}

export interface StorageCommandRuntime {
  providers: string[]
  list(path: StorageCommandState, recursive?: boolean): Promise<string[]>
  search(path: StorageCommandState, query: string): Promise<string[]>
  open(path: StorageCommandState, filename: string): Promise<string | undefined>
  save(path: StorageCommandState, filename: string, content: string): Promise<void>
  saveArtifacts?(path: StorageCommandState, filebase: string, documentText: string): Promise<StorageSaveArtifactResult>
  readDocument(): string
  writeDocument(content: string): void
  login(path: StorageCommandState): Promise<void>
  logout(path: StorageCommandState): Promise<void>
  cleanup(path: StorageCommandState): Promise<void>
  connections?: () => StorageConnection[]
  updateConnectionPath?: (connectionId: string, relativePath: string) => void
  updateConnectionStatus?: (connectionId: string, status: StorageConnectionStatus) => void
}

/** Ergebnis einer Speicherung mit mehreren erzeugten Dateien. */
export interface StorageSaveArtifactResult {
  /** Erfolgreich gespeicherte Dateinamen. */
  saved: string[]
  /** Nicht gespeicherte Dateinamen. */
  failed: string[]
}

export function registerStorageCommands(
  stack: CommandStack,
  state: StorageCommandState,
  runtime: StorageCommandRuntime,
): void {
  stack.addCommand({
    name: 'sconnections',
    help: 'list saved storage connections',
    undoable: false,
    perform: (_args, context) => {
      const connections = runtime.connections?.() ?? []
      if (connections.length === 0) {
        context.log('no saved storage connections')
        return
      }
      connections.forEach((connection) => {
        const active = connection.id === state.connectionId ? ' *' : ''
        context.log(`${connection.id} ${connection.providerId} ${connection.label} root=${connection.rootPath || '/'} readonly=${connection.readOnly} ${connection.status}${active}`)
      })
    },
  })

  stack.addCommand({
    name: 'sconnection',
    help: 'select an active storage connection',
    undoable: false,
    parameters: [{ name: 'id', type: 'string', help: 'saved connection id' }],
    perform: (args, context) => {
      const id = String(args.id ?? '')
      const connection = runtime.connections?.().find((entry) => entry.id === id)
      if (connection === undefined) throw new CommandError(`Unknown storage connection: ${id}`)
      state.connectionId = connection.id
      state.system = connection.providerId
      state.loggedIn = connection.status === 'connected'
      state.rootPath = normalizeStoragePath(connection.rootPath)
      state.path = normalizeRelativeStoragePath(connection.relativePath)
      context.log(`storage connection selected: ${connection.label} (${connection.providerId})`)
    },
  })

  stack.addCommand({
    name: 'sprovider',
    help: 'select active storage provider',
    undoable: false,
    parameters: [
      { name: 'system', type: 'string', help: 'storage provider system name', defaultValue: 'dropbox' },
    ],
    perform: async (args) => {
      const system = String(args.system ?? 'dropbox')
      if (!runtime.providers.includes(system)) {
        throw new CommandError(`Unsupported storage system: ${system}`)
      }
      state.system = system
      state.path = normalizeRelativeStoragePath(state.path)
      await runtime.login(state)
      state.loggedIn = true
    },
  })

  stack.addCommand({
    name: 'sstatus',
    help: 'show active storage status',
    undoable: false,
    perform: (_args, context) => {
      context.log(`storage=${state.system} connection=${state.connectionId ?? '-'} root=${state.rootPath || '/'} path=${state.path} loggedIn=${state.loggedIn}`)
    },
  })

  stack.addCommand({
    name: 'scd',
    help: 'change active storage path',
    undoable: false,
    parameters: [{ name: 'path', type: 'string', help: 'storage path' }],
    perform: async (args) => {
      const relativePath = normalizeRelativeStoragePath(String(args.path ?? ''))
      state.path = relativePath
      if (state.connectionId !== undefined) runtime.updateConnectionPath?.(state.connectionId, relativePath)
    },
  })

  stack.addCommand({
    name: 'spwd',
    help: 'print active storage path',
    undoable: false,
    perform: (_args, context) => {
      context.log(`${state.system}//${joinStoragePath(state.rootPath ?? '', state.path)}`)
    },
  })

  stack.addCommand({
    name: 'slogout',
    help: 'logout from active storage provider',
    undoable: false,
    perform: async () => {
      state.loggedIn = false
      await runtime.logout(state)
    },
  })

  stack.addCommand({
    name: 'sdisconnect',
    help: 'disconnect a saved storage connection',
    undoable: false,
    parameters: [{ name: 'id', type: 'string', help: 'saved connection id', defaultValue: '' }],
    perform: async (args) => {
      const id = String(args.id ?? '').trim() || state.connectionId
      const connection = runtime.connections?.().find((entry) => entry.id === id)
      if (connection === undefined) throw new CommandError('No saved storage connection selected')
      await runtime.logout({
        ...state,
        connectionId: connection.id,
        system: connection.providerId,
        rootPath: connection.rootPath,
        path: connection.relativePath,
      })
      runtime.updateConnectionStatus?.(connection.id, 'disconnected')
      if (state.connectionId === connection.id) state.loggedIn = false
    },
  })

  stack.addCommand({
    name: 'sreconnect',
    help: 'reconnect active storage provider',
    undoable: false,
    perform: async () => {
      await runtime.login(state)
      state.loggedIn = true
    },
  })

  stack.addCommand({
    name: 'scleanup',
    help: 'cleanup active storage provider',
    undoable: false,
    perform: async () => {
      await runtime.cleanup(state)
    },
  })

  stack.addCommand({
    name: 'ssearch',
    help: 'search in active storage path',
    undoable: false,
    parameters: [{ name: 'query', type: 'string', help: 'search query' }],
    perform: async (args, context): Promise<void> => {
      const query = String(args.query ?? '')
      const results = await runtime.search(state, query)
      if (results.length === 0) {
        context.log(`no matches for "${query}" in ${state.system}//${state.path}`)
        return
      }
      results.forEach((result) => context.log(result))
    },
  })

  stack.addCommand({
    name: 'sls',
    help: 'list abc files in active storage path',
    undoable: false,
    parameters: [
      { name: 'flag', type: 'string', help: 'set to -r for recursive listing', defaultValue: '' },
      { name: 'query', type: 'string', help: 'optional filter', defaultValue: '*' },
    ],
    perform: async (args, context): Promise<void> => {
      const flag = String(args.flag ?? '').trim()
      const query = String(args.query ?? '*').trim()
      const recursive = flag === '-r' || flag === '--recursive'
      const search = recursive && query === '*' ? '' : query
      const results = recursive
        ? await runtime.search(state, search)
        : filterStorageCandidates(await runtime.list(state, false), search, false)
      if (results.length === 0) {
        context.log(search === '*' || search === ''
          ? `no abc files in ${state.system}//${state.path}`
          : `no abc files for "${search}" in ${state.system}//${state.path}`)
        return
      }
      results.forEach((result) => context.log(result))
    },
  })

  stack.addCommand({
    name: 'sopen',
    help: 'open a file from active storage path',
    undoable: true,
    parameters: [
      { name: 'flag', type: 'string', help: 'set to -r for recursive listing', defaultValue: '' },
      { name: 'filename', type: 'string', help: 'filename', defaultValue: '' },
    ],
    perform: async (args, context): Promise<void | CommandResult> => {
      const flag = String(args.flag ?? '').trim()
      const recursive = flag === '-r' || flag === '--recursive'
      const rawFilename = String(args.filename ?? '').trim()
      const filename = recursive && rawFilename === '' ? '*' : (recursive && rawFilename !== '' ? rawFilename : (flag === '' ? rawFilename : flag))
      const numericSelection = Number.parseInt(filename, 10)
      if (
        state.pendingCandidates.length > 0
        && Number.isInteger(numericSelection)
        && numericSelection >= 1
        && numericSelection <= state.pendingCandidates.length
      ) {
        const selectedName = state.pendingCandidates[numericSelection - 1]
        if (selectedName === undefined) {
          throw new CommandError(`Candidate not found: ${numericSelection}`)
        }
        const oldState = { ...state }
        const previousDocument = runtime.readDocument()
        const loaded = await runtime.open(state, selectedName)
        if (loaded === undefined) {
          throw new CommandError(`Unable to open: ${selectedName}`)
        }
        runtime.writeDocument(loaded)
        context.log(`open ${state.system}//${state.path}/${selectedName}`)
        state.loggedIn = true
        state.pendingCandidates = []
        const undoArguments: CommandArguments = {
          system: oldState.system,
          path: oldState.path,
          loggedIn: oldState.loggedIn,
          pendingCandidates: [...oldState.pendingCandidates],
          documentText: previousDocument,
        }
        return { undoArguments } as CommandResult
      }
      const query = recursive ? rawFilename : (flag === '' ? rawFilename : flag)
      const candidates = recursive
        ? await runtime.search(state, query)
        : filterStorageCandidates(await runtime.list(state, false), query, false)
      if (candidates.length === 0) {
        throw new CommandError(`No matches for: ${query}`)
      }
      if (candidates.length > 1) {
        context.log(`multiple matches for "${query}" (use sopen <n>):`)
        candidates.forEach((candidate, index) => context.log(`${index + 1}. ${candidate}`))
        state.pendingCandidates = candidates
        return
      }
      const oldState = { ...state }
      const selectedName = candidates[0]
      if (selectedName === undefined) {
        throw new CommandError(`No matches for: ${query}`)
      }
      const previousDocument = runtime.readDocument()
      const loaded = await runtime.open(state, selectedName)
      if (loaded === undefined) {
        throw new CommandError(`Unable to open: ${selectedName}`)
      }
      runtime.writeDocument(loaded)
      context.log(`open ${state.system}//${state.path}/${selectedName}`)
      state.loggedIn = true
      state.pendingCandidates = []
      const undoArguments: CommandArguments = {
        system: oldState.system,
        path: oldState.path,
        loggedIn: oldState.loggedIn,
        pendingCandidates: [...oldState.pendingCandidates],
        documentText: previousDocument,
      }
      return { undoArguments } as CommandResult
    },
    invert: (args) => {
      state.system = String(args.system ?? state.system)
      state.path = normalizeRelativeStoragePath(String(args.path ?? state.path))
      state.loggedIn = Boolean(args.loggedIn ?? state.loggedIn)
      const documentText = args.documentText
      if (typeof documentText === 'string') {
        runtime.writeDocument(documentText)
      }
    },
  })

  stack.addCommand({
    name: 'ssave',
    help: 'save current file to active storage path using its F: header',
    undoable: false,
    perform: async (args, context): Promise<void> => {
      const connections = runtime.connections?.()
      const connection = connections?.find((entry) => entry.id === state.connectionId)
      if (state.connectionId === undefined || (connections !== undefined && connection === undefined)) {
        throw new StorageTargetUnavailableError('No writable storage connection selected')
      }
      if (connection?.readOnly === true) {
        throw new StorageTargetUnavailableError(`Storage connection is read-only: ${connection.label}`)
      }
      const documentText = runtime.readDocument()
      const filename = storageFilenameFromDocument(documentText)
      const filebase = filename.replace(/\.abc$/i, '')
      const result = runtime.saveArtifacts === undefined
        ? (await runtime.save(state, filename, documentText), { saved: [filename], failed: [] })
        : await runtime.saveArtifacts(state, filebase, documentText)
      result.saved.forEach((name) => context.log(`save ${state.system}//${joinStoragePath(state.rootPath ?? '', state.path)}/${name}`))
      const target = connection?.label ?? state.system
      if (result.failed.length === 0) {
        context.log(`storage save complete: ${target} (${result.saved.length} files)`)
      } else {
        context.log(`storage save incomplete: ${target} (${result.saved.length} saved, ${result.failed.length} failed)`)
      }
    },
  })
}

/**
 * Ermittelt den ABC-Dateinamen aus der F:-Kopfzeile.
 *
 * Der Legacy-Befehl `dsave` verwendet ebenfalls den `F:`-Wert als Filebase
 * und ergänzt beim Speichern die Endung `.abc`.
 */
function storageFilenameFromDocument(documentText: string): string {
  const filebase = extractSongFilebase(documentText)

  if (filebase === undefined || filebase === '') {
    throw new CommandError('Filename not specified in song add an F: instruction')
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(filebase)) {
    throw new CommandError(`bad characters in filename: ${filebase}`)
  }
  return `${filebase}.abc`
}

function normalizeStoragePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '')
}

function normalizeRelativeStoragePath(path: string): string {
  const normalized = normalizeStoragePath(path)
  const parts = normalized.split('/').filter((part) => part !== '' && part !== '.')
  if (parts.some((part) => part === '..')) throw new CommandError('Storage path must stay inside the connection root')
  return parts.join('/')
}

function joinStoragePath(rootPath: string, relativePath: string): string {
  const root = normalizeStoragePath(rootPath)
  const relative = normalizeRelativeStoragePath(relativePath)
  return root === '' ? relative : (relative === '' ? root : `${root}/${relative}`)
}

function filterStorageCandidates(entries: string[], query: string, recursive: boolean): string[] {
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = entries
    .filter((name) => name.toLowerCase().endsWith('.abc'))
    .filter((name) => normalizedQuery === '' || normalizedQuery === '*' || name.toLowerCase().includes(normalizedQuery))
  return recursive
    ? filtered.sort(compareStoragePaths)
    : filtered.sort((left, right) => left.localeCompare(right))
}

function compareStoragePaths(left: string, right: string): number {
  const leftParts = left.split('/').filter((part) => part !== '')
  const rightParts = right.split('/').filter((part) => part !== '')
  const length = Math.min(leftParts.length, rightParts.length)
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index]
    const rightPart = rightParts[index]
    if (leftPart === undefined || rightPart === undefined) break
    const comparison = leftPart.localeCompare(rightPart, undefined, { numeric: true, sensitivity: 'base' })
    if (comparison !== 0) return comparison
  }
  return leftParts.length - rightParts.length
}
