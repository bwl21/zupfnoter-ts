/**
 * Zupfnoter-spezifischer Confstack-Aufbau.
 *
 * Entspricht `_layout_prepare_options()` in `harpnotes.rb` und
 * `load_music_model()` in `controller.rb`: baut den Konfigurations-Stack
 * für einen Extrakt aus einer `ZupfnoterConfig` auf.
 *
 * Diese Datei ist bewusst von `Confstack.ts` getrennt — der Confstack
 * selbst ist generisch und hat keine Kenntnis von Zupfnoter-Konzepten.
 */

import type { ZupfnoterConfig, ExtractConfig } from '@zupfnoter/types'
import { Confstack, type ConfigObject } from './Confstack.js'

/**
 * Baut einen Confstack für einen Extrakt auf.
 *
 * Schichtung (entspricht `_layout_prepare_options` in `harpnotes.rb`):
 *   1. Globale Layout- und Printer-Konfiguration (Basis)
 *   2. Extrakt 0 als Basis (wenn extractNr != 0)
 *   3. Ziel-Extrakt (extract.N, ohne layout/printer-Overrides)
 *   4. Printer-Override des Extrakts
 *   5. Layout-Override des Extrakts
 */
export function buildConfstack(
  config: ZupfnoterConfig,
  extractNr: number | string = 0,
): Confstack {
  const stack = new Confstack()
  stack.strict = false
  const extractKey = String(extractNr)
  const baseExtract = config.extract['0']
  const targetExtract = config.extract[extractKey]

  // Schicht 1: Globale Konfiguration
  stack.push({
    layout: config.layout as unknown as ConfigObject,
    printer: config.printer as unknown as ConfigObject,
  })

  // Schicht 2: Basis-Extrakt (extract.0), wenn wir nicht bereits Extrakt 0 sind.
  // The active extract id remains part of the path; the base values are
  // layered under the target id so inheritance does not create an id-less alias.
  if (extractKey !== '0' && baseExtract) {
    stack.push(extractToLayer(extractKey, baseExtract))
    if (baseExtract.printer) {
      stack.push({ printer: baseExtract.printer as unknown as ConfigObject })
    }
    if (baseExtract.layout) {
      stack.push({ layout: baseExtract.layout as unknown as ConfigObject })
    }
  }

  // Schicht 3: Ziel-Extrakt (ohne layout/printer-Overrides)
  if (targetExtract) {
    stack.push(extractToLayer(extractKey, targetExtract))
  }

  // Schicht 4: Printer-Override des Extrakts
  if (targetExtract?.printer) {
    stack.push({ printer: targetExtract.printer as unknown as ConfigObject })
  }

  // Schicht 5: Layout-Override des Extrakts
  if (targetExtract?.layout) {
    stack.push({ layout: targetExtract.layout as unknown as ConfigObject })
  }

  return stack
}

/**
 * Baut die Legacy-kompatible lokale Layout-Instanz für einen Extrakt.
 *
 * Diese Instanz ist absichtlich nicht der globale Konfigurationsbaum: In ihr
 * liegen extract.0 und der aktive Extrakt als lokale wirksame Werte. Die
 * fachlichen Schlüssel im Sheet-Modell bleiben davon unberührt und werden
 * weiterhin mit `extract.<id>...` erzeugt.
 */
export function buildPrintOptions(
  config: ZupfnoterConfig,
  extractNr: number | string = 0,
): Confstack {
  const stack = new Confstack()
  stack.strict = false
  const extractKey = String(extractNr)
  const baseExtract = config.extract['0']
  const targetExtract = config.extract[extractKey]

  const { extract: _extract, ...globalConfigValues } = config
  const globalConfig = globalConfigValues as unknown as ConfigObject
  // initConf-Presets enthalten weiterhin Late-Bindings auf extract.0.
  // Diese globale Referenz bleibt in der lokalen Instanz verfügbar; die
  // wirksamen Extraktwerte liegen zusätzlich direkt auf ihrer Wurzelebene.
  globalConfig.extract = config.extract as unknown as ConfigObject
  stack.push(globalConfig)

  if (extractKey !== '0' && baseExtract) {
    stack.push(extractToPrintOptionsLayer(baseExtract))
    if (baseExtract.printer) stack.push({ printer: baseExtract.printer as unknown as ConfigObject })
    if (baseExtract.layout) stack.push({ layout: baseExtract.layout as unknown as ConfigObject })
  }

  if (targetExtract) stack.push(extractToPrintOptionsLayer(targetExtract))
  if (targetExtract?.printer) stack.push({ printer: targetExtract.printer as unknown as ConfigObject })
  if (targetExtract?.layout) stack.push({ layout: targetExtract.layout as unknown as ConfigObject })

  return stack
}

/**
 * Wandelt eine ExtractConfig in eine Stack-Schicht um.
 * layout/printer-Overrides werden ausgelassen — sie kommen als eigene Schichten.
 */
function extractToLayer(extractKey: string, extract: ExtractConfig): ConfigObject {
  const { layout: _layout, printer: _printer, ...rest } = extract
  const notebound = (rest.notebound ?? {}) as Record<string, unknown>
  return {
    extract: {
      [extractKey]: {
        ...rest,
        notebound: {
          minc: {},
          ...notebound,
        },
      },
    },
  } as unknown as ConfigObject
}

function extractToPrintOptionsLayer(extract: ExtractConfig): ConfigObject {
  const { layout: _layout, printer: _printer, ...rest } = extract
  const notebound = (rest.notebound ?? {}) as Record<string, unknown>
  const localOptions = {
    ...rest,
    notebound: {
      minc: {},
      ...notebound,
    },
  }
  return {
    ...localOptions,
    print_options: localOptions,
  } as unknown as ConfigObject
}
