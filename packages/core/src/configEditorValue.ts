/**
 * Legacy-specific value conversions used by the configuration editor.
 *
 * The mapping ports `ConfstackEditor::ConfHelper` from `config-form.rb`.
 * It is intentionally based on the final configuration-key segment, because
 * the legacy editor uses the same convention for nested configuration paths.
 */
const INTEGER_PAIR_KEYS = new Set(['synchlines'])
const FLOAT_PAIR_KEYS = new Set([
  'apbase', 'pos', 'size', 'spos', 'ELLIPSE_SIZE', 'REST_SIZE', 'DRAWING_AREA_SIZE',
  'cp1', 'cp2', 'a3_offset', 'a4_offset', 'jumpline_anchor',
])
const INTEGER_LIST_KEYS = new Set([
  'a4_pages', 'voices', 'flowlines', 'subflowlines', 'jumplines', 'layoutlines',
  'verses', 'hpos', 'vpos', 'produce', 'llpos', 'trpos',
])
const TUPLET_SHAPE_KEYS = new Set(['shape'])

/** Formats an editor value with the compact notation used in the legacy form. */
export function formatConfigEditorValue(path: string, value: unknown): string {
  if (value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (!Array.isArray(value)) return typeof value === 'object' && value !== null ? '{…}' : String(value)

  const key = getConfigKey(path)
  if (INTEGER_PAIR_KEYS.has(key) && value.every(isNumberPair)) {
    return value.map(([from, to]) => `${from}-${to}`).join(', ')
  }
  if (value.every((entry) => typeof entry === 'number')) return value.join(', ')
  return JSON.stringify(value)
}

/** Converts compact legacy form notation into the JSON value syntax accepted by `cconf`. */
export function serializeConfigEditorValue(path: string, value: string): string {
  const key = getConfigKey(path)
  if (INTEGER_PAIR_KEYS.has(key)) return JSON.stringify(parseIntegerPairs(value))
  if (FLOAT_PAIR_KEYS.has(key)) return JSON.stringify(parseFloatPair(value))
  if (INTEGER_LIST_KEYS.has(key)) return JSON.stringify(parseIntegerList(value))
  if (TUPLET_SHAPE_KEYS.has(key)) return JSON.stringify(value.split(',').map((entry) => entry.trim()))
  return value
}

function getConfigKey(path: string): string {
  return path.split('.').at(-1) ?? path
}

function parseIntegerPairs(value: string): number[][] {
  if (value.trim() === '') return []
  return value.split(',').map((pair) => {
    const entries = pair.split('-')
    return [parseLegacyInteger(entries[0]), parseLegacyInteger(entries[1])]
  })
}

function parseFloatPair(value: string): number[] {
  const entries = value.split(',')
  return [parseLegacyFloat(entries[0]), parseLegacyFloat(entries[1])]
}

function parseIntegerList(value: string): number[] {
  if (value.trim() === '') return []
  return value.split(',').map(parseLegacyInteger)
}

function parseLegacyInteger(value: string | undefined): number {
  const parsed = Number.parseInt(value?.trim() ?? '', 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

function parseLegacyFloat(value: string | undefined): number {
  const parsed = Number.parseFloat(value?.trim() ?? '')
  return Number.isNaN(parsed) ? 0 : parsed
}

function isNumberPair(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((entry) => typeof entry === 'number')
}
