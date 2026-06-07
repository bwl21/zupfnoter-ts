/**
 * Selection model for the shared workbench state.
 *
 * Selection remains transient UI state, but it is shared across views so that
 * editor, previews and commands can operate on the same focal object.
 */
export interface SelectionState {
  /** What kind of object is currently selected. */
  kind: 'none' | 'music-range' | 'abc-range' | 'abc-element' | 'config-object'
  /** Selected Zupfnoter IDs, if the selection is tied to music entities. */
  znIds: string[]
  /** Selected ABC text range [startpos, endpos], if applicable. */
  textRange?: { startpos: number; endpos: number }
  /** Start char for selections that are best addressed by a single position. */
  startChar?: number
  /** Selected config key, if the selection points at a config object. */
  confKey?: string
  /** ABC element kind, if the selection is tied to a specific parser node. */
  abcElementKind?: string
  /** Where the selection originated from. */
  source: 'abc-editor' | 'score-preview' | 'harp-preview' | 'player' | 'command'
}
