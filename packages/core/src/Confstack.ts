/**
 * Confstack – generischer hierarchischer Konfigurations-Stack.
 *
 * Port von `confstack2.rb` aus dem Legacy-System.
 *
 * Jede Schicht ist ein vollständiger Snapshot: `push(hash)` erzeugt einen
 * Deep-Merge der aktuellen obersten Schicht mit dem neuen Hash und legt das
 * Ergebnis oben auf den Stack. `pop()` entfernt die oberste Schicht und
 * stellt damit den vorherigen Zustand wieder her.
 *
 * `get(path)` liest immer aus der obersten Schicht via Punkt-Notation.
 * Late-Binding-Werte (Funktionen) werden beim Zugriff rekursiv aufgelöst.
 */



// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein beliebiges Konfigurations-Objekt (verschachtelt). */
export type ConfigObject = Record<string, unknown>

/** Ein Konfigurations-Wert: direkt oder als Late-Binding-Funktion. */
export type ConfigValue = unknown | ((...args: unknown[]) => unknown)

// ---------------------------------------------------------------------------
// Confstack
// ---------------------------------------------------------------------------

/**
 * Stack-basierter Konfigurations-Resolver.
 *
 * Entspricht `Confstack` in `confstack2.rb`.
 *
 * Jede Schicht ist ein vollständiger Deep-Merge-Snapshot aller bisher
 * gepushten Konfigurationen. `get(path)` liest immer nur die oberste Schicht.
 */
export class Confstack {
  /** Stack von vollständigen Konfigurations-Snapshots. Basis-Schicht ist immer {}. */
  private readonly _stack: ConfigObject[] = [{}]

  /**
   * Legt eine neue Konfigurationsschicht oben auf den Stack.
   *
   * Die neue Schicht ist ein Deep-Merge der aktuellen obersten Schicht mit
   * `config`. Werte in `config` überschreiben bestehende Werte. Arrays werden
   * vollständig ersetzt (nicht gemergt).
   *
   * Entspricht `push(hash)` in `confstack2.rb`.
   */
  push(config: ConfigObject): void {
    const current = this._stack[this._stack.length - 1]!
    this._stack.push(deepMerge(deepDup(current) as ConfigObject, config))
  }

  /**
   * Entfernt die oberste Schicht vom Stack.
   * Wirft einen Fehler wenn nur die Basis-Schicht vorhanden ist.
   *
   * Entspricht `pop()` in `confstack2.rb`.
   */
  pop(): void {
    if (this._stack.length <= 1) {
      throw new Error('Confstack.pop(): cannot pop the base layer')
    }
    this._stack.pop()
  }

  /**
   * Gibt die Anzahl der gepushten Schichten zurück (ohne Basis-Schicht).
   */
  get depth(): number {
    return this._stack.length - 1
  }

  /**
   * Liest einen Wert per Punkt-Notation aus der obersten Schicht.
   *
   * Gibt `undefined` zurück wenn der Pfad nicht existiert.
   * Late-Binding-Werte (Funktionen) werden rekursiv aufgelöst.
   *
   * Entspricht `get(key)` / `[](key)` in `confstack2.rb`.
   */
  get(path: string): unknown {
    const top = this._stack[this._stack.length - 1]!
    return resolveDependencies(digPath(top, path.split('.')))
  }

  /**
   * Gibt die gesamte oberste Schicht als verschachteltes Objekt zurück.
   * Late-Binding-Werte werden rekursiv aufgelöst.
   *
   * Entspricht `get()` ohne Argument in `confstack2.rb`.
   */
  getAll(): ConfigObject {
    const top = this._stack[this._stack.length - 1]!
    return resolveDependencies(top) as ConfigObject
  }

  /**
   * Gibt alle Schlüssel unterhalb eines Präfixes als verschachteltes Objekt zurück.
   *
   * Entspricht `get("extract.0")` im Legacy-Code, das einen ganzen Subtree
   * zurückgibt. Late-Binding-Werte werden rekursiv aufgelöst.
   *
   * Gibt `undefined` zurück wenn der Pfad nicht existiert.
   */
  getSubtree(prefix: string): ConfigObject | undefined {
    const top = this._stack[this._stack.length - 1]!
    const value = digPath(top, prefix.split('.'))
    if (value === undefined) return undefined
    return resolveDependencies(value) as ConfigObject
  }

  /**
   * Wie `get()`, aber wirft einen Fehler wenn kein Wert gefunden wurde.
   */
  require(path: string): unknown {
    const value = this.get(path)
    if (value === undefined) {
      throw new Error(`Confstack.require(): no value found for path '${path}'`)
    }
    return value
  }

  /**
   * Schreibt einen Wert per Punkt-Notation in den Stack.
   *
   * Entspricht `[]=(key, value)` in `confstack2.rb`: pusht einen neuen
   * verschachtelten Hash, sodass `pop()` die Änderung rückgängig machen kann.
   */
  set(path: string, value: unknown): void {
    const parts = path.split('.').reverse()
    const hash = parts.reduce<unknown>((acc, key) => ({ [key]: acc }), value)
    this.push(hash as ConfigObject)
  }

  /**
   * Gibt alle verschachtelten Schlüssel der obersten Schicht zurück
   * (Punkt-Notation, z.B. `['layout.X_SPACING', 'layout.Y_SCALE', ...]`).
   *
   * Entspricht `keys()` / `digkeys()` in `confstack2.rb`.
   */
  keys(): string[] {
    const top = this._stack[this._stack.length - 1]!
    return digKeys(top)
  }

  /**
   * Gibt eine flache Darstellung der obersten Schicht zurück (Punkt-Schlüssel).
   * Nützlich für Debugging. Late-Binding-Werte werden nicht aufgelöst.
   */
  toFlat(): ConfigObject {
    const top = this._stack[this._stack.length - 1]!
    const result: ConfigObject = {}
    for (const key of digKeys(top)) {
      result[key] = digPath(top, key.split('.'))
    }
    return result
  }
}

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
 * `callstack` verhindert zirkuläre Abhängigkeiten: Wenn dieselbe
 * Funktionsreferenz während ihrer eigenen Auflösung erneut auftaucht,
 * wird ein Fehler geworfen.
 *
 * Entspricht `_resolve_dependencies()` in `confstack2.rb`.
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
 * Liest einen verschachtelten Wert per Pfad-Array (entspricht `dig()` in Ruby).
 * Gibt `undefined` zurück wenn ein Zwischenschritt fehlt.
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
 * Entspricht `digkeys()` in `confstack2.rb`.
 * Arrays und Funktionen werden als Blatt-Werte behandelt.
 */
function digKeys(obj: ConfigObject, parentKey = ''): string[] {
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
      result.push(...digKeys(value as ConfigObject, fullKey))
    }
  }
  return result
}

/**
 * Deep-Merge zweier Objekte. `source` überschreibt `target` rekursiv.
 * Arrays werden vollständig ersetzt (nicht gemergt) — wie in Ruby's deep_merge.
 */
function deepMerge(target: ConfigObject, source: ConfigObject): ConfigObject {
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = target[key]
    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      target[key] = deepMerge(targetValue as ConfigObject, sourceValue as ConfigObject)
    } else {
      target[key] = sourceValue
    }
  }
  return target
}

/**
 * Erstellt eine tiefe Kopie eines Wertes.
 * Funktionen werden als Referenz kopiert — wie in Ruby wo Procs nicht
 * dupliziert werden (`dup` auf einem Proc gibt dasselbe Objekt zurück).
 */
function deepDup(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (typeof value === 'function') return value
  if (Array.isArray(value)) return value.map(deepDup)
  const result: ConfigObject = {}
  for (const [k, v] of Object.entries(value as ConfigObject)) {
    result[k] = deepDup(v)
  }
  return result
}


