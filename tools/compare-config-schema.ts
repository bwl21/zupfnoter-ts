import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW } from '../packages/core/src/configSchema.ts'

type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

interface SchemaDiff {
  path: string
  kind: 'missing-in-ts' | 'missing-in-legacy' | 'value-mismatch'
  legacy?: JsonValue
  ts?: JsonValue
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')
const legacySchemaPath = resolve(
  repoRoot,
  '../200_zupfnoter/30_sources/SRC_Zupfnoter/src/opal-ajv.rb',
)
const reportPath = resolve(repoRoot, 'fixtures/reports/config-schema-parity.md')
const reportJsonPath = resolve(repoRoot, 'fixtures/reports/config-schema-parity.json')

function normalizeJsonValue(value: unknown): JsonValue {
  if (value === null) return null
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((entry) => normalizeJsonValue(entry))
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeJsonValue(entry)] as const)
    return Object.fromEntries(entries)
  }
  return String(value)
}

function loadLegacySchema(): JsonValue {
  const rubySource = `
    require 'json'
    legacy_path = ARGV.fetch(0)
    load legacy_path

    def normalize_json_value(value)
      case value
      when Hash
        value.keys
             .map(&:to_s)
             .sort
             .each_with_object({}) do |key, result|
               symbol_key = key.to_sym
               entry = if value.key?(symbol_key)
                         value[symbol_key]
                       else
                         value[key]
                       end
               result[key] = normalize_json_value(entry)
             end
      when Array
        value.map { |entry| normalize_json_value(entry) }
      when Symbol
        value.to_s
      else
        value
      end
    end

    schema = Ajv::JsonValidator.allocate.send(:_schema)
    puts JSON.generate(normalize_json_value(schema))
  `
  const output = execFileSync('ruby', ['-e', rubySource, legacySchemaPath], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  return normalizeJsonValue(JSON.parse(output) as unknown)
}

function formatPath(basePath: string, segment: string): string {
  return basePath === '$' ? `$.${segment}` : `${basePath}.${segment}`
}

function diffSchemas(legacyValue: JsonValue, tsValue: JsonValue, path = '$'): SchemaDiff[] {
  if (Array.isArray(legacyValue) && Array.isArray(tsValue)) {
    const diff: SchemaDiff[] = []
    const maxLength = Math.max(legacyValue.length, tsValue.length)
    for (let index = 0; index < maxLength; index += 1) {
      const nextPath = `${path}[${index}]`
      if (index >= legacyValue.length) {
        diff.push({ path: nextPath, kind: 'missing-in-legacy', ts: tsValue[index] })
        continue
      }
      if (index >= tsValue.length) {
        diff.push({ path: nextPath, kind: 'missing-in-ts', legacy: legacyValue[index] })
        continue
      }
      diff.push(...diffSchemas(legacyValue[index] as JsonValue, tsValue[index] as JsonValue, nextPath))
    }
    return diff
  }

  if (
    typeof legacyValue === 'object' &&
    legacyValue !== null &&
    !Array.isArray(legacyValue) &&
    typeof tsValue === 'object' &&
    tsValue !== null &&
    !Array.isArray(tsValue)
  ) {
    const legacyObject = legacyValue as Record<string, JsonValue>
    const tsObject = tsValue as Record<string, JsonValue>
    const legacyKeys = Object.keys(legacyObject)
    const tsKeys = Object.keys(tsObject)
    const allKeys = [...new Set([...legacyKeys, ...tsKeys])].sort((left, right) => left.localeCompare(right))
    const diff: SchemaDiff[] = []
    for (const key of allKeys) {
      const nextPath = formatPath(path, key)
      if (!(key in tsObject)) {
        diff.push({ path: nextPath, kind: 'missing-in-ts', legacy: legacyObject[key] })
        continue
      }
      if (!(key in legacyObject)) {
        diff.push({ path: nextPath, kind: 'missing-in-legacy', ts: tsObject[key] })
        continue
      }
      diff.push(...diffSchemas(legacyObject[key], tsObject[key], nextPath))
    }
    return diff
  }

  if (JSON.stringify(legacyValue) === JSON.stringify(tsValue)) {
    return []
  }

  return [{
    path,
    kind: 'value-mismatch',
    legacy: legacyValue,
    ts: tsValue,
  }]
}

function toPrettyJson(value: JsonValue | undefined): string {
  if (value === undefined) return '-'
  return JSON.stringify(value, null, 2)
}

function createReport(diffs: SchemaDiff[]): string {
  const lines = [
    '# Config Schema Parity Report',
    '',
    `Stand: ${new Date().toISOString().slice(0, 10)}`,
    '',
    `- Legacy-Quelle: \`${legacySchemaPath}\``,
    '- TS-Quelle: `packages/core/src/configSchema.ts`',
    `- Anzahl Abweichungen: ${diffs.length}`,
    '',
  ]

  if (diffs.length === 0) {
    lines.push('Die kanonisierten Schemaobjekte sind identisch.')
    return `${lines.join('\n')}\n`
  }

  lines.push('## Erste Abweichungen', '')
  for (const diff of diffs.slice(0, 50)) {
    lines.push(`### ${diff.path}`)
    lines.push(`- Art: \`${diff.kind}\``)
    lines.push('- Legacy:')
    lines.push('```json')
    lines.push(toPrettyJson(diff.legacy))
    lines.push('```')
    lines.push('- TS:')
    lines.push('```json')
    lines.push(toPrettyJson(diff.ts))
    lines.push('```')
    lines.push('')
  }

  if (diffs.length > 50) {
    lines.push(`Weitere Abweichungen: ${diffs.length - 50}`)
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function main(): void {
  const strict = process.argv.includes('--strict')
  const legacySchema = loadLegacySchema()
  const tsSchema = normalizeJsonValue(ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW)
  const diffs = diffSchemas(legacySchema, tsSchema)

  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, createReport(diffs), 'utf8')
  writeFileSync(reportJsonPath, JSON.stringify(diffs, null, 2), 'utf8')

  if (diffs.length === 0) {
    process.stdout.write('config schema parity: OK\n')
    return
  }

  process.stdout.write(`config schema parity: ${diffs.length} differences written to fixtures/reports/config-schema-parity.md\n`)
  if (strict) {
    process.exitCode = 1
  }
}

main()
