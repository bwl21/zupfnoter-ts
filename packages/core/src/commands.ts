export type CommandArgumentValue = string | number | boolean | null | Record<string, unknown> | unknown[]

export type CommandArguments = Record<string, CommandArgumentValue>

export interface CommandParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'json'
  help: string
  defaultValue?: CommandArgumentValue
}

export interface CommandContext {
  log(message: string): void
}

export interface CommandSuggestion {
  completed: string
  didYouMean: string[]
}

export interface CommandLookupResult {
  command: CommandDefinition | undefined
  exactMatch: boolean
  prefixMatches: string[]
}

export interface CommandResult {
  undoArguments?: CommandArguments
}

export interface CommandDefinition {
  name: string
  help: string
  parameters?: CommandParameter[]
  undoable?: boolean
  perform(args: CommandArguments, context: CommandContext): void | CommandResult
  invert?: (args: CommandArguments, context: CommandContext) => void
}

export interface CommandHistoryEntry {
  commandName: string
  args: CommandArguments
}

export class CommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommandError'
  }
}

interface ParsedCommand {
  name: string
  values: CommandArgumentValue[]
}

export class CommandStack {
  private readonly commands = new Map<string, CommandDefinition>()
  private readonly undoStack: CommandHistoryEntry[] = []
  private readonly redoStack: CommandHistoryEntry[] = []
  private readonly historyStack: CommandHistoryEntry[] = []

  constructor(private readonly context: CommandContext) {}

  addCommand(command: CommandDefinition): void {
    if (this.commands.has(command.name)) {
      throw new CommandError(`Command already registered: ${command.name}`)
    }
    this.commands.set(command.name, command)
  }

  hasCommand(commandName: string): boolean {
    return this.commands.has(commandName)
  }

  getCommand(commandName: string): CommandDefinition | undefined {
    return this.commands.get(commandName)
  }

  lookup(commandInput: string): CommandLookupResult {
    const trimmed = commandInput.trim()
    if (trimmed === '') return { command: undefined, exactMatch: false, prefixMatches: [] }
    const [rawName] = trimmed.split(/\s+/, 1)
    if (rawName === undefined || rawName === '') return { command: undefined, exactMatch: false, prefixMatches: [] }
    const commandNames = [...this.commands.keys()].filter((name) => !name.startsWith('_')).sort()
    const prefixMatches = commandNames.filter((name) => name.startsWith(rawName))
    return {
      command: this.commands.get(rawName),
      exactMatch: this.commands.has(rawName),
      prefixMatches,
    }
  }

  suggest(commandInput: string): CommandSuggestion | undefined {
    const trimmed = commandInput.trim()
    if (trimmed === '') return undefined

    const [rawName, ...rest] = trimmed.split(/\s+/)
    if (rawName === undefined || rawName === '') return undefined

    const exactCommand = this.commands.get(rawName)
    if (exactCommand !== undefined) {
      return { completed: [exactCommand.name, ...rest].join(' '), didYouMean: [] }
    }

    const commandNames = [...this.commands.keys()]
      .filter((name) => !name.startsWith('_'))
      .sort()

    const prefixMatches = commandNames.filter((name) => name.startsWith(rawName))
    if (prefixMatches.length === 1) {
      return { completed: [prefixMatches[0], ...rest].join(' '), didYouMean: [] }
    }

    if (prefixMatches.length > 1) {
      const sharedPrefix = longestCommonPrefix(prefixMatches)
      const completed = sharedPrefix.length > rawName.length
        ? [sharedPrefix, ...rest].join(' ')
        : commandInput
      return { completed, didYouMean: prefixMatches.slice(0, 5) }
    }

    const didYouMean = commandNames
      .map((name) => ({ name, distance: levenshteinDistance(rawName, name) }))
      .filter((entry) => entry.distance <= 3)
      .sort((left, right) => left.distance - right.distance || left.name.localeCompare(right.name))
      .slice(0, 5)
      .map((entry) => entry.name)

    return didYouMean.length > 0
      ? { completed: commandInput, didYouMean }
      : undefined
  }

  runString(commandString: string): void {
    const parsedCommand = parseCommandString(commandString)
    this.runParsedCommand(parsedCommand.name, parsedCommand.values)
  }

  handleCommand(commandString: string): void {
    this.runString(commandString)
  }

  runParsedCommand(commandName: string, values: CommandArgumentValue[] | CommandArguments = []): void {
    if (commandName === 'undo') {
      this.undo()
      return
    }
    if (commandName === 'redo') {
      this.redo()
      return
    }

    const command = this.requireCommand(commandName)
    const args = Array.isArray(values)
      ? this.resolveArguments(command, values)
      : values
    const result = command.perform(args, this.context)
    this.historyStack.push({ commandName, args: { ...args } })

    if (command.undoable !== false && command.invert !== undefined) {
      const undoArguments = result?.undoArguments ?? args
      this.undoStack.push({ commandName, args: { ...undoArguments } })
      this.redoStack.length = 0
    }
  }

  handleParsedCommand(commandName: string, values: CommandArgumentValue[] | CommandArguments = []): void {
    this.runParsedCommand(commandName, values)
  }

  undo(): void {
    const entry = this.undoStack.pop()
    if (entry === undefined) {
      this.context.log('Nothing to undo')
      return
    }

    const command = this.requireCommand(entry.commandName)
    if (command.invert === undefined) {
      throw new CommandError(`Command is not undoable: ${entry.commandName}`)
    }
    command.invert(entry.args, this.context)
    this.redoStack.push(entry)
  }

  redo(): void {
    const entry = this.redoStack.pop()
    if (entry === undefined) {
      this.context.log('Nothing to redo')
      return
    }

    const command = this.requireCommand(entry.commandName)
    command.perform(entry.args, this.context)
    this.undoStack.push(entry)
  }

  help(filter = ''): string[] {
    return [...this.commands.values()]
      .filter((command) => !command.name.startsWith('_'))
      .filter((command) => command.name.includes(filter) || command.help.includes(filter))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((command) => {
        const parameters = command.parameters ?? []
        const signature = parameters.length === 0
          ? command.name
          : `${command.name} ${parameters.map((parameter) => `<${parameter.name}>`).join(' ')}`
        return `${signature} - ${command.help}`
      })
  }

  history(): CommandHistoryEntry[] {
    return this.historyStack.map((entry) => ({
      commandName: entry.commandName,
      args: { ...entry.args },
    }))
  }

  undoHistory(): CommandHistoryEntry[] {
    return this.undoStack.map((entry) => ({
      commandName: entry.commandName,
      args: { ...entry.args },
    }))
  }

  redoHistory(): CommandHistoryEntry[] {
    return this.redoStack.map((entry) => ({
      commandName: entry.commandName,
      args: { ...entry.args },
    }))
  }

  private requireCommand(commandName: string): CommandDefinition {
    const command = this.commands.get(commandName)
    if (command === undefined) {
      throw new CommandError(`Unknown command: ${commandName}`)
    }
    return command
  }

  private resolveArguments(command: CommandDefinition, values: CommandArgumentValue[]): CommandArguments {
    const parameters = command.parameters ?? []
    const args: CommandArguments = {}
    for (const [index, parameter] of parameters.entries()) {
      const rawValue = values[index] ?? parameter.defaultValue
      if (rawValue === undefined) {
        throw new CommandError(`Missing argument <${parameter.name}> for command ${command.name}`)
      }
      args[parameter.name] = coerceArgument(parameter, rawValue)
    }
    return args
  }
}

export function parseCommandString(commandString: string): ParsedCommand {
  const tokens = tokenizeCommandString(commandString.trim())
  const [name, ...rawValues] = tokens
  if (name === undefined || name === '') {
    throw new CommandError('Empty command')
  }

  return {
    name,
    values: rawValues.map(parseTokenValue),
  }
}

function tokenizeCommandString(commandString: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | undefined
  let braceDepth = 0

  for (const char of commandString) {
    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined
      } else {
        current += char
      }
      continue
    }

    if (braceDepth === 0 && (char === '"' || char === "'")) {
      quote = char
      continue
    }

    if (char === '{' || char === '[') {
      braceDepth += 1
      current += char
      continue
    }

    if (char === '}' || char === ']') {
      braceDepth -= 1
      current += char
      continue
    }

    if (/\s/.test(char) && braceDepth === 0) {
      pushToken(tokens, current)
      current = ''
      continue
    }

    current += char
  }

  if (quote !== undefined) {
    throw new CommandError('Unterminated quoted command argument')
  }
  if (braceDepth !== 0) {
    throw new CommandError('Unbalanced JSON command argument')
  }
  pushToken(tokens, current)
  return tokens
}

function pushToken(tokens: string[], token: string): void {
  if (token === '') return
  tokens.push(token)
}

function parseTokenValue(token: string): CommandArgumentValue {
  if (token === 'true') return true
  if (token === 'false') return false
  if (token === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token)
  if (token.startsWith('{') || token.startsWith('[')) {
    const parsedValue: unknown = JSON.parse(token)
    return coerceJsonValue(parsedValue)
  }
  return token
}

function coerceArgument(parameter: CommandParameter, value: CommandArgumentValue): CommandArgumentValue {
  if (parameter.type === 'string') return String(value)
  if (parameter.type === 'number') {
    const numericValue = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(numericValue)) {
      throw new CommandError(`Argument <${parameter.name}> must be a number`)
    }
    return numericValue
  }
  if (parameter.type === 'boolean') {
    if (typeof value === 'boolean') return value
    if (value === 'true') return true
    if (value === 'false') return false
    throw new CommandError(`Argument <${parameter.name}> must be a boolean`)
  }
  return value
}

function coerceJsonValue(value: unknown): CommandArgumentValue {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || Array.isArray(value)
    || (typeof value === 'object' && value !== null)
  ) {
    return value as CommandArgumentValue
  }
  throw new CommandError('Unsupported JSON command argument')
}

function longestCommonPrefix(values: string[]): string {
  if (values.length === 0) return ''
  let prefix = values[0] ?? ''
  for (const value of values.slice(1)) {
    while (prefix !== '' && !value.startsWith(prefix)) {
      prefix = prefix.slice(0, -1)
    }
  }
  return prefix
}

function levenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1
  const cols = right.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0))

  for (let i = 0; i < rows; i += 1) {
    const row = matrix[i]
    if (row === undefined) {
      throw new CommandError('Failed to initialize command suggestion matrix')
    }
    row[0] = i
  }
  for (let j = 0; j < cols; j += 1) {
    const firstRow = matrix[0]
    if (firstRow === undefined) {
      throw new CommandError('Failed to initialize command suggestion matrix')
    }
    firstRow[j] = j
  }

  for (let i = 1; i < rows; i += 1) {
    const currentRow = matrix[i]
    const previousRow = matrix[i - 1]
    const firstRow = matrix[0]
    if (currentRow === undefined || previousRow === undefined || firstRow === undefined) {
      throw new CommandError('Failed to initialize command suggestion matrix')
    }
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      const deletion = previousRow[j]
      const insertion = currentRow[j - 1]
      const substitution = previousRow[j - 1]
      if (deletion === undefined || insertion === undefined || substitution === undefined) {
        throw new CommandError('Failed to compute command suggestion distance')
      }
      currentRow[j] = Math.min(
        deletion + 1,
        insertion + 1,
        substitution + cost,
      )
    }
  }

  const lastRow = matrix[rows - 1]
  if (lastRow === undefined) {
    throw new CommandError('Failed to initialize command suggestion matrix')
  }
  const distance = lastRow[cols - 1]
  if (distance === undefined) {
    throw new CommandError('Failed to compute command suggestion distance')
  }
  return distance
}
