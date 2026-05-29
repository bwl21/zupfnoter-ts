/**
 * Confstack – generischer hierarchischer Konfigurations-Stack.
 *
 * Port von `confstack.rb` aus dem Legacy-System.
 *
 * Jede Schicht ist ein eigenständiger Hash. `push(hash)` legt ihn oben auf
 * den Stack. `get(path?)` sucht von oben nach unten durch alle Schichten und
 * gibt den letzten (untersten) Treffer zurück — d.h. spätere pushes haben
 * niedrigere Priorität als frühere. `pop()` entfernt die oberste Schicht.
 *
 * Late-Binding-Werte (Funktionen) werden beim Zugriff rekursiv aufgelöst.
 */

import { requireDefined } from './requireDefined.js'

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein beliebiges Konfigurations-Objekt (verschachtelt). */
export type ConfigObject = Record<string, unknown>

/** Ein Konfigurations-Wert: direkt oder als Late-Binding-Funktion. */
export type ConfigValue = unknown | ((...args: unknown[]) => unknown)

/** Optionen für `get(...)`. */
export interface ConfstackGetOptions {
  resolve?: boolean
}

// ---------------------------------------------------------------------------
// Confstack
// ---------------------------------------------------------------------------

/**
 * Legacy-faithful conf stack.
 *
 * Jede `push()`-Schicht erzeugt einen vollständigen Snapshot, indem die
 * vorherige Schicht tief kopiert und mit dem neuen Overlay tief gemergt wird.
 * Dadurch bleibt ein gepushter Wert auch dann stabil, wenn der Ursprung
 * außerhalb des Stacks später mutiert wird.
 */
export class Confstack {
  strict = true
  private _stack: ConfigObject[] = [{}]
  private _resultFlat: ConfigObject = {}
  private _keysFlat: string[] = []
  private _lookupCache = new Map<string, unknown>()
  private _resultCache = new WeakMap<Function, unknown>()

  /**
   * Legt eine neue Konfigurationsschicht oben auf den Stack.
   * Entspricht `push(hash)` in `confstack.rb`.
   */
  push(config: ConfigObject): void {
    const base = this._stack.length === 0
      ? {}
      : this._stack[this._stack.length - 1]
    this._stack.push(deepMerge(base, config))
    this._lookupCache.clear()
    this._resultCache = new WeakMap()
    this._flatten()
  }

  /**
   * Entfernt die oberste Schicht vom Stack.
   * Wirft einen Fehler wenn der Stack leer ist.
   * Entspricht `pop()` in `confstack.rb`.
   */
  pop(): void {
    if (this._stack.length === 0) {
      throw new Error('Confstack.pop(): stack is empty')
    }
    this._stack.pop()
    this._lookupCache.clear()
    this._resultCache = new WeakMap()
    this._flatten()
  }

  /**
   * Gibt die Anzahl der Schichten zurück.
   */
  get depth(): number {
    return this._stack.length
  }

  /**
   * Liest einen Wert per Punkt-Notation (z.B. `'layout.ELLIPSE_SIZE'`).
   *
   * Ohne `path` wird der gesamte aktuelle Stack zurückgegeben.
   * `resolve: false` liefert den Rohwert ohne Late-Binding-Auflösung.
   * Late-Binding-Werte (Funktionen) werden rekursiv aufgelöst.
   *
   * Entspricht `get(key, options)` / `[](key)` in `confstack.rb`.
   */
  get(path?: string, options: ConfstackGetOptions = {}): unknown {
    if (path === undefined) {
      return options.resolve === false ? this._resultFlat : this._resolveDependencies(this._resultFlat)
    }

    const value = this._lookup(path)
    if (value === undefined && !this._keysFlat.includes(path)) {
      if (!this.strict) return undefined
      throw new Error(`confstack: key not available: ${path}`)
    }
    return options.resolve === false ? value : this._resolveDependencies(value)
  }

  /**
   * Gibt den gesamten aufgelösten Stack als verschachteltes Objekt zurück.
   * Late-Binding-Werte werden rekursiv aufgelöst.
   *
   * Entspricht `get()` ohne Argument in `confstack.rb`.
   */
  getAll(): ConfigObject {
    return this.get(undefined) as ConfigObject
  }

  /**
   * Gibt alle Schlüssel unterhalb eines Präfixes als verschachteltes Objekt zurück.
   * Late-Binding-Werte werden rekursiv aufgelöst.
   * Gibt `undefined` zurück wenn der Pfad nicht existiert.
   */
  getSubtree(prefix: string): ConfigObject | undefined {
    const value = this._lookup(prefix)
    if (value === undefined) return undefined
    return this._resolveDependencies(value) as ConfigObject
  }

  /**
   * Wie `get()`, aber wirft einen Fehler wenn kein Wert gefunden wurde.
   */
  require(path: string): unknown {
    const value = this._lookup(path)
    if (value === undefined && !this._keysFlat.includes(path)) {
      throw new Error(`Confstack.require(): no value found for path '${path}'`)
    }
    return this._resolveDependencies(value)
  }

  /**
   * Schreibt einen Wert per Punkt-Notation direkt in die oberste Schicht.
   * Entspricht `[]=(key, value)` in `confstack.rb`.
   */
  set(path: string, value: unknown): void {
    if (value === DeleteMe || value instanceof DeleteMe) {
      this.delete(path)
      return
    }

    const fragment = buildNestedValue(path.split('.'), value)
    this.push(fragment)
  }

  /**
   * Löscht einen Wert aus der obersten Schicht.
   * Entspricht `delete(key)` in `confstack2.rb`.
   */
  delete(path: string): void {
    if (this._stack.length === 0) {
      this._stack.push({})
    }
    const top = requireDefined(this._stack[this._stack.length - 1], 'Confstack.delete(): stack is empty')
    deleteNestedValue(top, path.split('.'))
    this._flatten()
  }

  /**
   * Schneidet den Stack auf die angegebene Tiefe zurück.
   * Schichten oberhalb von `level` werden entfernt.
   *
   * Entspricht `reset_to(level)` in `confstack2.rb`:
   *   `@confstack = @confstack[0 .. level]`
   *
   * Typischer Anwendungsfall: Render-Zyklus setzt Stack auf Layer 1 (Defaults)
   * zurück, bevor die Song-Konfiguration als Layer 2 gepusht wird.
   *
   * @param level Ziel-Tiefe (0 = leerer Stack, 1 = nur unterste Schicht, …)
   */
  resetTo(level: number): void {
    if (level < 0) level = 0
    this._stack = this._stack.slice(0, level + 1)
    this._lookupCache.clear()
    this._resultCache = new WeakMap()
    this._flatten()
  }

  /**
   * Gibt alle verschachtelten Schlüssel zurück (Punkt-Notation).
   * Entspricht `keys()` in `confstack.rb`.
   */
  keys(): string[] {
    return this._keysFlat
  }

  /**
   * Gibt eine flache Darstellung des aufgelösten Stacks zurück (Punkt-Schlüssel).
   * Nützlich für Debugging. Late-Binding-Werte werden nicht aufgelöst.
   */
  toFlat(): ConfigObject {
    const result: ConfigObject = {}
    for (const key of this._keysFlat) {
      result[key] = digPath(this._resultFlat, key.split('.'))
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // Interne Methoden
  // ---------------------------------------------------------------------------

  /**
   * Berechnet `_resultFlat` und `_keysFlat` neu.
   *
   * Entspricht `_flatten()` in `confstack.rb`:
   * - Sammelt alle Schlüssel aus allen Schichten
   * - Für jeden Schlüssel: letzter Treffer von unten gewinnt
   * - Baut daraus einen verschachtelten Hash auf
   */
  private _flatten(): void {
    const top = this._stack[this._stack.length - 1]
    this._resultFlat = top ?? {}
    this._keysFlat = top === undefined ? [] : getKeys(top)
  }

  /**
   * Liest einen Wert ohne Late-Binding-Auflösung aus der obersten Schicht.
   */
  private _lookup(path: string): unknown {
    if (this._lookupCache.has(path)) {
      return this._lookupCache.get(path)
    }

    const top = this._stack[this._stack.length - 1]
    const value = top === undefined ? undefined : digPath(top, path.split('.'))
    this._lookupCache.set(path, value)
    return value
  }

  /**
   * Löst Late-Binding-Werte rekursiv unter Berücksichtigung des Legacy-Caches auf.
   */
  private _resolveDependencies(value: unknown, callstack: Set<Function> = new Set()): unknown {
    if (typeof value === 'function') {
      const fn = value as () => unknown
      if (this._resultCache.has(fn)) {
        return this._resultCache.get(fn)
      }
      if (callstack.has(fn)) {
        throw new Error('Confstack: circular late-binding dependency detected')
      }
      const next = new Set(callstack)
      next.add(fn)
      const result = this._resolveDependencies(fn(), next)
      this._resultCache.set(fn, result)
      return result
    }

    if (Array.isArray(value)) {
      return value.map(item => this._resolveDependencies(item, callstack))
    }

    if (value !== null && typeof value === 'object') {
      const result: ConfigObject = {}
      for (const [k, v] of Object.entries(value as ConfigObject)) {
        result[k] = this._resolveDependencies(v, callstack)
      }
      return result
    }

    return value
  }
}

/**
 * Legacy delete sentinel.
 *
 * Entspricht `Confstack::DeleteMe` in `confstack2.rb`.
 */
export class DeleteMe {}

// ---------------------------------------------------------------------------
// Late-Binding-Auflösung
// ---------------------------------------------------------------------------

/**
 * Löst Late-Binding-Werte rekursiv auf.
 *
 * - Funktionen werden aufgerufen und ihr Rückgabewert rekursiv aufgelöst.
 * - Arrays werden elementweise aufgelöst.
 * - Objekte werden wertweise aufgelöst.
 * - Primitive Werte werden unverändert zurückgegeben.
 *
 * `callstack` verhindert zirkuläre Abhängigkeiten.
 *
 * Entspricht `_resolve_dependencies()` in `confstack.rb`.
 */
function resolveDependencies(value: unknown, callstack: Set<() => unknown> = new Set()): unknown {
  if (typeof value === 'function') {
    const fn = value as () => unknown
    if (callstack.has(fn)) {
      throw new Error('Confstack: circular late-binding dependency detected')
    }
    const next = new Set(callstack)
    next.add(fn)
    return resolveDependencies(fn(), next)
  }

  if (Array.isArray(value)) {
    return value.map(item => resolveDependencies(item, callstack))
  }

  if (value !== null && typeof value === 'object') {
    const result: ConfigObject = {}
    for (const [k, v] of Object.entries(value as ConfigObject)) {
      result[k] = resolveDependencies(v, callstack)
    }
    return result
  }

  return value
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Liest einen verschachtelten Wert per Pfad-Array (entspricht `dig()` in Ruby /
 * `_get_one()` in `confstack.rb`).
 */
function digPath(obj: unknown, parts: string[]): unknown {
  let current = obj
  for (const part of parts) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Gibt alle verschachtelten Schlüssel eines Objekts als Punkt-Pfade zurück.
 * Entspricht `_get_keys()` in `confstack.rb`.
 * Arrays und Funktionen werden als Blatt-Werte behandelt.
 */
function getKeys(obj: ConfigObject, parentKey = ''): string[] {
  const result: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key
    result.push(fullKey)
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof value !== 'function'
    ) {
      result.push(...getKeys(value as ConfigObject, fullKey))
    }
  }
  return result
}

/**
 * Setzt einen Wert in einem verschachtelten Objekt per Pfad-Array.
 * Entspricht `_add_hash()` in `confstack.rb`.
 */
function setNestedValue(obj: ConfigObject, parts: string[], value: unknown): void {
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = requireDefined(parts[i], 'Confstack.setNestedValue(): missing path segment')
    if (typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part])) {
      current[part] = {}
    }
    current = current[part] as ConfigObject
  }
  const last = requireDefined(parts[parts.length - 1], 'Confstack.setNestedValue(): missing final path segment')
  current[last] = value
}

/**
 * Baut ein verschachteltes Objekt für einen Punkt-Pfad.
 * Entspricht der Ruby-Implementierung von `[]=` über verschachtelte Hashes.
 */
function buildNestedValue(parts: string[], value: unknown): ConfigObject {
  if (parts.length === 0) return {}
  return parts
    .slice()
    .reverse()
    .reduce<unknown>((current, part) => ({ [part]: current }), value) as ConfigObject
}

/**
 * Löscht einen verschachtelten Wert per Pfad-Array.
 * Entspricht `delete(key)` in `confstack2.rb`.
 */
function deleteNestedValue(obj: ConfigObject, parts: string[]): void {
  if (parts.length === 0) return
  if (parts.length === 1) {
    const key = requireDefined(parts[0], 'Confstack.deleteNestedValue(): missing path segment')
    delete obj[key]
    return
  }

  const key = requireDefined(parts[0], 'Confstack.deleteNestedValue(): missing path segment')
  const next = obj[key]
  if (next === null || typeof next !== 'object' || Array.isArray(next)) {
    return
  }

  deleteNestedValue(next as ConfigObject, parts.slice(1))
}

/**
 * Tiefes Kopieren eines Konfigurationswerts.
 */
function deepClone(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => deepClone(entry))
  }
  if (value !== null && typeof value === 'object') {
    const result: ConfigObject = {}
    for (const [key, entry] of Object.entries(value as ConfigObject)) {
      result[key] = deepClone(entry)
    }
    return result
  }
  return value
}

/**
 * Ruby-ähnliches `deep_merge` ohne Seiteneffekte.
 */
function deepMerge(base: unknown, override: unknown): ConfigObject {
  if (override === undefined) {
    return deepClone(base) as ConfigObject
  }
  if (
    base === null ||
    override === null ||
    typeof base !== 'object' ||
    typeof override !== 'object' ||
    Array.isArray(base) ||
    Array.isArray(override)
  ) {
    return deepClone(override) as ConfigObject
  }

  const result: ConfigObject = deepClone(base) as ConfigObject
  for (const [key, value] of Object.entries(override as ConfigObject)) {
    const current = result[key]
    if (
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current) &&
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      result[key] = deepMerge(current, value) as ConfigObject
    } else {
      result[key] = deepClone(value)
    }
  }
  return result
}
