import type { CommandArgumentValue } from './commands.js'
import { resolveConfigSchemaPath, type JsonSchemaNode, type JsonSchemaType } from './configSchema.js'

/** Result of converting one editor field into its configuration value. */
export type ConfigEditorValueParseResult =
  | { value: CommandArgumentValue; error?: never }
  | { value?: never; error: string }

/** Formats a value using only its resolved configuration schema. */
export function formatConfigEditorValue(path: string, value: unknown): string {
  if (value === undefined) return '—'
  const schema = resolveConfigSchemaPath(path)
  return formatValue(schema, value)
}

/** Parses an editor input strictly before it reaches a configuration command. */
export function parseConfigEditorValue(path: string, input: string): ConfigEditorValueParseResult {
  const schema = resolveConfigSchemaPath(path)
  if (schema === undefined) return { value: input }

  try {
    return { value: parseValue(schema, input) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/** Compatibility wrapper for console callers that need a command-string argument. */
export function serializeConfigEditorValue(path: string, value: string): string {
  const result = parseConfigEditorValue(path, value)
  if (result.value === undefined) return value
  return typeof result.value === 'string' ? result.value : JSON.stringify(result.value)
}

function formatValue(schema: JsonSchemaNode | undefined, value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (!Array.isArray(value)) return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)

  const valueFormat = schema?.['x-zupfnoter-editor']?.valueFormat
  if (valueFormat === 'pair-array' && value.every(isNumericPair)) {
    return value.map((pair) => pair.join('-')).join(', ')
  }
  if (valueFormat === 'array' && value.every((entry) => isFiniteNumber(entry) || typeof entry === 'string')) {
    return value.join(', ')
  }
  return JSON.stringify(value)
}

function parseValue(schema: JsonSchemaNode, input: string): CommandArgumentValue {
  const type = getSchemaType(schema)
  switch (type) {
    case 'array':
      return parseArray(schema, input)
    case 'boolean':
      if (input === 'true') return true
      if (input === 'false') return false
      throw new Error('Bitte true oder false eingeben.')
    case 'integer':
      return parseNumber(input, true)
    case 'number':
      return parseNumber(input, false)
    case 'object':
      return parseJson(input, 'Objekte müssen gültiges JSON sein.')
    case 'string':
    case undefined:
      return input
    default:
      return input
  }
}

function parseArray(schema: JsonSchemaNode, input: string): CommandArgumentValue[] {
  const trimmed = input.trim()
  if (trimmed.startsWith('[')) {
    const parsed = parseJson(trimmed, 'Listen müssen gültiges JSON sein.')
    if (!Array.isArray(parsed)) throw new Error('Bitte eine JSON-Liste eingeben.')
    validateArrayEntries(schema, parsed)
    return parsed as CommandArgumentValue[]
  }

  if (trimmed === '') return []
  const items = getSchemaItems(schema)
  if (items === undefined) throw new Error('Listen ohne Elementtyp müssen als JSON eingegeben werden.')

  if (isNumericSchema(items)) {
    const result = input.split(',').map((entry) => parseNumber(entry, getSchemaType(items) === 'integer'))
    validateArrayEntries(schema, result)
    return result
  }

  if (isStringSchema(items)) {
    return input.split(',').map((entry) => entry.trim())
  }

  if (isNumericArraySchema(items)) {
    const itemSchema = getSchemaItems(items)
    if (itemSchema === undefined) throw new Error('Verschachtelte Listen müssen als JSON eingegeben werden.')
    const result = input.split(',').map((pair) => {
      const entries = pair.trim().split('-')
      if (entries.length !== 2) throw new Error('Paarwerte bitte als „erste-zweite“ eingeben.')
      return entries.map((entry) => parseNumber(entry, getSchemaType(itemSchema) === 'integer'))
    })
    validateArrayEntries(schema, result)
    return result
  }

  throw new Error('Verschachtelte Listen müssen als JSON eingegeben werden.')
}

function validateArrayEntries(schema: JsonSchemaNode, value: unknown[]): void {
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    throw new Error(`Bitte mindestens ${schema.minItems} Einträge eingeben.`)
  }
  const items = getSchemaItems(schema)
  if (items === undefined) return
  for (const entry of value) {
    validateValue(items, entry)
  }
}

function validateValue(schema: JsonSchemaNode, value: unknown): void {
  const type = getSchemaType(schema)
  if (type === 'array') {
    if (!Array.isArray(value)) throw new Error('Der eingegebene Wert hat nicht die erwartete Listenform.')
    validateArrayEntries(schema, value)
    return
  }
  if (type === 'integer' && (!isFiniteNumber(value) || !Number.isInteger(value))) {
    throw new Error('Die Liste erwartet ganze Zahlen.')
  }
  if (type === 'number' && !isFiniteNumber(value)) {
    throw new Error('Die Liste erwartet Zahlen.')
  }
  if (type === 'string' && typeof value !== 'string') {
    throw new Error('Die Liste erwartet Textwerte.')
  }
}

function parseNumber(input: string, integer: boolean): number {
  const trimmed = input.trim()
  if (trimmed === '' || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) {
    throw new Error(integer ? 'Bitte eine ganze Zahl eingeben.' : 'Bitte eine Zahl eingeben.')
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw new Error(integer ? 'Bitte eine ganze Zahl eingeben.' : 'Bitte eine Zahl eingeben.')
  }
  return value
}

function parseJson(input: string, message: string): CommandArgumentValue {
  try {
    return JSON.parse(input) as CommandArgumentValue
  } catch {
    throw new Error(message)
  }
}

function getSchemaType(schema: JsonSchemaNode): JsonSchemaType | undefined {
  if (typeof schema.type === 'string') return schema.type
  return schema.type?.[0]
}

function getSchemaItems(schema: JsonSchemaNode | undefined): JsonSchemaNode | undefined {
  return schema !== undefined && !Array.isArray(schema.items) ? schema.items : undefined
}

function isNumericSchema(schema: JsonSchemaNode): boolean {
  const type = getSchemaType(schema)
  return type === 'integer' || type === 'number'
}

function isStringSchema(schema: JsonSchemaNode): boolean {
  return getSchemaType(schema) === 'string'
}

function isNumericArraySchema(schema: JsonSchemaNode): boolean {
  const items = getSchemaItems(schema)
  return getSchemaType(schema) === 'array' && items !== undefined && isNumericSchema(items)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNumericPair(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber)
}
