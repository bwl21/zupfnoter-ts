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

import type { ZupfnoterConfig } from '@zupfnoter/types'

/** Separator zwischen ABC-Text und Zupfnoter-Konfigurationsblöcken */
export const CONFIG_SEPARATOR = '%%%%zupfnoter'

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
    return JSON.parse(json) as Partial<ZupfnoterConfig>
  } catch (err) {
    throw new Error(
      `extractSongConfig: invalid JSON in %%%%zupfnoter.config block: ${err instanceof Error ? err.message : String(err)}`
    )
  }
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
  if (override === undefined || override === null) return base
  if (!isPlainObject(base) || !isPlainObject(override)) return override

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
