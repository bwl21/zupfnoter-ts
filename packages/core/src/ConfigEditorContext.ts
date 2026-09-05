import type { ZupfnoterConfig } from '@zupfnoter/types'
import { Confstack, type ConfigObject } from './Confstack.js'
import { initConf, type InitConfOptions } from './initConf.js'
import { resolveConfigSchemaPath } from './configSchema.js'

/** Zentrale Editor-Sicht: dieselben Schichten für Werte und dynamische Bäume. */
export function createConfigEditorContext(
  document: Partial<ZupfnoterConfig>,
  extractId: number,
  options: InitConfOptions = {},
) {
  const stack = new Confstack()
  stack.strict = false
  const defaults = initConf(stack, options)
  stack.push(defaults as unknown as ConfigObject, 'built-in')
  stack.push(document as ConfigObject, 'global')
  stack.push({ extract: { [extractId]: { layout: defaults.layout, printer: defaults.printer } } }, 'built-in')
  stack.push({ extract: { [extractId]: { layout: document.layout, printer: document.printer } } }, 'global')
  for (const id of extractId === 0 ? ['0'] : ['0', String(extractId)]) {
    const source = id === String(extractId) ? 'active' : 'extract.0'
    const builtIn = defaults.extract[id]
    const local = document.extract?.[id]
    if (builtIn !== undefined) stack.push({ extract: { [extractId]: builtIn } }, 'built-in')
    if (local !== undefined) stack.push({ extract: { [extractId]: local } }, source)
  }

  function resolve(path: string) {
    let effectivePath = path
    let value = stack.get(path)
    if (value === undefined) {
      const parts = path.split('.')
      for (let length = parts.length; length > 0; length -= 1) {
        const template = resolveConfigSchemaPath(parts.slice(0, length).join('.'))?.['x-zupfnoter-default-path']
        if (template === undefined) continue
        const base = template.replace(/\{(\d+)\}/g, (_, index: string) => parts[Number(index)] ?? '')
        const candidate = [base, ...parts.slice(length)].join('.')
        const inherited = stack.get(candidate)
        if (inherited !== undefined) {
          effectivePath = candidate
          value = inherited
          break
        }
      }
    }
    return { value, path: effectivePath, source: stack.getSource(effectivePath) }
  }

  return { defaults, stack, resolve }
}
