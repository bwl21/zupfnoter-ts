import {
  CommandError,
  CommandStack,
  type CommandArgumentValue,
  type CommandArguments,
  type CommandDefinition,
} from './commands'

export interface WorkbenchCommandRuntime {
  getAbcText(): string
  setAbcText(value: string): void
  render(): void
  play(range: string): void
  stop(): void
  setSpeed(speed: number): void
  setEditorTab(tab: 'abc' | 'lyrics' | 'config'): void
  setCurrentExtract(extract: number): void
  setSaveFormat(saveFormat: string): void
  setLogLevel(level: string): void
  setAutoRefresh(value: 'on' | 'off' | 'remote'): void
  setSetting(key: string, value: string): void
  getSetting(key: string): string | undefined
  listSettings(): Record<string, string>
  downloadAbc(): void
  listLocalStore(): string[]
  saveLocalStore(): void
  openLocalStore(id: string): string | undefined
}

export function registerLegacyCommands(stack: CommandStack, runtime: WorkbenchCommandRuntime): void {
  registerInternalCommands(stack, runtime)
  registerPlaybackCommands(stack, runtime)
  registerCreateAndConfigCommands(stack, runtime)
  registerLocalStoreCommands(stack, runtime)
  registerDropboxCommands(stack)
}

function registerInternalCommands(stack: CommandStack, runtime: WorkbenchCommandRuntime): void {
  stack.addCommand({
    name: 'help',
    help: 'show command help',
    undoable: false,
    parameters: [{ name: 'what', type: 'string', help: 'filter string', defaultValue: '' }],
    perform: (args, context) => {
      const filter = readString(args, 'what')
      stack.help(filter).forEach((line) => context.log(line))
    },
  })

  stack.addCommand({
    name: 'view',
    help: 'set current extract and redisplay',
    undoable: false,
    parameters: [{ name: 'view', type: 'number', help: 'extract id', defaultValue: 0 }],
    perform: (args) => {
      runtime.setCurrentExtract(readNumber(args, 'view'))
      runtime.render()
    },
  })

  stack.addCommand({
    name: 'saveformat',
    help: 'set current file formats for saving',
    undoable: false,
    parameters: [{ name: 'saveformat', type: 'string', help: 'A3, A4 or A3-A4', defaultValue: 'A3-A4' }],
    perform: (args) => runtime.setSaveFormat(readString(args, 'saveformat').toUpperCase()),
  })

  stack.addCommand({
    name: 'loglevel',
    help: 'set log level',
    undoable: false,
    parameters: [{ name: 'level', type: 'string', help: 'error | warning | info | debug', defaultValue: 'warning' }],
    perform: (args) => runtime.setLogLevel(readString(args, 'level')),
  })

  stack.addCommand({
    name: 'autorefresh',
    help: 'set autorefresh mode',
    undoable: false,
    parameters: [{ name: 'value', type: 'string', help: 'on | off | remote', defaultValue: 'on' }],
    perform: (args) => {
      const value = readString(args, 'value')
      if (value !== 'on' && value !== 'off' && value !== 'remote') {
        throw new CommandError(`Unsupported autorefresh mode: ${value}`)
      }
      runtime.setAutoRefresh(value)
    },
  })

  for (const name of ['undo', 'redo']) {
    stack.addCommand({
      name,
      help: `${name} last command`,
      undoable: false,
      perform: () => {
        if (name === 'undo') stack.undo()
        if (name === 'redo') stack.redo()
      },
    })
  }

  stack.addCommand({
    name: 'history',
    help: 'show command history',
    undoable: false,
    perform: (_args, context) => logHistory(context.log, stack.history()),
  })

  stack.addCommand({
    name: 'showundo',
    help: 'show undo stack',
    undoable: false,
    perform: (_args, context) => logHistory(context.log, stack.undoHistory()),
  })

  stack.addCommand({
    name: 'showredo',
    help: 'show redo stack',
    undoable: false,
    perform: (_args, context) => logHistory(context.log, stack.redoHistory()),
  })

  for (const name of ['selectinallvoices', 'editunison']) {
    stack.addCommand(notAvailableCommand(name, 'legacy editor selection tooling is not ported yet'))
  }
}

function registerPlaybackCommands(stack: CommandStack, runtime: WorkbenchCommandRuntime): void {
  stack.addCommand({
    name: 'p',
    help: 'play song',
    undoable: false,
    parameters: [{ name: 'range', type: 'string', help: 'auto | sel | ff | all', defaultValue: 'ff' }],
    perform: (args) => runtime.play(readString(args, 'range')),
  })

  stack.addCommand({
    name: 'speed',
    help: 'set playing speed',
    undoable: false,
    parameters: [{ name: 'speed', type: 'number', help: 'value < 1 slower, > 1 faster', defaultValue: 1 }],
    perform: (args) => runtime.setSpeed(readNumber(args, 'speed')),
  })

  stack.addCommand({
    name: 'stop',
    help: 'stop playing',
    undoable: false,
    perform: () => runtime.stop(),
  })

  stack.addCommand({
    name: 'render',
    help: 'refresh previews',
    undoable: false,
    perform: () => runtime.render(),
  })
}

function registerCreateAndConfigCommands(stack: CommandStack, runtime: WorkbenchCommandRuntime): void {
  stack.addCommand({
    name: 'c',
    help: 'create song',
    parameters: [
      { name: 'id', type: 'string', help: 'value for X: line' },
      { name: 'title', type: 'string', help: 'title of the song', defaultValue: 'untitled' },
    ],
    perform: (args) => {
      const oldValue = runtime.getAbcText()
      const id = readString(args, 'id')
      const title = readString(args, 'title')
      runtime.setAbcText(createNewSongAbc(id, title))
      runtime.render()
      return { undoArguments: { oldValue } }
    },
    invert: (args) => runtime.setAbcText(readString(args, 'oldValue')),
  })

  stack.addCommand({
    name: 'drop',
    help: 'handle a dropped ABC file',
    perform: (args) => {
      const oldValue = runtime.getAbcText()
      const value = readString(args, 'value')
      runtime.setAbcText(value)
      runtime.render()
      return { undoArguments: { oldValue } }
    },
    parameters: [{ name: 'value', type: 'string', help: 'ABC text' }],
    invert: (args) => runtime.setAbcText(readString(args, 'oldValue')),
  })

  stack.addCommand({
    name: 'download_abc',
    help: 'download as ABC',
    undoable: false,
    perform: () => runtime.downloadAbc(),
  })

  stack.addCommand({
    name: 'setsetting',
    help: 'adjust runtime setting',
    undoable: false,
    parameters: [
      { name: 'key', type: 'string', help: 'setting key' },
      { name: 'value', type: 'string', help: 'setting value' },
    ],
    perform: (args) => runtime.setSetting(readString(args, 'key'), readString(args, 'value')),
  })

  stack.addCommand({
    name: 'togglesetting',
    help: 'toggle runtime setting',
    undoable: false,
    parameters: [{ name: 'key', type: 'string', help: 'setting key' }],
    perform: (args) => {
      const key = readString(args, 'key')
      runtime.setSetting(key, runtime.getSetting(key) === 'true' ? 'false' : 'true')
    },
  })

  stack.addCommand({
    name: 'editconf',
    help: 'open configuration editor',
    undoable: false,
    parameters: [{ name: 'set', type: 'string', help: 'configuration form', defaultValue: 'basic_settings' }],
    perform: (_args) => runtime.setEditorTab('config'),
  })

  for (const name of [
    'pasteDatauri',
    'stdnotes',
    'stdextract',
    'setstdnotes',
    'setstdextract',
    'resettemplate',
    'settemplate',
    'edittemplate',
    'maketemplate',
    'addconf',
    'undoconfig',
    'redoconfig',
    'hconfig',
    'editsnippet',
    'addsnippet',
    'adddecoration',
    'cconf',
    'delconfig',
    'cpconfig',
  ]) {
    stack.addCommand(notAvailableCommand(name, 'legacy config/snippet editor is not ported yet'))
  }
}

function registerLocalStoreCommands(stack: CommandStack, runtime: WorkbenchCommandRuntime): void {
  stack.addCommand({
    name: 'lsave',
    help: 'save to local storage',
    undoable: false,
    perform: () => runtime.saveLocalStore(),
  })

  stack.addCommand({
    name: 'lls',
    help: 'list files in local storage',
    undoable: false,
    perform: (_args, context) => {
      const entries = runtime.listLocalStore()
      if (entries.length === 0) {
        context.log('local store is empty')
        return
      }
      entries.forEach((entry) => context.log(entry))
    },
  })

  stack.addCommand({
    name: 'lopen',
    help: 'open song from local storage',
    parameters: [{ name: 'id', type: 'string', help: 'id of the song to be loaded' }],
    perform: (args) => {
      const oldValue = runtime.getAbcText()
      const loadedValue = runtime.openLocalStore(readString(args, 'id'))
      if (loadedValue === undefined) {
        throw new CommandError(`Song not found: ${readString(args, 'id')}`)
      }
      runtime.setAbcText(loadedValue)
      runtime.render()
      return { undoArguments: { oldValue } }
    },
    invert: (args) => runtime.setAbcText(readString(args, 'oldValue')),
  })
}

function registerDropboxCommands(stack: CommandStack): void {
  for (const name of [
    'dreconnect',
    'dlogin',
    'dlogout',
    'dls',
    'dcd',
    'dpwd',
    'dchoose',
    'dsave',
    'dopen',
    'dopentemplate',
    'dopenfn',
  ]) {
    stack.addCommand(notAvailableCommand(name, 'Dropbox integration is not ported yet'))
  }
}

function notAvailableCommand(name: string, reason: string): CommandDefinition {
  return {
    name,
    help: `${name} (${reason})`,
    undoable: false,
    perform: (_args, context) => context.log(`${name}: ${reason}`),
  }
}

function readString(args: CommandArguments, key: string): string {
  const value = args[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  throw new CommandError(`Argument <${key}> must be a string`)
}

function readNumber(args: CommandArguments, key: string): number {
  const value = args[key]
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) return numericValue
  }
  throw new CommandError(`Argument <${key}> must be a number`)
}

function logHistory(log: (message: string) => void, entries: { commandName: string; args: CommandArguments }[]): void {
  if (entries.length === 0) {
    log('empty')
    return
  }
  entries.forEach((entry, index) => {
    log(`${index + 1}: ${entry.commandName} ${formatArgs(entry.args)}`)
  })
}

function formatArgs(args: CommandArguments): string {
  return Object.entries(args)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ')
}

function formatValue(value: CommandArgumentValue): string {
  if (typeof value === 'string') return JSON.stringify(value)
  return JSON.stringify(value)
}

function createNewSongAbc(id: string, title: string): string {
  return [
    `X:${id}`,
    `T:${title}`,
    'M:4/4',
    'L:1/4',
    'K:C',
    'C D E F | G A B c |]',
    '',
  ].join('\n')
}
