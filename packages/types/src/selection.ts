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

/** Addressable pane targets for a sheet object entry. */
export interface SheetObjectAddressability {
  /** Can be highlighted in the ABC editor. */
  editor: boolean
  /** Can be highlighted in the classical score preview. */
  score: boolean
  /** Can be highlighted in the harp/SVG preview. */
  svg: boolean
}

/** Mapping entry between text, music, score, and config identities. */
export interface SheetObjectIndexEntry {
  /** Origin domain of the addressable object. */
  kind: 'score-object' | 'music-entity' | 'sheet-object'
  /** Stable Zupfnoter identifier when the entry belongs to a music entity. */
  znId?: string
  /** 1-based voice id when the mapped entry belongs to a concrete voice. */
  voiceId?: string
  /** Music-time position used for cross-voice synchronization, if available. */
  musicTime?: number
  /** ABC text range for the mapped entity, if available. */
  textRange?: SelectionTextRange
  /** 1-based start position in line/column form, if available. */
  startPos?: SelectionLineColumn
  /** 1-based end position in line/column form, if available. */
  endPos?: SelectionLineColumn
  /** Config reference when the mapped entity is config-backed. */
  confKey?: string
  /** Pane-specific addressability for the current render generation. */
  addressableIn: SheetObjectAddressability
}

/** Cross-view mapping index used to translate between selection identities. */
export interface SheetObjectIndex {
  /** Render-generation-local version of the current index. */
  version: number
  /** ABC source line starts as zero-based character offsets. */
  lineStarts: number[]
  /** Active ABC voice id per 1-based source line, when derivable from `V:` directives. */
  voiceByLine: Record<number, string | undefined>
  /** Entry lookup by Zupfnoter id. */
  byZnId: Record<string, number[]>
  /** Entry lookup by config key. */
  byConfKey: Record<string, number[]>
  /** Exact text range lookup (`start:end`). */
  byTextRange: Record<string, number[]>
  /** Music-time lookup (`time`) for cross-voice selection expansion. */
  byMusicTime: Record<string, number[]>
  /** Ordered entries for range-based lookups. */
  entries: SheetObjectIndexEntry[]
}

/** Selection origin within the workbench. */
export type SelectionSource = 'abc-editor' | 'score-preview' | 'harp-preview' | 'player' | 'command'

/** Shared projection identities understood by the workbench selection manager. */
export type SelectionProjectionKind = 'textRange' | 'znId' | 'confKey'

/** Logical workbench target that can consume or create selection projections. */
export type SelectionTarget = 'abc-editor' | 'score-preview' | 'harp-preview' | 'player'

/** Voice-scoping strategy for cross-view selection. */
export type SelectionVoiceScope = 'single-voice' | 'extract-voices' | 'all-voices'

/** Capability profile declared by a workbench target. */
export interface SelectionTargetCapabilities {
  /** Projection kinds the target can read for highlighting. */
  reads: SelectionProjectionKind[]
  /** Projection kinds the target can create from direct interaction. */
  writes: SelectionProjectionKind[]
}

export interface SelectionState {
  /** Selected index entries within the current render-generation-local sheet object index. */
  selectedIndexes: number[]
  /** Stable base selection before voice-scope expansion is applied. */
  baseSelectedIndexes: number[]
  /** Anchor index for range extension, if applicable. */
  anchorIndex?: number
  /** Where the selection originated from. */
  source: SelectionSource
  /** Voice scope used when projecting or expanding the current selection. */
  voiceScope: SelectionVoiceScope
}

/** Projection resolved from the current selection state. */
export interface SelectionProjection {
  /** Selected index entries within the current render-generation-local sheet object index. */
  selectedIndexes: number[]
  /** Addressable text ranges that the target may render. */
  textRanges: SelectionTextRange[]
  /** Addressable Zupfnoter ids that the target may render. */
  znIds: string[]
  /** Addressable configuration keys that the target may render. */
  confKeys: string[]
}

/** Optional projection controls resolved by the selection manager. */
export interface SelectionProjectionOptions {
  /** Optional override for the voice scope of the projected selection. */
  voiceScope?: SelectionVoiceScope
  /** Active extract voice ids when the selection should follow the current extract. */
  activeVoiceIds?: string[]
}
