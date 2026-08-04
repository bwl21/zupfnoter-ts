/**
 * Unit-Tests für Confstack (Phase 3.1).
 *
 * Testet:
 * - push/pop/depth
 * - get() mit Punkt-Notation (dig-Semantik)
 * - Priorität: spätere push() überschreiben frühere (Deep-Merge)
 * - Late Binding (Funktionswerte, rekursiv in Arrays und Objekten)
 * - require() wirft bei fehlendem Wert
 * - getSubtree() / getAll()
 * - set() / keys()
 * - buildConfstack() Factory
 * - Extract-Vererbung
 */

import { describe, it, expect } from 'vitest'
import { Confstack, DeleteMe } from '../../Confstack.js'
import { buildConfstack } from '../../buildConfstack.js'
import { initConf } from '../../initConf.js'
import { defaultTestConfig } from '../defaultConfig.js'
import type { ZupfnoterConfig } from '@zupfnoter/types'

// ---------------------------------------------------------------------------
// Grundlegende Stack-Operationen
// ---------------------------------------------------------------------------

describe('Confstack – Stack-Operationen', () => {
  it('startet mit depth 1', () => {
    const cs = new Confstack()
    expect(cs.depth).toBe(1)
  })

  it('push erhöht depth', () => {
    const cs = new Confstack()
    cs.push({ a: 1 })
    expect(cs.depth).toBe(2)
    cs.push({ b: 2 })
    expect(cs.depth).toBe(3)
  })

  it('push erstellt einen Snapshot und bleibt gegen Außenmutation stabil', () => {
    const cs = new Confstack()
    const fragment = { layout: { X_SPACING: 11.5 } }
    cs.push(fragment)

    fragment.layout.X_SPACING = 99

    expect(cs.get('layout.X_SPACING')).toBe(11.5)
  })

  it('pop verringert depth', () => {
    const cs = new Confstack()
    cs.push({ x: 42 })
    cs.pop()
    expect(cs.depth).toBe(1)
  })

  it('pop auf leerem Stack wirft', () => {
    const cs = new Confstack()
    cs.pop()
    expect(() => cs.pop()).toThrow('stack is empty')
  })

  it('pop stellt vorherigen Zustand wieder her', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5 } })
    cs.push({ layout: { X_SPACING: 20.0 } })
    expect(cs.get('layout.X_SPACING')).toBe(20.0)
    cs.pop()
    expect(cs.get('layout.X_SPACING')).toBe(11.5)
  })
})

// ---------------------------------------------------------------------------
// get() – Punkt-Notation (dig-Semantik)
// ---------------------------------------------------------------------------

describe('Confstack.get() – Punkt-Notation', () => {
  it('liest einen verschachtelten Wert', () => {
    const cs = new Confstack()
    cs.push({ layout: { ELLIPSE_SIZE: [3.5, 1.7] } })
    expect(cs.get('layout.ELLIPSE_SIZE')).toEqual([3.5, 1.7])
  })

  it('gibt den gesamten aktuellen Stack zurück ohne Pfad', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5 } })
    expect(cs.get()).toEqual({ layout: { X_SPACING: 11.5 } })
  })

  it('löst ohne Pfad Late Binding auf', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: () => 42 } })
    expect(cs.get()).toEqual({ layout: { X_SPACING: 42 } })
  })

  it('liefert ohne Pfad den Rohwert wenn resolve=false gesetzt ist', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: () => 42 } })
    const raw = cs.get(undefined, { resolve: false }) as Record<string, unknown>
    const layout = raw.layout as Record<string, unknown>
    expect(layout.X_SPACING).toBeInstanceOf(Function)
  })

  it('liefert den Rohwert ohne Auflösung wenn resolve=false gesetzt ist', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: () => 42 } })
    const raw = cs.get('layout.X_SPACING', { resolve: false })
    expect(typeof raw).toBe('function')
  })

  it('gibt bei fehlendem Pfad einen Fehler', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5 } })
    expect(() => cs.get('layout.MISSING')).toThrow('confstack: key not available: layout.MISSING')
  })

  it('wirft bei leerem Stack für einen Pfad', () => {
    const cs = new Confstack()
    expect(() => cs.get('layout.ELLIPSE_SIZE')).toThrow('confstack: key not available: layout.ELLIPSE_SIZE')
  })

  it('liest tief verschachtelte Werte', () => {
    const cs = new Confstack()
    cs.push({ layout: { color: { color_default: 'black' } } })
    expect(cs.get('layout.color.color_default')).toBe('black')
  })

  it('liest einen Wert aus mehreren Ebenen', () => {
    const cs = new Confstack()
    cs.push({ a: { b: { c: 99 } } })
    expect(cs.get('a.b.c')).toBe(99)
  })
})

// ---------------------------------------------------------------------------
// Priorität: Deep-Merge-Semantik
// ---------------------------------------------------------------------------

describe('Confstack.get() – Priorität (Deep-Merge)', () => {
  it('späterer push überschreibt früheren Wert', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5 } })
    cs.push({ layout: { X_SPACING: 20.0 } })
    expect(cs.get('layout.X_SPACING')).toBe(20.0)
  })

  it('nicht überschriebene Werte bleiben erhalten (Deep-Merge)', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5, Y_SCALE: 1.0 } })
    cs.push({ layout: { X_SPACING: 20.0 } })
    expect(cs.get('layout.X_SPACING')).toBe(20.0)
    expect(cs.get('layout.Y_SCALE')).toBe(1.0)
  })

  it('drei pushes – korrekte Priorität', () => {
    const cs = new Confstack()
    cs.push({ val: 'first' })
    cs.push({ val: 'second' })
    cs.push({ val: 'third' })
    expect(cs.get('val')).toBe('third')
  })

  it('Arrays werden vollständig ersetzt (nicht gemergt)', () => {
    const cs = new Confstack()
    cs.push({ voices: [1, 2, 3, 4] })
    cs.push({ voices: [1, 2] })
    expect(cs.get('voices')).toEqual([1, 2])
  })
})

// ---------------------------------------------------------------------------
// Late Binding
// ---------------------------------------------------------------------------

describe('Confstack.get() – Late Binding', () => {
  it('ruft Funktionswerte beim Zugriff auf', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: () => 42 } })
    expect(cs.get('layout.X_SPACING')).toBe(42)
  })

  it('wertet Funktion beim zweiten Zugriff aus dem Cache aus', () => {
    let counter = 0
    const cs = new Confstack()
    cs.push({ counter: () => ++counter })
    expect(cs.get('counter')).toBe(1)
    expect(cs.get('counter')).toBe(1)
  })

  it('nicht-Funktionswerte werden direkt zurückgegeben', () => {
    const cs = new Confstack()
    cs.push({ arr: [1, 2, 3] })
    expect(cs.get('arr')).toEqual([1, 2, 3])
  })

  it('Funktionen in Arrays werden aufgelöst', () => {
    const cs = new Confstack()
    cs.push({ arr: [() => 1, () => 2, 3] })
    expect(cs.get('arr')).toEqual([1, 2, 3])
  })

  it('Funktionen in verschachtelten Objekten werden über getSubtree aufgelöst', () => {
    const cs = new Confstack()
    cs.push({ obj: { a: () => 42, b: 'static' } })
    expect(cs.getSubtree('obj')).toEqual({ a: 42, b: 'static' })
  })

  it('zirkuläre Abhängigkeiten (gleiche Funktionsreferenz) werfen einen Fehler', () => {
    const fn: () => unknown = () => fn
    const cs = new Confstack()
    cs.push({ x: fn })
    expect(() => cs.get('x')).toThrow('circular late-binding dependency detected')
  })
})

// ---------------------------------------------------------------------------
// require()
// ---------------------------------------------------------------------------

describe('Confstack.require()', () => {
  it('gibt den Wert zurück wenn vorhanden', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5 } })
    expect(cs.require('layout.X_SPACING')).toBe(11.5)
  })

  it('wirft wenn kein Wert gefunden', () => {
    const cs = new Confstack()
    expect(() => cs.require('layout.MISSING')).toThrow("no value found for path 'layout.MISSING'")
  })
})

// ---------------------------------------------------------------------------
// set()
// ---------------------------------------------------------------------------

describe('Confstack.set()', () => {
  it('schreibt einen Wert per Punkt-Notation', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5 } })
    cs.set('layout.X_SPACING', 20.0)
    expect(cs.get('layout.X_SPACING')).toBe(20.0)
  })

  it('set() legt eine neue Schicht an und ist per pop() rückgängig zu machen', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5 } })
    cs.set('layout.X_SPACING', 20.0)
    expect(cs.get('layout.X_SPACING')).toBe(20.0)
    cs.pop()
    expect(cs.get('layout.X_SPACING')).toBe(11.5)
  })

  it('DeleteMe löscht den Schlüssel aus der obersten Schicht', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5, Y_SCALE: 1.0 } })
    cs.set('layout.X_SPACING', DeleteMe)
    expect(() => cs.get('layout.X_SPACING')).toThrow('confstack: key not available: layout.X_SPACING')
    expect(cs.get('layout.Y_SCALE')).toBe(1.0)
  })
})

// ---------------------------------------------------------------------------
// keys()
// ---------------------------------------------------------------------------

describe('Confstack.keys()', () => {
  it('gibt alle Punkt-Pfade zurück', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5, Y_SCALE: 1.0 } })
    const keys = cs.keys()
    expect(keys).toContain('layout')
    expect(keys).toContain('layout.X_SPACING')
    expect(keys).toContain('layout.Y_SCALE')
  })

  it('gibt leeres Array bei leerem Stack zurück', () => {
    const cs = new Confstack()
    expect(cs.keys()).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// getSubtree()
// ---------------------------------------------------------------------------

describe('Confstack.getSubtree()', () => {
  it('gibt undefined zurück wenn Pfad nicht existiert', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5 } })
    expect(cs.getSubtree('printer')).toBeUndefined()
  })

  it('gibt einen Subtree als verschachteltes Objekt zurück', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5, Y_SCALE: 1.0 } })
    expect(cs.getSubtree('layout')).toEqual({ X_SPACING: 11.5, Y_SCALE: 1.0 })
  })

  it('Subtree respektiert Deep-Merge (spätere push überschreiben)', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5, Y_SCALE: 1.0 } })
    cs.push({ layout: { X_SPACING: 20.0 } })
    expect(cs.getSubtree('layout')).toEqual({ X_SPACING: 20.0, Y_SCALE: 1.0 })
  })

  it('gibt verschachtelten Subtree korrekt zurück', () => {
    const cs = new Confstack()
    cs.push({ layout: { color: { color_default: 'black', color_variant1: 'red' } } })
    expect(cs.getSubtree('layout.color')).toEqual({
      color_default: 'black',
      color_variant1: 'red',
    })
  })

  it('löst Funktionen in Subtree-Werten auf (rekursives Late Binding)', () => {
    const cs = new Confstack()
    cs.push({
      presets: {
        layout: {
          notes_regular: {
            LINE_MEDIUM: () => 0.3,
            ELLIPSE_SIZE: () => [3.5, 1.7],
          },
        },
      },
    })
    const subtree = cs.getSubtree('presets.layout.notes_regular') as Record<string, unknown>
    expect(subtree).toEqual({ LINE_MEDIUM: 0.3, ELLIPSE_SIZE: [3.5, 1.7] })
  })

  it('löst Funktionen in Arrays innerhalb eines Subtrees auf', () => {
    const cs = new Confstack()
    cs.push({ section: { items: [() => 1, () => 2, 3] } })
    const subtree = cs.getSubtree('section') as Record<string, unknown>
    expect(subtree).toEqual({ items: [1, 2, 3] })
  })

  it('hält die Extrakt-ID im wirksamen Pfad', () => {
    const cs = buildConfstack(defaultTestConfig, 0)
    const extract = cs.getSubtree('extract.0')
    expect(extract).toBeDefined()
    expect(extract).toHaveProperty('voices')
    expect(extract).toHaveProperty('flowlines')
    expect((extract as Record<string, unknown>).voices).toEqual([1, 2, 3, 4])
  })
})

// ---------------------------------------------------------------------------
// getAll()
// ---------------------------------------------------------------------------

describe('Confstack.getAll()', () => {
  it('gibt leeres Objekt bei leerem Stack zurück', () => {
    const cs = new Confstack()
    expect(cs.getAll()).toEqual({})
  })

  it('gibt den gesamten Stack als verschachteltes Objekt zurück', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5 } })
    cs.push({ printer: { show_border: false } })
    const all = cs.getAll() as Record<string, Record<string, unknown>>
    expect(all.layout?.X_SPACING).toBe(11.5)
    expect(all.printer?.show_border).toBe(false)
  })

  it('spätere pushes überschreiben frühere (Deep-Merge)', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5, Y_SCALE: 1.0 } })
    cs.push({ layout: { X_SPACING: 20.0 } })
    const all = cs.getAll() as Record<string, Record<string, unknown>>
    expect(all.layout?.X_SPACING).toBe(20.0)
    expect(all.layout?.Y_SCALE).toBe(1.0)
  })

  it('entspricht Legacy @print_options_raw.get (ohne Argument)', () => {
    const cs = buildConfstack(defaultTestConfig, 0)
    const all = cs.getAll() as Record<string, unknown>
    expect(all).toHaveProperty('layout')
    expect(all).toHaveProperty('printer')
    expect(all).toHaveProperty('extract')
  })
})

// ---------------------------------------------------------------------------
// toFlat()
// ---------------------------------------------------------------------------

describe('Confstack.toFlat()', () => {
  it('gibt leeres Objekt bei leerem Stack zurück', () => {
    const cs = new Confstack()
    expect(cs.toFlat()).toEqual({})
  })

  it('gibt alle Schlüssel als Punkt-Pfade zurück', () => {
    const cs = new Confstack()
    cs.push({ layout: { X_SPACING: 11.5 } })
    cs.push({ printer: { show_border: false } })
    expect(cs.toFlat()).toMatchObject({
      'layout.X_SPACING': 11.5,
      'printer.show_border': false,
    })
  })
})

// ---------------------------------------------------------------------------
// buildConfstack() – Factory
// ---------------------------------------------------------------------------

describe('buildConfstack()', () => {
  it('baut einen Stack aus ZupfnoterConfig auf', () => {
    const cs = buildConfstack(defaultTestConfig, 0)
    expect(cs.depth).toBeGreaterThan(0)
  })

  it('liest globale Layout-Werte', () => {
    const cs = buildConfstack(defaultTestConfig, 0)
    expect(cs.get('layout.ELLIPSE_SIZE')).toEqual([3.5, 1.7])
    expect(cs.get('layout.X_SPACING')).toBe(11.5)
  })

  it('liest globale Printer-Werte', () => {
    const cs = buildConfstack(defaultTestConfig, 0)
    expect(cs.get('printer.show_border')).toBe(false)
  })

  it('liest Extrakt-Werte', () => {
    const cs = buildConfstack(defaultTestConfig, 0)
    expect(cs.get('extract.0.voices')).toEqual([1, 2, 3, 4])
    expect(cs.get('extract.0.flowlines')).toEqual([1, 3])
  })

  it('Layout-Override eines Extrakts überschreibt globale Layout-Werte', () => {
    const base0 = defaultTestConfig.extract['0']
    if (base0 === undefined) {
      throw new Error('defaultTestConfig.extract[0] missing')
    }
    const config: ZupfnoterConfig = {
      ...defaultTestConfig,
      extract: {
        '0': {
          ...base0,
          layout: {
            X_SPACING: 99.0,
          },
        },
      },
    }
    const cs = buildConfstack(config, 0)
    expect(cs.get('layout.X_SPACING')).toBe(99.0)
    expect(cs.get('layout.ELLIPSE_SIZE')).toEqual([3.5, 1.7])
  })

  it('Printer-Override eines Extrakts überschreibt globale Printer-Werte', () => {
    const base0 = defaultTestConfig.extract['0']
    if (base0 === undefined) {
      throw new Error('defaultTestConfig.extract[0] missing')
    }
    const config: ZupfnoterConfig = {
      ...defaultTestConfig,
      extract: {
        '0': {
          ...base0,
          printer: {
            show_border: true,
          },
        },
      },
    }
    const cs = buildConfstack(config, 0)
    expect(cs.get('printer.show_border')).toBe(true)
  })

  it('stellt das Legacy-Beam-Mapping bereit', () => {
    const base0 = defaultTestConfig.extract['0']
    if (base0 === undefined) {
      throw new Error('defaultTestConfig.extract[0] missing')
    }
    const baseLayout = base0.layout ?? {}
    const config: ZupfnoterConfig = {
      ...defaultTestConfig,
      extract: {
        ...defaultTestConfig.extract,
        '0': {
          ...base0,
          layout: {
            ...baseLayout,
            beams: true,
          },
        },
      },
    }
    const cs = buildConfstack(config, 0)
    expect(cs.get('layout.beams')).toBe(true)
    expect(cs.get('layout.DURATION_TO_BEAMS')).toBeDefined()
  })

  it('liefert die vollständige Default-Konfiguration schon in initConf()', () => {
    const conf = new Confstack()
    const config = initConf(conf)
    const base0 = config.extract['0']
    if (base0 === undefined) {
      throw new Error('initConf() extract[0] missing')
    }

    expect(config.layout.DURATION_TO_BEAMS).toBeDefined()
    expect(base0.layout?.beams).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// initConf()
// ---------------------------------------------------------------------------

describe('initConf()', () => {
  it('liefert die legacy-basisnahen Defaults', () => {
    const conf = new Confstack()
    const defaults = initConf(conf)

    expect(defaults.abc_parser).toBe('ABC2SVG')
    expect(defaults.template).toEqual({
      filebase: '-no-template-',
      title: '- no template -',
    })
    expect(defaults.wrap).toBe(60)
    expect(defaults.defaults?.notebound).toMatchObject({
      annotation: { pos: [5, -7] },
      chord: { pos: [0, 0] },
      partname: { pos: [-4, -7] },
      variantend: { pos: [-4, -7] },
      tuplet: { cp1: [5, 2], cp2: [5, -2], shape: ['c'], show: true },
      flowline: { cp1: [0, 10], cp2: [0, -10], shape: ['c'], show: true },
    })
    expect(defaults.extract['0']?.sortmark).toEqual({
      size: [2, 4],
      fill: true,
      show: false,
    })
    expect(defaults.extract['0']?.tuplets).toEqual({
      text: '{{tuplet}}',
      style: 'small',
    })
    expect(defaults.annotations).toMatchObject({
      vl: { text: 'v', pos: [-5, -5] },
      rit: { text: 'rit', pos: [2, -5], style: 'italic' },
    })
    expect(defaults.templates).toMatchObject({
      notes: { pos: [320, 6], text: 'ENTER_NOTE', style: 'large' },
      images: { imagename: '', show: true, pos: [10, 10], height: 100 },
    })
  })
})

// ---------------------------------------------------------------------------
// Extract-Vererbung: Extrakt N erbt von Extrakt 0
// ---------------------------------------------------------------------------

describe('buildConfstack() – Extract-Vererbung', () => {
  const configWithTwoExtracts: ZupfnoterConfig = {
    ...defaultTestConfig,
    extract: {
      '0': {
        voices: [1, 2, 3, 4],
        flowlines: [1, 3],
        subflowlines: [2, 4],
        jumplines: [1, 3],
        synchlines: [[1, 2], [3, 4]],
        layoutlines: [1, 2, 3, 4],
        startpos: 15,
      },
      '1': {
        voices: [1, 2],
        flowlines: [1],
        subflowlines: [2],
        jumplines: [1],
        synchlines: [[1, 2]],
        layoutlines: [1, 2],
        startpos: 15,
        layout: {
          X_SPACING: 15.0,
        },
      },
    },
  }

  it('Extrakt 1 hat eigene voices', () => {
    const cs = buildConfstack(configWithTwoExtracts, 1)
    expect(cs.get('extract.1.voices')).toEqual([1, 2])
  })

  it('Extrakt 1 Layout-Override überschreibt globales Layout', () => {
    const cs = buildConfstack(configWithTwoExtracts, 1)
    expect(cs.get('layout.X_SPACING')).toBe(15.0)
  })

  it('Extrakt 1 erbt globale Layout-Werte die nicht überschrieben werden', () => {
    const cs = buildConfstack(configWithTwoExtracts, 1)
    expect(cs.get('layout.ELLIPSE_SIZE')).toEqual([3.5, 1.7])
  })

  it('Extrakt 1 hat mehr Schichten als Extrakt 0', () => {
    const cs0 = buildConfstack(configWithTwoExtracts, 0)
    const cs1 = buildConfstack(configWithTwoExtracts, 1)
    expect(cs1.depth).toBeGreaterThan(cs0.depth)
  })

  it('unbekannter Extrakt erbt von Extrakt 0 und globalen Werten', () => {
    const cs = buildConfstack(configWithTwoExtracts, 99)
    expect(cs.get('layout.ELLIPSE_SIZE')).toEqual([3.5, 1.7])
    expect(cs.get('extract.99.voices')).toEqual([1, 2, 3, 4])
  })
})
