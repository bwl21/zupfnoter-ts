import { CommandError, type CommandArguments, type CommandDefinition, type CommandResult, type CommandStack } from './commands.js'

export interface StorageCommandState {
  system: string
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
  login(path: StorageCommandState): Promise<void>
  logout(path: StorageCommandState): Promise<void>
  cleanup(path: StorageCommandState): Promise<void>
}

export function registerStorageCommands(
  stack: CommandStack,
  state: StorageCommandState,
  runtime: StorageCommandRuntime,
): void {
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
      state.path = normalizeStoragePath(state.path)
      state.loggedIn = true
      await runtime.login(state)
    },
  })

  stack.addCommand({
    name: 'sstatus',
    help: 'show active storage status',
    undoable: false,
    perform: (_args, context) => {
      context.log(`storage=${state.system} path=${state.path} loggedIn=${state.loggedIn}`)
    },
  })

  stack.addCommand({
    name: 'scd',
    help: 'change active storage path',
    undoable: false,
    parameters: [{ name: 'path', type: 'string', help: 'storage path' }],
    perform: async (args) => {
      state.path = normalizeStoragePath(String(args.path ?? ''))
    },
  })

  stack.addCommand({
    name: 'spwd',
    help: 'print active storage path',
    undoable: false,
    perform: (_args, context) => {
      context.log(`${state.system}//${state.path}`)
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
    name: 'sreconnect',
    help: 'reconnect active storage provider',
    undoable: false,
    perform: async () => {
      state.loggedIn = true
      await runtime.login(state)
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
      { name: 'query', type: 'string', help: 'optional filter', defaultValue: '*' },
      { name: 'flag', type: 'string', help: 'set to -r for recursive listing', defaultValue: '' },
    ],
    perform: async (args, context): Promise<void> => {
      const query = String(args.query ?? '*').trim()
      const flag = String(args.flag ?? '').trim()
      const recursive = flag === '-r' || flag === '--recursive'
      const results = filterStorageCandidates(await runtime.list(state, recursive), query)
      if (results.length === 0) {
        context.log(query === '*' || query === ''
          ? `no abc files in ${state.system}//${state.path}`
          : `no abc files for "${query}" in ${state.system}//${state.path}`)
        return
      }
      results.forEach((result) => context.log(result))
    },
  })

  stack.addCommand({
    name: 'sopen',
    help: 'open a file from active storage path',
    undoable: true,
    parameters: [{ name: 'filename', type: 'string', help: 'filename' }],
    perform: async (args, context): Promise<void | CommandResult> => {
      const filename = String(args.filename ?? '')
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
        const loaded = await runtime.open(state, selectedName)
        if (loaded === undefined) {
          throw new CommandError(`Unable to open: ${selectedName}`)
        }
        context.log(`open ${state.system}//${state.path}/${selectedName}`)
        state.loggedIn = true
        state.pendingCandidates = []
        const undoArguments: CommandArguments = {
          system: oldState.system,
          path: oldState.path,
          loggedIn: oldState.loggedIn,
          pendingCandidates: [...oldState.pendingCandidates],
        }
        return { undoArguments } as CommandResult
      }
      const candidates = filterStorageCandidates(await runtime.list(state), filename)
      if (candidates.length === 0) {
        throw new CommandError(`No matches for: ${filename}`)
      }
      if (candidates.length > 1) {
        context.log(`multiple matches for "${filename}" (use sopen <n>):`)
        candidates.forEach((candidate, index) => context.log(`${index + 1}. ${candidate}`))
        state.pendingCandidates = candidates
        return
      }
      const oldState = { ...state }
      const selectedName = candidates[0]
      if (selectedName === undefined) {
        throw new CommandError(`No matches for: ${filename}`)
      }
      const loaded = await runtime.open(state, selectedName)
      if (loaded === undefined) {
        throw new CommandError(`Unable to open: ${selectedName}`)
      }
      context.log(`open ${state.system}//${state.path}/${selectedName}`)
      state.loggedIn = true
      state.pendingCandidates = []
      const undoArguments: CommandArguments = {
        system: oldState.system,
        path: oldState.path,
        loggedIn: oldState.loggedIn,
        pendingCandidates: [...oldState.pendingCandidates],
      }
      return { undoArguments } as CommandResult
    },
    invert: (args) => {
      state.system = String(args.system ?? state.system)
      state.path = normalizeStoragePath(String(args.path ?? state.path))
      state.loggedIn = Boolean(args.loggedIn ?? state.loggedIn)
    },
  })

  stack.addCommand({
    name: 'ssave',
    help: 'save current file to active storage path',
    undoable: false,
    parameters: [{ name: 'filename', type: 'string', help: 'filename', defaultValue: '' }],
    perform: (args, context): void => {
      context.log(`save ${state.system}//${state.path}/${String(args.filename ?? '')}`)
    },
  })
}

function normalizeStoragePath(path: string): string {
  return path.replace(/^\/+/, '').replace(/\/+$/, '')
}

function filterStorageCandidates(entries: string[], query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase()
  return entries
    .filter((name) => name.toLowerCase().endsWith('.abc'))
    .filter((name) => normalizedQuery === '' || normalizedQuery === '*' || name.toLowerCase().includes(normalizedQuery))
    .sort()
}
