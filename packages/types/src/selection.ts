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
  /** Stable ordinal among score hitboxes with the same text range, if applicable. */
  scoreHitboxOrdinal?: number
  /** abc2svg annotation type of a classical-score hitbox, for example `bar`. */
  scoreObjectType?: string
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
  /** Sorted music times for efficient segment projection. */
  musicTimes?: number[]
  /** Ordered entries for range-based lookups. */
  entries: SheetObjectIndexEntry[]
}

/** Selection origin within the workbench. */
export type SelectionSource = 'abc-editor' | 'score-preview' | 'harp-preview' | 'config-editor' | 'player' | 'command'

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

/** Ein unabhängig erweiterbarer Bereich innerhalb einer Mehrfachselektion. */
export interface SelectionSegment {
  /** Renderlokale Indexeinträge dieses Bereichs. */
  selectedIndexes: number[]
  /** Nicht durch den Stimmumfang erweiterte Indexeinträge dieses Bereichs. */
  originSelectedIndexes: number[]
  /** Fester Ausgangspunkt für nachfolgende Shift-Klicks dieses Bereichs. */
  anchorIndex?: number
  /** Getrennte ABC-Teilbereiche dieses Segments. */
  textRanges?: SelectionTextRange[]
}

export interface SelectionState {
  /** Selected index entries within the current render-generation-local sheet object index. */
  selectedIndexes: number[]
  /** Stable origin selection before voice-scope expansion is applied. */
  originSelectedIndexes: number[]
  /** Anchor index for range extension, if applicable. */
  anchorIndex?: number
  /** Where the selection originated from. */
  source: SelectionSource
  /** Voice scope used when projecting or expanding the current selection. */
  voiceScope: SelectionVoiceScope
  /** Separate ABC ranges that make up the selection, when it is disjoint. */
  textRanges?: SelectionTextRange[]
  /** Unabhängig erweiterbare Bereiche der aktuellen Mehrfachselektion. */
  segments?: SelectionSegment[]
  /** Index des Bereichs, den der nächste Shift-Klick erweitert. */
  activeSegmentIndex?: number
  /** True while a preview pointer gesture is not yet committed. */
  interactionPending?: boolean
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

/** Fachliche Ursprungsidentität einer Selektion aus einer Projektion. */
export interface SelectionOrigin {
  /** 1-basierte Stimm-ID der geklickten musikalischen Entity, wenn bekannt. */
  voiceId?: string
  /** Musikalische Zeitposition der geklickten Entity, wenn bekannt. */
  musicTime?: number
  /** Zupfnoter-ID der geklickten musikalischen Entity, wenn bekannt. */
  znId?: string
}

/** Fachliche Zustandsübergänge rund um die zentrale Selection. */
export type SelectionEvent =
  | {
    /** Eine Preview-Auswahlgeste wurde begonnen oder beendet. */
    type: 'selection.interaction-pending'
    pending: boolean
  }
  | {
    /** In einer Vorschau wurde ohne adressierbares Objekt auf den Hintergrund geklickt. */
    type: 'selection.preview-background-clicked'
    source: 'score-preview' | 'harp-preview'
  }
  | {
    /** Benutzer- oder Systemselektion wurde vollständig ersetzt. */
    type: 'selection.replaced'
    selection: SelectionState
  }
  | {
    /** Selektion wurde direkt über Indexeinträge adressiert. */
    type: 'selection.indexes-selected'
    selectedIndexes: number[]
    source?: SelectionSource
  }
  | {
    /** Mehrere getrennte ABC-Bereiche wurden gemeinsam selektiert. */
    type: 'selection.text-ranges-selected'
    ranges: SelectionTextRange[]
    source?: SelectionSource
  }
  | {
    /** Selektion wurde über einen Textbereich adressiert. */
    type: 'selection.text-range-selected'
    startpos: number
    endpos: number
    origin?: SelectionOrigin
    extend?: boolean
    startNewSegment?: boolean
    source?: SelectionSource
  }
  | {
    /** Selektion wurde über Zeile und Spalte adressiert. */
    type: 'selection.line-column-range-selected'
    start: SelectionLineColumn
    end: SelectionLineColumn
    origin?: SelectionOrigin
    extend?: boolean
    source?: SelectionSource
  }
  | {
    /** Selektion wurde über eine musikalische Kennung adressiert. */
    type: 'selection.znid-selected'
    znId: string
    source?: SelectionSource
  }
  | {
    /** Selektion wurde über eine musikalische Materialmenge adressiert. */
    type: 'selection.music-range-selected'
    znIds: string[]
    source?: SelectionSource
  }
  | {
    /** Selektion wurde über einen Konfigurationsschlüssel adressiert. */
    type: 'selection.confkey-selected'
    confKey: string
    source?: SelectionSource
  }
  | {
    /** Eine neue leere Partitur oder ein neues Stück wurde geladen. */
    type: 'selection.song-loaded'
    source?: SelectionSource
    voiceScope?: SelectionVoiceScope
  }
  | {
    /** Der Stimmumfang der bestehenden Selection wurde geändert. */
    type: 'selection.scope-changed'
    voiceScope: SelectionVoiceScope
  }
  | {
    /** Die aktiven Stimmen des aktuellen Auszugs wurden geändert. */
    type: 'selection.extract-changed'
    activeVoiceIds: string[]
  }
  | {
    /** Ein neuer renderlokaler Selection-Index wurde erzeugt. */
    type: 'selection.render-refreshed'
    nextIndex?: SheetObjectIndex
  }
