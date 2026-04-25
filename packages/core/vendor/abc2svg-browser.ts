/**
 * Browser-compatible ESM wrapper for abc2svg-1.js.
 *
 * abc2svg uses `typeof module=='object'&&typeof exports=='object'` to detect
 * a CJS environment. In the browser that check is false, so it falls back to
 * setting `var abc2svg` and `var Abc` in the enclosing scope.
 *
 * We execute the source inside a Function scope that provides a fake
 * module/exports object, then return those exports. This works in both
 * Node.js (via Vite's SSR) and the browser (no Node APIs needed).
 */

// Vite inlines the file content at build time via ?raw
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – raw import, no type declarations
import abc2svgSource from './abc2svg-1.js?raw'

interface Abc2svgExports {
  abc2svg: { C: Record<string, number>; sym_name: string[]; version: string }
  Abc: new (user: unknown) => unknown
}

function loadAbc2svg(): Abc2svgExports {
  const mod = { exports: {} as Record<string, unknown> }
  // Execute abc2svg in a scope where module/exports exist so the CJS branch fires.
  // eslint-disable-next-line no-new-func
  const fn = new Function('module', 'exports', abc2svgSource)
  fn(mod, mod.exports)

  // Verify the exports are present
  if (!mod.exports['Abc'] || !mod.exports['abc2svg']) {
    // abc2svg did not export via CJS — it set globals instead (old browser path).
    // Fall back to reading from globalThis.
    const g = globalThis as unknown as Record<string, unknown>
    if (g['Abc'] && g['abc2svg']) {
      return { Abc: g['Abc'] as Abc2svgExports['Abc'], abc2svg: g['abc2svg'] as Abc2svgExports['abc2svg'] }
    }
    throw new Error('abc2svg failed to load: neither CJS exports nor globals found')
  }

  return mod.exports as unknown as Abc2svgExports
}

const _abc2svgModule = loadAbc2svg()

export default _abc2svgModule
export const { abc2svg, Abc } = _abc2svgModule
