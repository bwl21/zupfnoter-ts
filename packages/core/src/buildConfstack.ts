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
  const extractKey = String(extractNr)
  const baseExtract = config.extract['0']
  const targetExtract = config.extract[extractKey]

  // Schicht 1: Globale Konfiguration
  stack.push({
    layout: config.layout as unknown as ConfigObject,
    printer: config.printer as unknown as ConfigObject,
  })

  // Schicht 2: Basis-Extrakt (extract.0), wenn wir nicht bereits Extrakt 0 sind
  if (extractKey !== '0' && baseExtract) {
    stack.push(extractToLayer(baseExtract))
  }

  // Schicht 3: Ziel-Extrakt (ohne layout/printer-Overrides)
  if (targetExtract) {
    stack.push(extractToLayer(targetExtract))
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
 * Wandelt eine ExtractConfig in eine Stack-Schicht um.
 * layout/printer-Overrides werden ausgelassen — sie kommen als eigene Schichten.
 */
function extractToLayer(extract: ExtractConfig): ConfigObject {
  const { layout: _layout, printer: _printer, ...rest } = extract
  return { extract: rest } as unknown as ConfigObject
}
