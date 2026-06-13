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

  runString(commandString: string): void {
    const parsedCommand = parseCommandString(commandString)
    this.runParsedCommand(parsedCommand.name, parsedCommand.values)
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
