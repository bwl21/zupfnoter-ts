import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  kind: 'missing-in-ts' | 'missing-in-reference' | 'value-mismatch'
  reference?: JsonValue
  ts?: JsonValue
}

type Mode = 'compare' | 'verify-legacy' | 'sync-fixture'

const EDITOR_ONLY_SCHEMA_KEYS = new Set(['title', 'description', 'x-zupfnoter-editor'])

interface LegacySchemaExtension {
  /** Exakter Pfad der bewusst über das Legacy-Schema hinausgehenden TS-Regel. */
  path: string
  /** Einordnung als Legacy-Widerspruch oder echte TS-Editor-Erweiterung. */
  classification: 'legacy-runtime-contradiction' | 'ts-editor-extension'
  /** Fachlicher Grund der Erweiterung. */
  reason: string
}

/**
 * Bewusst freigegebene, rückwärtskompatible Ergänzungen des TS-Schemas.
 *
 * Die Liste bleibt absichtlich eng: Nur eine fehlende Regel im Legacy-Schema
 * am angegebenen Pfad wird toleriert. Abweichende Validierungsregeln bleiben
 * im Vergleich sichtbar.
 */
const LEGACY_SCHEMA_EXTENSIONS: readonly LegacySchemaExtension[] = [
  {
    path: '$.definitions.minc_entry.properties.minc_f.type',
    classification: 'legacy-runtime-contradiction',
    reason: 'Die TS-Konfigurationsoberfläche verwendet null als explizit inaktiven minc-Override; die Runtime behandelt diesen Legacy-Fall entsprechend als deaktiviert.',
  },
  {
    path: '$.properties.extract.patternProperties.d*.properties.instrument_shape.type',
    classification: 'legacy-runtime-contradiction',
    reason: 'Instrument-Presets verwenden null ausdrücklich für Instrumente ohne eigene Umrissform.',
  },
  {
    path: '$.properties.extract.patternProperties.d*.properties.lyrics.patternProperties..*.properties',
    classification: 'legacy-runtime-contradiction',
    reason: 'Der TS-Editor verarbeitet die Legacy-Liedtextfelder verses, pos und style vollständig; die exportierte Legacy-Schema-Referenz enthält diese Eigenschaften an dieser Stelle nicht.',
  },
  {
    path: '$.properties.extract.patternProperties.d*.properties.tuplets.properties.style',
    classification: 'legacy-runtime-contradiction',
    reason: 'Legacy-Builtin- und Vorlagenkonfigurationen sowie die Runtime verarbeiten tuplets.style; die exportierte Legacy-Schema-Referenz enthält dieses Feld nicht.',
  },
  {
    path: '$.properties.layout.properties.FONT_STYLE_DEF.patternProperties..*.properties.description',
    classification: 'ts-editor-extension',
    reason: 'Dynamische Schriftstile können eine Markdown-Beschreibung für die Auswahl anbieten.',
  },
  {
    path: '$.properties.layout.properties.FONT_STYLE_DEF.patternProperties..*.properties.label',
    classification: 'ts-editor-extension',
    reason: 'Dynamische Schriftstile können eine fachliche Beschriftung für die Auswahl anbieten.',
  },
]

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')
const legacySchemaPath = resolve(
  repoRoot,
  '../200_zupfnoter/30_sources/SRC_Zupfnoter/src/opal-ajv.rb',
)
const fixturePath = resolve(repoRoot, 'fixtures/legacy-config-schema.json')
const reportPath = resolve(repoRoot, 'fixtures/reports/config-schema-parity.md')
const reportJsonPath = resolve(repoRoot, 'fixtures/reports/config-schema-parity.json')

function normalizeJsonValue(value: unknown, parentKey?: string): JsonValue {
  if (value === null) return null
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value
  if (Array.isArray(value)) return value.map((entry) => normalizeJsonValue(entry, parentKey))
  if (typeof value === 'object') {
    const preservesSchemaPropertyNames = parentKey === 'properties' || parentKey === 'patternProperties'
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key, entry]) => entry !== undefined && (preservesSchemaPropertyNames || !EDITOR_ONLY_SCHEMA_KEYS.has(key)))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeJsonValue(entry, key)] as const)
    return Object.fromEntries(entries)
  }
  return String(value)
}

function loadLegacySchemaFromRuby(): JsonValue {
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

function loadFixtureSchema(): JsonValue {
  const content = readFileSync(fixturePath, 'utf8')
  return normalizeJsonValue(JSON.parse(content) as unknown)
}

function formatPath(basePath: string, segment: string): string {
  return basePath === '$' ? `$.${segment}` : `${basePath}.${segment}`
}

function diffSchemas(referenceValue: JsonValue, tsValue: JsonValue, path = '$'): SchemaDiff[] {
  if (Array.isArray(referenceValue) && Array.isArray(tsValue)) {
    const diffs: SchemaDiff[] = []
    const maxLength = Math.max(referenceValue.length, tsValue.length)
    for (let index = 0; index < maxLength; index += 1) {
      const nextPath = `${path}[${index}]`
      if (index >= referenceValue.length) {
        diffs.push({ path: nextPath, kind: 'missing-in-reference', ts: tsValue[index] })
        continue
      }
      if (index >= tsValue.length) {
        diffs.push({ path: nextPath, kind: 'missing-in-ts', reference: referenceValue[index] })
        continue
      }
      diffs.push(...diffSchemas(referenceValue[index] as JsonValue, tsValue[index] as JsonValue, nextPath))
    }
    return diffs
  }

  if (
    typeof referenceValue === 'object' &&
    referenceValue !== null &&
    !Array.isArray(referenceValue) &&
    typeof tsValue === 'object' &&
    tsValue !== null &&
    !Array.isArray(tsValue)
  ) {
    const referenceObject = referenceValue as Record<string, JsonValue>
    const tsObject = tsValue as Record<string, JsonValue>
    const allKeys = [...new Set([...Object.keys(referenceObject), ...Object.keys(tsObject)])]
      .sort((left, right) => left.localeCompare(right))
    const diffs: SchemaDiff[] = []
    for (const key of allKeys) {
      const nextPath = formatPath(path, key)
      if (!(key in tsObject)) {
        diffs.push({ path: nextPath, kind: 'missing-in-ts', reference: referenceObject[key] })
        continue
      }
      if (!(key in referenceObject)) {
        diffs.push({ path: nextPath, kind: 'missing-in-reference', ts: tsObject[key] })
        continue
      }
      diffs.push(...diffSchemas(referenceObject[key], tsObject[key], nextPath))
    }
    return diffs
  }

  if (JSON.stringify(referenceValue) === JSON.stringify(tsValue)) {
    return []
  }

  return [{
    path,
    kind: 'value-mismatch',
    reference: referenceValue,
    ts: tsValue,
  }]
}

function toPrettyJson(value: JsonValue | undefined): string {
  if (value === undefined) return '-'
  return JSON.stringify(value, null, 2)
}

function isDeclaredLegacySchemaExtension(diff: SchemaDiff): boolean {
  return LEGACY_SCHEMA_EXTENSIONS.some((extension) => extension.path === diff.path)
}

function createReport(diffs: SchemaDiff[], sourceLabel: string): string {
  const lines = [
    '# Config Schema Parity Report',
    '',
    `Stand: ${new Date().toISOString().slice(0, 10)}`,
    '',
    `- Referenz: ${sourceLabel}`,
    '- TS-Quelle: `packages/core/src/configSchema.ts`',
    `- Anzahl Abweichungen: ${diffs.length}`,
    '',
  ]

  lines.push('## Explizit eingeordnete Abweichungen', '')
  for (const extension of LEGACY_SCHEMA_EXTENSIONS) {
    lines.push(`- **${extension.classification}** \`${extension.path}\`: ${extension.reason}`)
  }
  lines.push('')

  if (diffs.length === 0) {
    lines.push('Abgesehen von den oben eingeordneten Abweichungen sind die kanonisierten Schemaobjekte identisch.')
    return `${lines.join('\n')}\n`
  }

  lines.push('## Erste Abweichungen', '')
  for (const diff of diffs.slice(0, 50)) {
    lines.push(`### ${diff.path}`)
    lines.push(`- Art: \`${diff.kind}\``)
    lines.push('- Referenz:')
    lines.push('```json')
    lines.push(toPrettyJson(diff.reference))
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

function parseMode(): Mode {
  if (process.argv.includes('--verify-legacy')) return 'verify-legacy'
  if (process.argv.includes('--sync-fixture')) return 'sync-fixture'
  return 'compare'
}

function ensureReportDir(): void {
  mkdirSync(dirname(reportPath), { recursive: true })
}

function writeFixture(schema: JsonValue): void {
  mkdirSync(dirname(fixturePath), { recursive: true })
  writeFileSync(fixturePath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8')
}

function main(): void {
  const strict = process.argv.includes('--strict')
  const mode = parseMode()
  const tsSchema = normalizeJsonValue(ZUPFNOTER_CONFIG_SCHEMA_OVERVIEW)

  if (mode === 'sync-fixture') {
    const legacySchema = loadLegacySchemaFromRuby()
    writeFixture(legacySchema)
    process.stdout.write('config schema fixture synced from opal-ajv.rb\n')
    return
  }

  const referenceSchema = loadFixtureSchema()
  const allDiffs = diffSchemas(referenceSchema, tsSchema)
  const diffs = allDiffs.filter((diff) => !isDeclaredLegacySchemaExtension(diff))
  ensureReportDir()
  writeFileSync(
    reportPath,
    createReport(diffs, `[legacy-config-schema.json](${fixturePath})`),
    'utf8',
  )
  writeFileSync(reportJsonPath, `${JSON.stringify(diffs, null, 2)}\n`, 'utf8')

  if (mode === 'verify-legacy') {
    const legacySchema = loadLegacySchemaFromRuby()
    const fixtureDiffs = diffSchemas(legacySchema, referenceSchema)
    if (fixtureDiffs.length === 0) {
      process.stdout.write('legacy config schema fixture matches opal-ajv.rb\n')
      return
    }
    process.stdout.write(`legacy config schema fixture drift: ${fixtureDiffs.length} differences\n`)
    process.exitCode = 1
    return
  }

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
