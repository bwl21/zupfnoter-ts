/**
 * extractSongConfig – parst die Song-Konfiguration aus dem ABC-Text.
 *
 * Im Legacy-System wird die Song-Konfiguration als JSON-Block im ABC-Text
 * gespeichert, getrennt durch den Separator `%%%%zupfnoter.config`.
 * Dieser Block wird bei jedem Render-Zyklus als Layer 2 auf den Confstack
 * gepusht (über den Defaults aus `initConf()`).
 *
 * Entspricht `get_config_from_text()` in `text_pane.rb`:
 *   `JSON.parse(fulltext.split('%%%%zupfnoter').select{|i| i.start_with? ".config"}.first.gsub(".config", ""))`
 *
 * Format im ABC-Text:
 * ```
 * X:1
 * T:Mein Lied
 * ...
 * %%%%zupfnoter.config
 * {"extract":{"0":{"voices":[1,2]}}}
 * ```
 */

import type { SongResources, ZupfnoterConfig } from '@zupfnoter/types'
import {
  normalizeEmbeddedZupfnoterConfigTypes,
  validateEmbeddedZupfnoterConfigShape,
} from './configSchema.js'

/** Separator zwischen ABC-Text und Zupfnoter-Konfigurationsblöcken */
export const CONFIG_SEPARATOR = '%%%%zupfnoter'
export const RESOURCES_SECTION = '.resources'

/** Separierte Bestandteile eines gespeicherten Zupfnoter-Dokuments. */
export interface SongDocumentParts {
  /** ABC-Notation, die im Notationseditor bearbeitet wird. */
  abcText: string
  /** Eingebettete Zupfnoter-Abschnitte einschließlich ihres Markers. */
  zupfnoterSections: string
}

/**
 * Trennt die ABC-Notation von eingebetteten Zupfnoter-Abschnitten.
 *
 * Entspricht dem ersten Schritt von `TextPane#_split_parts` im Legacy-System:
 * Der Editor erhält nur den ABC-Teil, während Konfiguration und spätere
 * Zupfnoter-Abschnitte separat für Speichern und Konfigurationsbearbeitung
 * erhalten bleiben.
 */
export function splitSongDocument(documentText: string): SongDocumentParts {
  const separatorIndex = documentText.indexOf(CONFIG_SEPARATOR)
  if (separatorIndex < 0) {
    return { abcText: documentText, zupfnoterSections: '' }
  }
  return {
    abcText: documentText.slice(0, separatorIndex),
    zupfnoterSections: documentText.slice(separatorIndex),
  }
}

/**
 * Ersetzt ausschließlich die ABC-Notation eines Dokuments.
 *
 * Bereits geladene Konfiguration und weitere Zupfnoter-Abschnitte bleiben
 * unverändert erhalten, obwohl sie im ABC-Editor nicht angezeigt werden.
 */
export function replaceSongDocumentAbc(documentText: string, abcText: string): string {
  return `${abcText}${splitSongDocument(documentText).zupfnoterSections}`
}

/** Liest die Filebase aus der F:-Kopfzeile der ABC-Notation. */
export function extractSongFilebase(documentText: string): string | undefined {
  return splitSongDocument(documentText).abcText
    .split('\n')
    .find((line) => line.startsWith('F:'))
    ?.slice(2)
    .trim() || undefined
}

/**
 * Parst die Song-Konfiguration aus dem ABC-Text.
 *
 * Gibt ein leeres Objekt zurück wenn kein `%%%%zupfnoter.config`-Block
 * gefunden wird. Wirft einen Fehler wenn der Block kein gültiges JSON enthält.
 *
 * @param abcText Vollständiger ABC-Text (inkl. optionalem Konfigurations-Block)
 * @returns Partial<ZupfnoterConfig> aus dem `%%%%zupfnoter.config`-Block,
 *          oder `{}` wenn kein Block vorhanden
 */
export function extractSongConfig(abcText: string): Partial<ZupfnoterConfig> {
  const parts = abcText.split(CONFIG_SEPARATOR)

  // Suche den Teil, der mit ".config" beginnt
  const configPart = parts.find(p => p.startsWith('.config'))
  if (!configPart) return {}

  // Entferne das ".config"-Präfix und parse JSON
  const json = configPart.slice('.config'.length).trim()
  if (!json) return {}

  try {
    const parsed = normalizeEmbeddedZupfnoterConfigTypes(JSON.parse(json) as unknown)
    if (!isPlainObject(parsed)) {
      throw new Error('zupfnoter config block must contain a JSON object')
    }

    const errors = validateEmbeddedZupfnoterConfigShape(parsed)
    if (errors.length > 0) {
      throw new Error(`invalid zupfnoter config shape:\n${errors.join('\n')}`)
    }

    return parsed as Partial<ZupfnoterConfig>
  } catch (err) {
    throw new Error(
      `extractSongConfig: invalid JSON in %%%%zupfnoter.config block: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/** Liest die separat gespeicherten Ressourcen eines Zupfnoter-Dokuments. */
export function extractSongResources(documentText: string): SongResources {
  const resourcePart = documentText.split(CONFIG_SEPARATOR).find((part) => part.startsWith(RESOURCES_SECTION))
  if (resourcePart === undefined) return {}
  const json = resourcePart.slice(RESOURCES_SECTION.length).trim()
  if (json === '') return {}
  try {
    const parsed = JSON.parse(json) as unknown
    if (!isPlainObject(parsed)) throw new Error('zupfnoter resources block must contain a JSON object')
    const resources: SongResources = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value) && value.every((part): part is string => typeof part === 'string')) {
        resources[key] = value
      } else if (typeof value === 'string') {
        resources[key] = [value]
      } else {
        throw new Error(`resource ${key} must contain string data`)
      }
    }
    return resources
  } catch (error) {
    throw new Error(`extractSongResources: invalid JSON in %%%%zupfnoter.resources block: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Fügt den Ressourcenabschnitt hinzu oder ersetzt ihn, ohne den JSON-Block zu verändern. */
export function replaceSongDocumentResources(documentText: string, resources: SongResources): string {
  const parts = documentText.split(CONFIG_SEPARATOR).filter((part) => !part.startsWith(RESOURCES_SECTION))
  const base = parts.join(CONFIG_SEPARATOR).trimEnd()
  if (Object.keys(resources).length === 0) return `${base}\n`
  return `${base}\n\n${CONFIG_SEPARATOR}${RESOURCES_SECTION}\n\n${JSON.stringify(resources, null, 2)}\n`
}

/**
 * Merged Song-Konfiguration (Layer 2) mit Default-Konfiguration (Layer 1).
 *
 * Führt einen tiefen Merge durch: Song-Werte überschreiben Defaults,
 * fehlende Felder werden aus den Defaults übernommen.
 *
 * Entspricht dem Verhalten von `$conf.reset_to(1)` + `$conf.push(config)`
 * im Legacy-System, aber als reine Funktion ohne globalen Zustand.
 *
 * @param defaults Vollständige Default-Konfiguration (aus `initConf()`)
 * @param songConfig Partielle Song-Konfiguration (aus `extractSongConfig()`)
 * @returns Gemischte Konfiguration
 */
export function mergeSongConfig(
  defaults: ZupfnoterConfig,
  songConfig: Partial<ZupfnoterConfig>,
): ZupfnoterConfig {
  return deepMerge(defaults, songConfig) as ZupfnoterConfig
}

// ---------------------------------------------------------------------------
// Interner tiefer Merge
// ---------------------------------------------------------------------------

function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined || override === null) return cloneValue(base)
  if (!isPlainObject(base) || !isPlainObject(override)) return cloneValue(override)

  const result: Record<string, unknown> = { ...base }
  for (const key of Object.keys(override)) {
    result[key] = deepMerge(
      (base as Record<string, unknown>)[key],
      (override as Record<string, unknown>)[key],
    )
  }
  return result
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry))
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]),
    )
  }
  return value
}
