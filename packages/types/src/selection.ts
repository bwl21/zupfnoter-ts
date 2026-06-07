/**
 * Selection model for the shared workbench state.
 *
 * Selection remains transient UI state, but it is shared across views so that
 * editor, previews and commands can operate on the same focal object.
 */

/** ABC text range addressed by zero-based character offsets. */
export interface SelectionTextRange {
  /** Inclusive start offset in the ABC source. */
  startpos: number
  /** Exclusive end offset in the ABC source. */
  endpos: number
}

/** Human-readable ABC cursor or range position. */
export interface SelectionLineColumn {
  /** 1-based line number. */
  line: number
  /** 1-based column number. */
  column: number
}

/** Mapping entry between text, music and config identities. */
export interface SelectionIndexEntry {
  /** Stable Zupfnoter identifier when the entry belongs to a music entity. */
  znId?: string
  /** ABC text range for the mapped entity. */
  textRange: SelectionTextRange
  /** 1-based start position in line/column form. */
  startPos: SelectionLineColumn
  /** 1-based end position in line/column form. */
  endPos: SelectionLineColumn
  /** Config reference when the mapped entity is config-backed. */
  confKey?: string
}

/** Cross-view mapping index used to translate between selection identities. */
export interface SelectionIndex {
  /** ABC source line starts as zero-based character offsets. */
  lineStarts: number[]
  /** Entry lookup by Zupfnoter id. */
  byZnId: Record<string, SelectionIndexEntry>
  /** Ordered entries for range-based lookups. */
  entries: SelectionIndexEntry[]
}

export interface SelectionState {
  /** What kind of object is currently selected. */
  kind: 'none' | 'music-range' | 'abc-range' | 'abc-element' | 'config-object'
  /** Selected Zupfnoter IDs, if the selection is tied to music entities. */
  znIds: string[]
  /** Selected ABC text range [startpos, endpos], if applicable. */
  textRange?: SelectionTextRange
  /** Selected line/column range, if applicable. */
  lineColumnRange?: {
    start: SelectionLineColumn
    end: SelectionLineColumn
  }
  /** Start char for selections that are best addressed by a single position. */
  startChar?: number
  /** Selected config key, if the selection points at a config object. */
  confKey?: string
  /** ABC element kind, if the selection is tied to a specific parser node. */
  abcElementKind?: string
  /** Where the selection originated from. */
  source: 'abc-editor' | 'score-preview' | 'harp-preview' | 'player' | 'command'
}
