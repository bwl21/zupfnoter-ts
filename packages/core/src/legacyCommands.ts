import {
  CommandError,
  CommandStack,
  type CommandArgumentValue,
  type CommandArguments,
  type CommandDefinition,
} from './commands.js'

export interface WorkbenchCommandRuntime {
  getAbcText(): string
  setAbcText(value: string): void
  render(): void
  play(range: string): void
  stop(): void
  openHarpDuplicate(): void
  openPanelDuplicate(target: string): void
  setSpeed(speed: number): void
  setEditorTab(tab: 'abc' | 'lyrics' | 'config'): void
  setCurrentExtract(extract: number): void
  setSound(sound: string): void
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
  registerCreateAndConfigCommands(stack, runtime, createCommandState(runtime))
  registerLocalStoreCommands(stack, runtime)
  registerDropboxCommands(stack)
}

interface LegacyCommandState {
  template: string
  standardNotes: CommandArgumentValue | undefined
  standardExtract: CommandArgumentValue | undefined
  configUndoStack: ConfigHistoryEntry[]
  configRedoStack: ConfigHistoryEntry[]
}

interface ConfigHistoryEntry {
  title: string
  previousAbcText: string
  nextAbcText: string
}

function createCommandState(runtime: WorkbenchCommandRuntime): LegacyCommandState {
  return {
    template: createTemplateFromAbc(runtime.getAbcText()),
    standardNotes: undefined,
    standardExtract: undefined,
    configUndoStack: [],
    configRedoStack: [],
  }
}

export function createLegacyCommandStack(
  runtime: WorkbenchCommandRuntime,
  log: (message: string) => void,
): CommandStack {
  const stack = new CommandStack({ log })
  registerLegacyCommands(stack, runtime)
  return stack
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
      if (filter === 'panel') {
        context.log('panel duplicate harp - duplicate the harp panel into a second window')
        context.log('panel duplicate notes - duplicate the notes panel into a second window')
      }
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
    name: 'panel',
    help: 'duplicate a panel into a second window (harp | notes)',
    undoable: false,
    parameters: [
      { name: 'action', type: 'string', help: 'panel action', defaultValue: 'duplicate' },
      { name: 'target', type: 'string', help: 'panel target', defaultValue: 'harp' },
    ],
    perform: (args) => {
      const action = readString(args, 'action')
      const target = readString(args, 'target')
      if (action !== 'duplicate') {
        throw new CommandError(`Unsupported panel action: ${action}`)
      }
      if (target !== 'harp' && target !== 'notes') {
        throw new CommandError(`Unsupported panel target: ${target}`)
      }
      runtime.openPanelDuplicate(target)
    },
  })

  stack.addCommand({
    name: 'sound',
    help: 'set playback sound',
    undoable: false,
    parameters: [{ name: 'sound', type: 'string', help: 'harp | piano | western-guitar', defaultValue: 'harp' }],
    perform: (args) => runtime.setSound(readString(args, 'sound')),
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

function registerCreateAndConfigCommands(
  stack: CommandStack,
  runtime: WorkbenchCommandRuntime,
  state: LegacyCommandState,
): void {
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
    name: 'pasteDatauri',
    help: 'handle a dropped resource by data URI',
    undoable: false,
    parameters: [
      { name: 'key', type: 'string', help: 'resource name' },
      { name: 'value', type: 'string', help: 'resource data URI' },
    ],
    perform: (args) => {
      const key = sanitizeResourceKey(readString(args, 'key'))
      patchConfig(runtime, state, `$resources.${key}`, readString(args, 'value'), `pasteDatauri ${key}`)
    },
  })

  stack.addCommand({
    name: 'stdnotes',
    help: 'configure extract with standard notes',
    undoable: false,
    perform: () => {
      if (state.standardNotes === undefined) {
        throw new CommandError('No standard notes configured')
      }
      patchConfig(runtime, state, 'extract.0', state.standardNotes, 'stdnotes')
      runtime.render()
    },
  })

  stack.addCommand({
    name: 'stdextract',
    help: 'configure with standard extract',
    undoable: false,
    perform: () => {
      if (state.standardExtract === undefined) {
        throw new CommandError('No standard extract configured')
      }
      patchConfig(runtime, state, 'extract', state.standardExtract, 'stdextract')
      runtime.render()
    },
  })

  stack.addCommand({
    name: 'setstdnotes',
    help: 'store current extract.0 as standard notes',
    undoable: false,
    perform: (_args, context) => {
      state.standardNotes = getConfigPath(readConfig(runtime.getAbcText()), 'extract.0')
      context.log('standard notes updated')
    },
  })

  stack.addCommand({
    name: 'setstdextract',
    help: 'store current extract map as standard extract',
    undoable: false,
    perform: (_args, context) => {
      state.standardExtract = getConfigPath(readConfig(runtime.getAbcText()), 'extract')
      context.log('standard extract updated')
    },
  })

  stack.addCommand({
    name: 'resettemplate',
    help: 'reset template to current default',
    undoable: false,
    perform: (_args, context) => {
      state.template = createDefaultTemplate()
      context.log('template reset')
    },
  })

  stack.addCommand({
    name: 'settemplate',
    help: 'set current editor content as template',
    undoable: false,
    perform: () => {
      const text = runtime.getAbcText()
      if (!text.includes('F:{{')) {
        throw new CommandError('current file is not a template. It does not have a placeholder in F: line')
      }
      state.template = text
    },
  })

  stack.addCommand({
    name: 'edittemplate',
    help: 'load current template to the editor',
    perform: () => {
      const oldValue = runtime.getAbcText()
      runtime.setAbcText(state.template)
      return { undoArguments: { oldValue } }
    },
    invert: (args) => runtime.setAbcText(readString(args, 'oldValue')),
  })

  stack.addCommand({
    name: 'maketemplate',
    help: 'convert current editor content to a template',
    perform: () => {
      const oldValue = runtime.getAbcText()
      const template = createTemplateFromAbc(oldValue)
      state.template = template
      runtime.setAbcText(template)
      return { undoArguments: { oldValue } }
    },
    invert: (args) => runtime.setAbcText(readString(args, 'oldValue')),
  })

  stack.addCommand({
    name: 'download_abc',
    help: 'download as ABC',
    undoable: false,
    perform: () => runtime.downloadAbc(),
  })

  stack.addCommand({
    name: 'undoconfig',
    help: 'undo last configuration change',
    undoable: false,
    perform: (_args, context) => {
      const entry = state.configUndoStack.pop()
      if (entry === undefined) {
        context.log('No config change to undo')
        return
      }
      runtime.setAbcText(entry.previousAbcText)
      state.configRedoStack.push(entry)
      context.log(`undid ${entry.title}`)
    },
  })

  stack.addCommand({
    name: 'redoconfig',
    help: 'redo last configuration change',
    undoable: false,
    perform: (_args, context) => {
      const entry = state.configRedoStack.pop()
      if (entry === undefined) {
        context.log('No config change to redo')
        return
      }
      runtime.setAbcText(entry.nextAbcText)
      state.configUndoStack.push(entry)
      context.log(`redid ${entry.title}`)
    },
  })

  stack.addCommand({
    name: 'hconfig',
    help: 'show undoable configuration changes',
    undoable: false,
    perform: (_args, context) => {
      if (state.configUndoStack.length === 0) {
        context.log('empty')
        return
      }
      state.configUndoStack.forEach((entry) => context.log(entry.title))
    },
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

  stack.addCommand({
    name: 'cconf',
    help: 'set configuration parameter in editor pane',
    undoable: false,
    parameters: [
      { name: 'key', type: 'string', help: 'configuration key' },
      { name: 'value', type: 'string', help: 'configuration value as JSON or string' },
    ],
    perform: (args) => {
      const key = readString(args, 'key')
      patchConfig(runtime, state, key, parseConfigCommandValue(readString(args, 'value')), `cconf ${key}`)
      runtime.render()
    },
  })

  stack.addCommand({
    name: 'delconfig',
    help: 'delete configuration parameter in editor pane',
    undoable: false,
    parameters: [{ name: 'key', type: 'string', help: 'configuration key' }],
    perform: (args) => {
      const key = readString(args, 'key')
      deleteConfig(runtime, state, key, `delconfig ${key}`)
      runtime.render()
    },
  })

  stack.addCommand({
    name: 'cpconfig',
    help: 'copy config parameter to other extract',
    undoable: false,
    parameters: [
      { name: 'key', type: 'string', help: 'configuration key' },
      { name: 'targetid', type: 'string', help: 'target extract number' },
    ],
    perform: (args) => {
      const key = readString(args, 'key')
      const targetId = readString(args, 'targetid')
      const config = readConfig(runtime.getAbcText())
      const sourceValue = getConfigPath(config, key)
      const targetKey = key.replace(/^extract\.\d+/, `extract.${targetId}`)
      patchConfig(runtime, state, targetKey, sourceValue, `cpconfig ${key} ${targetId}`)
      runtime.render()
    },
  })

  for (const name of [
    'addconf',
    'editsnippet',
    'addsnippet',
    'adddecoration',
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

function readConfig(abcText: string): Record<string, CommandArgumentValue> {
  const configText = readConfigText(abcText)
  if (configText === undefined) return {}
  const parsedConfig: unknown = JSON.parse(configText)
  if (!isPlainObject(parsedConfig)) {
    throw new CommandError('zupfnoter config block must contain a JSON object')
  }
  return parsedConfig
}

function readConfigText(abcText: string): string | undefined {
  const marker = '%%%%zupfnoter.config'
  const markerIndex = abcText.indexOf(marker)
  if (markerIndex < 0) return undefined
  return abcText.slice(markerIndex + marker.length).trim()
}

function writeConfig(abcText: string, config: Record<string, CommandArgumentValue>): string {
  const marker = '%%%%zupfnoter.config'
  const markerIndex = abcText.indexOf(marker)
  const musicText = markerIndex < 0 ? abcText.trimEnd() : abcText.slice(0, markerIndex).trimEnd()
  return `${musicText}\n\n${marker}\n\n${JSON.stringify(config, null, 2)}\n`
}

function patchConfig(
  runtime: WorkbenchCommandRuntime,
  state: LegacyCommandState,
  key: string,
  value: CommandArgumentValue | undefined,
  title: string,
): void {
  const previousAbcText = runtime.getAbcText()
  const config = readConfig(previousAbcText)
  setConfigPath(config, key, value)
  const nextAbcText = writeConfig(previousAbcText, config)
  pushConfigHistory(state, title, previousAbcText, nextAbcText)
  runtime.setAbcText(nextAbcText)
}

function deleteConfig(
  runtime: WorkbenchCommandRuntime,
  state: LegacyCommandState,
  key: string,
  title: string,
): void {
  const previousAbcText = runtime.getAbcText()
  const config = readConfig(previousAbcText)
  deleteConfigPath(config, key)
  const nextAbcText = writeConfig(previousAbcText, config)
  pushConfigHistory(state, title, previousAbcText, nextAbcText)
  runtime.setAbcText(nextAbcText)
}

function pushConfigHistory(
  state: LegacyCommandState,
  title: string,
  previousAbcText: string,
  nextAbcText: string,
): void {
  state.configUndoStack.push({ title, previousAbcText, nextAbcText })
  state.configRedoStack.length = 0
}

function getConfigPath(config: Record<string, CommandArgumentValue>, path: string): CommandArgumentValue | undefined {
  const parts = path.split('.').filter((part) => part !== '')
  let cursor: unknown = config
  for (const part of parts) {
    if (!isPlainObject(cursor)) return undefined
    cursor = cursor[part]
  }
  return isCommandArgumentValue(cursor) ? cursor : undefined
}

function setConfigPath(
  config: Record<string, CommandArgumentValue>,
  path: string,
  value: CommandArgumentValue | undefined,
): void {
  const parts = path.split('.').filter((part) => part !== '')
  const leaf = parts.pop()
  if (leaf === undefined) {
    throw new CommandError('configuration key must not be empty')
  }
  let cursor: Record<string, CommandArgumentValue> = config
  for (const part of parts) {
    const nextValue = cursor[part]
    if (!isPlainObject(nextValue)) {
      const next: Record<string, CommandArgumentValue> = {}
      cursor[part] = next
      cursor = next
    } else {
      cursor = nextValue
    }
  }
  cursor[leaf] = value ?? null
}

function deleteConfigPath(config: Record<string, CommandArgumentValue>, path: string): void {
  const parts = path.split('.').filter((part) => part !== '')
  const leaf = parts.pop()
  if (leaf === undefined) {
    throw new CommandError('configuration key must not be empty')
  }
  let cursor: unknown = config
  for (const part of parts) {
    if (!isPlainObject(cursor)) return
    cursor = cursor[part]
  }
  if (isPlainObject(cursor)) {
    delete cursor[leaf]
  }
}

function parseConfigCommandValue(value: string): CommandArgumentValue {
  const trimmedValue = value.trim()
  if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
    const parsedValue: unknown = JSON.parse(trimmedValue)
    if (isCommandArgumentValue(parsedValue)) return parsedValue
  }
  if (trimmedValue === 'true') return true
  if (trimmedValue === 'false') return false
  if (trimmedValue === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) return Number(trimmedValue)
  return value
}

function sanitizeResourceKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '_')
}

function createDefaultTemplate(): string {
  return [
    'X:{{song_id}}',
    'F:{{song_id}}_{{filename}}',
    'T:{{song_title}}',
    'M:4/4',
    'L:1/4',
    'K:C',
    'C D E F |]',
    '',
  ].join('\n')
}

function createTemplateFromAbc(abcText: string): string {
  return abcText
    .replace(/^X:.*$/m, 'X:{{song_id}}')
    .replace(/^F:.*$/m, 'F:{{song_id}}_{{filename}}')
    .replace(/^T:.*$/m, 'T:{{song_title}}')
}

function isPlainObject(value: unknown): value is Record<string, CommandArgumentValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCommandArgumentValue(value: unknown): value is CommandArgumentValue {
  return (
    value === undefined
    || value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || Array.isArray(value)
    || isPlainObject(value)
  )
}
