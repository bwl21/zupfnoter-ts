import type {
  DrawableElement,
  PlaybackHighlight,
  SelectionLineColumn,
  SelectionProjectionOptions,
  SelectionState,
  SelectionTextRange,
  Sheet,
  SheetObjectIndex,
  SheetObjectIndexEntry,
  Song,
  VoiceEntity,
} from '@zupfnoter/types'

type AddressablePane = 'editor' | 'score' | 'svg'
type TextRangeMatchMode = 'overlap' | 'exact' | 'contained'

let sheetObjectIndexVersion = 0

function normalizeTextRange(startpos: number, endpos: number): SelectionTextRange {
  return startpos <= endpos
    ? { startpos, endpos }
    : { startpos: endpos, endpos: startpos }
}

function cloneLineColumn(position: SelectionLineColumn): SelectionLineColumn {
  return {
    line: position.line,
    column: position.column,
  }
}

function cloneEntry(entry: SheetObjectIndexEntry): SheetObjectIndexEntry {
  return {
    kind: entry.kind,
    znId: entry.znId,
    textRange: entry.textRange === undefined ? undefined : { ...entry.textRange },
    startPos: entry.startPos === undefined ? undefined : cloneLineColumn(entry.startPos),
    endPos: entry.endPos === undefined ? undefined : cloneLineColumn(entry.endPos),
    confKey: entry.confKey,
    addressableIn: { ...entry.addressableIn },
  }
}

function createLineStarts(abcText: string): number[] {
  const starts = [0]
  for (let index = 0; index < abcText.length; index += 1) {
    if (abcText[index] === '\n') {
      starts.push(index + 1)
    }
  }
  return starts
}

function createVoiceByLine(abcText: string): Record<number, string | undefined> {
  const voiceByLine: Record<number, string | undefined> = {}
  const lines = abcText.split('\n')
  let activeVoice: string | undefined

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const match = line.match(/^\s*V:\s*([^\s%]+)/)
    if (match?.[1] !== undefined) {
      activeVoice = match[1]
    }
    voiceByLine[lineNumber] = activeVoice
  })

  return voiceByLine
}

function compareLineColumn(left: SelectionLineColumn, right: SelectionLineColumn): number {
  if (left.line !== right.line) return left.line - right.line
  return left.column - right.column
}

function canAddress(entry: SheetObjectIndexEntry, pane: AddressablePane): boolean {
  return entry.addressableIn[pane]
}

function createEntryDedupKey(entry: SheetObjectIndexEntry): string {
  const textRange = entry.textRange === undefined ? '-' : textRangeKey(entry.textRange)
  const startPos = entry.startPos === undefined ? '-' : `${entry.startPos.line}:${entry.startPos.column}`
  const endPos = entry.endPos === undefined ? '-' : `${entry.endPos.line}:${entry.endPos.column}`

  return [
    entry.kind,
    entry.znId ?? '-',
    entry.confKey ?? '-',
    textRange,
    startPos,
    endPos,
    entry.addressableIn.editor ? 'e' : '-',
    entry.addressableIn.score ? 's' : '-',
    entry.addressableIn.svg ? 'v' : '-',
  ].join('|')
}

function dedupeEntries(entries: SheetObjectIndexEntry[]): SheetObjectIndexEntry[] {
  const seen = new Set<string>()
  const result: SheetObjectIndexEntry[] = []

  for (const entry of entries) {
    const key = createEntryDedupKey(entry)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(entry)
  }

  return result
}

function dedupeIndexes(indexes: number[]): number[] {
  return [...new Set(indexes)].sort((left, right) => left - right)
}

export function textRangeKey(textRange: SelectionTextRange): string {
  return `${textRange.startpos}:${textRange.endpos}`
}

function parseVoiceIdFromConfKey(confKey: string | undefined): string | undefined {
  if (confKey === undefined) return undefined
  const match = confKey.match(/(?:^|[.])v_(\d+)(?:[._]|$)/)
  return match?.[1]
}

function resolveEntryVoiceId(entry: SheetObjectIndexEntry): string | undefined {
  return parseVoiceIdFromConfKey(entry.confKey)
}

function lineRangeOverlapsEntry(
  entry: SheetObjectIndexEntry,
  startLine: number,
  endLine: number,
): boolean {
  if (entry.startPos === undefined || entry.endPos === undefined) return false
  return entry.endPos.line >= startLine && entry.startPos.line <= endLine
}

export function lineColumnToCharOffset(
  lineStarts: number[],
  position: SelectionLineColumn,
): number | undefined {
  if (position.line < 1 || position.line > lineStarts.length) return undefined
  const lineStart = lineStarts[position.line - 1]
  if (lineStart === undefined) return undefined
  return Math.max(0, lineStart + position.column - 1)
}

export function charOffsetToLineColumn(
  lineStarts: number[],
  offset: number,
): SelectionLineColumn {
  const normalizedOffset = Math.max(0, offset)
  let lineIndex = 0

  for (let index = 1; index < lineStarts.length; index += 1) {
    const nextStart = lineStarts[index]
    if (nextStart === undefined || nextStart > normalizedOffset) {
      break
    }
    lineIndex = index
  }

  const lineStart = lineStarts[lineIndex] ?? 0
  return {
    line: lineIndex + 1,
    column: normalizedOffset - lineStart + 1,
  }
}

function createSongEntryFromVoiceEntity(entity: VoiceEntity): SheetObjectIndexEntry | undefined {
  const sourceOffsets = entity.sourceOffsets
  if (sourceOffsets === undefined) return undefined

  return {
    kind: 'music-entity',
    znId: entity.znId,
    textRange: normalizeTextRange(sourceOffsets[0], sourceOffsets[1]),
    startPos: {
      line: entity.startPos[0],
      column: entity.startPos[1],
    },
    endPos: {
      line: entity.endPos[0],
      column: entity.endPos[1],
    },
    confKey: entity.confKey,
    addressableIn: {
      editor: true,
      score: true,
      svg: true,
    },
  }
}

function createSheetEntryFromDrawable(drawable: DrawableElement): SheetObjectIndexEntry | undefined {
  if (drawable.znId === undefined && drawable.confKey === undefined) return undefined

  return {
    kind: 'sheet-object',
    znId: drawable.znId,
    confKey: drawable.confKey,
    addressableIn: {
      editor: false,
      score: false,
      svg: true,
    },
  }
}

function parseScoreEntriesFromSvg(scoreSvg: string, lineStarts: number[]): SheetObjectIndexEntry[] {
  const entries: SheetObjectIndexEntry[] = []
  const pattern = /data-start-char="(\d+)"\s+data-end-char="(\d+)"/g

  for (const match of scoreSvg.matchAll(pattern)) {
    const startpos = Number(match[1])
    const endpos = Number(match[2])
    if (Number.isNaN(startpos) || Number.isNaN(endpos)) continue
    const textRange = normalizeTextRange(startpos, endpos)
    entries.push({
      kind: 'score-object',
      textRange,
      startPos: charOffsetToLineColumn(lineStarts, textRange.startpos),
      endPos: charOffsetToLineColumn(lineStarts, textRange.endpos),
      addressableIn: {
        editor: true,
        score: true,
        svg: false,
      },
    })
  }

  return dedupeEntries(entries)
}

export function buildSheetObjectIndex(
  song: Song,
  sheet: Sheet,
  abcText: string,
  scoreSvg: string,
): SheetObjectIndex {
  const lineStarts = createLineStarts(abcText)
  const voiceByLine = createVoiceByLine(abcText)
  const entries: SheetObjectIndexEntry[] = [
    ...parseScoreEntriesFromSvg(scoreSvg, lineStarts),
    ...song.voices.flatMap((voice) => voice.entities.map(createSongEntryFromVoiceEntity).filter((entry): entry is SheetObjectIndexEntry => entry !== undefined)),
    ...sheet.children.map(createSheetEntryFromDrawable).filter((entry): entry is SheetObjectIndexEntry => entry !== undefined),
  ]

  const dedupedEntries = dedupeEntries(entries)
  const byZnId: Record<string, number[]> = {}
  const byConfKey: Record<string, number[]> = {}
  const byTextRange: Record<string, number[]> = {}

  dedupedEntries.forEach((entry, index) => {
    if (entry.znId !== undefined && entry.znId.length > 0) {
      byZnId[entry.znId] ??= []
      byZnId[entry.znId]?.push(index)
    }
    if (entry.confKey !== undefined && entry.confKey.length > 0) {
      byConfKey[entry.confKey] ??= []
      byConfKey[entry.confKey]?.push(index)
    }
    if (entry.textRange !== undefined) {
      const key = textRangeKey(entry.textRange)
      byTextRange[key] ??= []
      byTextRange[key]?.push(index)
    }
  })

  return {
    version: ++sheetObjectIndexVersion,
    lineStarts,
    voiceByLine,
    byZnId,
    byConfKey,
    byTextRange,
    entries: dedupedEntries,
  }
}

export function normalizeLineColumnRange(
  start: SelectionLineColumn,
  end: SelectionLineColumn,
): { start: SelectionLineColumn; end: SelectionLineColumn } {
  if (compareLineColumn(start, end) <= 0) {
    return {
      start: cloneLineColumn(start),
      end: cloneLineColumn(end),
    }
  }

  return {
    start: cloneLineColumn(end),
    end: cloneLineColumn(start),
  }
}

function rangeMatches(entryRange: SelectionTextRange, selectionRange: SelectionTextRange, mode: TextRangeMatchMode): boolean {
  if (mode === 'exact') {
    return entryRange.startpos === selectionRange.startpos && entryRange.endpos === selectionRange.endpos
  }
  if (mode === 'contained') {
    return entryRange.startpos >= selectionRange.startpos && entryRange.endpos <= selectionRange.endpos
  }
  return entryRange.endpos > selectionRange.startpos && entryRange.startpos < selectionRange.endpos
}

export function resolveIndexesByTextRange(
  index: SheetObjectIndex | undefined,
  textRange: SelectionTextRange,
  pane?: AddressablePane,
  mode: TextRangeMatchMode = 'overlap',
): number[] {
  if (index === undefined) return []
  const normalized = normalizeTextRange(textRange.startpos, textRange.endpos)

  if (mode === 'exact') {
    const direct = index.byTextRange[textRangeKey(normalized)] ?? []
    return direct.filter((entryIndex: number) => {
      const entry = index.entries[entryIndex]
      return entry !== undefined && (pane === undefined || canAddress(entry, pane))
    })
  }

  return index.entries
    .map((entry: SheetObjectIndexEntry, entryIndex: number) => ({ entry, entryIndex }))
    .filter(({ entry }: { entry: SheetObjectIndexEntry; entryIndex: number }) => entry.textRange !== undefined)
    .filter(({ entry }: { entry: SheetObjectIndexEntry; entryIndex: number }) => rangeMatches(entry.textRange as SelectionTextRange, normalized, mode))
    .filter(({ entry }: { entry: SheetObjectIndexEntry; entryIndex: number }) => pane === undefined || canAddress(entry, pane))
    .map(({ entryIndex }: { entry: SheetObjectIndexEntry; entryIndex: number }) => entryIndex)
}

export function resolveIndexesByTextRangeAndKind(
  index: SheetObjectIndex | undefined,
  textRange: SelectionTextRange,
  kind: SheetObjectIndexEntry['kind'],
  pane?: AddressablePane,
  mode: TextRangeMatchMode = 'overlap',
): number[] {
  return resolveIndexesByTextRange(index, textRange, pane, mode).filter((entryIndex: number) => {
    const entry = index?.entries[entryIndex]
    return entry?.kind === kind
  })
}

export function resolveIndexesByZnId(
  index: SheetObjectIndex | undefined,
  znId: string,
  pane?: AddressablePane,
): number[] {
  if (index === undefined) return []
  return (index.byZnId[znId] ?? []).filter((entryIndex: number) => {
    const entry = index.entries[entryIndex]
    return entry !== undefined && (pane === undefined || canAddress(entry, pane))
  })
}

export function resolveIndexesByConfKey(
  index: SheetObjectIndex | undefined,
  confKey: string,
  pane?: AddressablePane,
): number[] {
  if (index === undefined) return []
  return (index.byConfKey[confKey] ?? []).filter((entryIndex: number) => {
    const entry = index.entries[entryIndex]
    return entry !== undefined && (pane === undefined || canAddress(entry, pane))
  })
}

export function projectIndexesToEntries(
  index: SheetObjectIndex | undefined,
  selectedIndexes: number[],
): SheetObjectIndexEntry[] {
  if (index === undefined || selectedIndexes.length === 0) return []

  return dedupeEntries(
    dedupeIndexes(selectedIndexes)
      .map((entryIndex) => index.entries[entryIndex])
      .filter((entry): entry is SheetObjectIndexEntry => entry !== undefined)
      .map(cloneEntry),
  )
}

export function resolveEditorSelectionRange(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
): SelectionTextRange | undefined {
  const textRanges = projectIndexesToEntries(index, selection.selectedIndexes)
    .filter((entry) => entry.addressableIn.editor && entry.textRange !== undefined)
    .map((entry) => entry.textRange as SelectionTextRange)

  if (textRanges.length === 0) return undefined

  return {
    startpos: Math.min(...textRanges.map((range) => range.startpos)),
    endpos: Math.max(...textRanges.map((range) => range.endpos)),
  }
}

export function resolveScoreSelectionRanges(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
): SelectionTextRange[] {
  return [...new Map(
    projectIndexesToEntries(index, selection.selectedIndexes)
      .filter((entry) => entry.addressableIn.score && entry.textRange !== undefined)
      .map((entry) => {
        const textRange = entry.textRange as SelectionTextRange
        return [textRangeKey(textRange), { ...textRange }]
      }),
  ).values()]
}

export function resolveSvgSelection(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  options?: SelectionProjectionOptions,
): {
  znIds: string[]
  confKeys: string[]
  textRanges: SelectionTextRange[]
} {
  const selectedEntries = projectIndexesToEntries(index, selection.selectedIndexes)
  const selectedTextRanges = [...new Map(
    selectedEntries
      .filter((entry) => entry.textRange !== undefined)
      .map((entry) => {
        const textRange = entry.textRange as SelectionTextRange
        return [textRangeKey(textRange), { ...textRange }]
      }),
  ).values()]
  const selectedStartLine = selectedEntries
    .map((entry) => entry.startPos?.line)
    .filter((line): line is number => line !== undefined)
  const selectedEndLine = selectedEntries
    .map((entry) => entry.endPos?.line)
    .filter((line): line is number => line !== undefined)
  const voiceScope = options?.voiceScope ?? selection.voiceScope
  const editorSelectionLineWindow = selection.source === 'abc-editor'
    && voiceScope === 'single-voice'
    && selectedStartLine.length > 0
    && selectedEndLine.length > 0
    ? {
      startLine: Math.min(...selectedStartLine),
      endLine: Math.max(...selectedEndLine),
    }
    : undefined
  const selectedVoiceId = editorSelectionLineWindow === undefined
    ? undefined
    : index?.voiceByLine[editorSelectionLineWindow.startLine]
  const activeVoiceIds = options?.activeVoiceIds ?? []
  const allowedVoiceIds = voiceScope === 'extract-voices'
    ? new Set(activeVoiceIds)
    : undefined
  const shouldExpandByZnId = voiceScope !== 'single-voice'

  const textResolvedEntries = dedupeEntries(
    selectedTextRanges.flatMap((textRange) => {
      const exactIndexes = resolveIndexesByTextRange(index, textRange, 'svg', 'exact')
      if (exactIndexes.length > 0) {
        return projectIndexesToEntries(index, exactIndexes)
      }

      const containedIndexes = resolveIndexesByTextRange(index, textRange, 'svg', 'contained')
      if (containedIndexes.length > 0) {
        return projectIndexesToEntries(index, containedIndexes)
      }

      return projectIndexesToEntries(
        index,
        resolveIndexesByTextRange(index, textRange, 'svg', 'overlap'),
      )
    }),
  ).filter((entry) => {
    if (editorSelectionLineWindow === undefined) return true
    return lineRangeOverlapsEntry(entry, editorSelectionLineWindow.startLine, editorSelectionLineWindow.endLine)
  })
  const znIdExpandedEntries = shouldExpandByZnId
    ? dedupeEntries(
        [...selectedEntries, ...textResolvedEntries]
          .map((entry) => entry.znId)
          .filter((znId): znId is string => znId !== undefined)
          .flatMap((znId) => projectIndexesToEntries(index, resolveIndexesByZnId(index, znId, 'svg'))),
      )
    : []

  const entries = dedupeEntries(
    [...selectedEntries, ...textResolvedEntries, ...znIdExpandedEntries]
      .filter((entry) => entry.addressableIn.svg),
  ).filter((entry) => {
    if (allowedVoiceIds === undefined || allowedVoiceIds.size === 0) return true
    const entryVoiceId = resolveEntryVoiceId(entry)
    return entryVoiceId === undefined || allowedVoiceIds.has(entryVoiceId)
  })
  const editorOrScoreDriven = selection.source === 'abc-editor' || selection.source === 'score-preview'
  const confKeys = [...new Set(entries.map((entry) => entry.confKey).filter((confKey): confKey is string => confKey !== undefined))]
    .filter((confKey) => {
      if (allowedVoiceIds !== undefined && allowedVoiceIds.size > 0) {
        const voiceId = parseVoiceIdFromConfKey(confKey)
        return voiceId === undefined || allowedVoiceIds.has(voiceId)
      }
      if (!editorOrScoreDriven || selectedVoiceId === undefined) return true
      const voiceId = parseVoiceIdFromConfKey(confKey)
      return voiceId === undefined || voiceId === selectedVoiceId
    })

  return {
    znIds: editorOrScoreDriven
      ? []
      : [...new Set(entries.map((entry) => entry.znId).filter((znId): znId is string => znId !== undefined))],
    confKeys,
    textRanges: [...new Map(
      entries
        .filter((entry) => entry.textRange !== undefined)
        .map((entry) => {
          const textRange = entry.textRange as SelectionTextRange
          return [textRangeKey(textRange), { ...textRange }]
        }),
    ).values()],
  }
}

export function resolveSelectedZnIds(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
): string[] {
  return resolveSvgSelection(index, selection).znIds
}

export function projectTextRangeToLineColumnRange(
  index: SheetObjectIndex | undefined,
  textRange: SelectionTextRange,
): { start: SelectionLineColumn; end: SelectionLineColumn } | undefined {
  if (index === undefined) return undefined
  return {
    start: charOffsetToLineColumn(index.lineStarts, textRange.startpos),
    end: charOffsetToLineColumn(index.lineStarts, textRange.endpos),
  }
}

export function projectLineColumnRangeToTextRange(
  index: SheetObjectIndex | undefined,
  range: { start: SelectionLineColumn; end: SelectionLineColumn },
): SelectionTextRange | undefined {
  if (index === undefined) return undefined
  const startOffset = lineColumnToCharOffset(index.lineStarts, range.start)
  const endOffset = lineColumnToCharOffset(index.lineStarts, range.end)
  if (startOffset === undefined || endOffset === undefined) return undefined
  return normalizeTextRange(startOffset, endOffset)
}

export function projectPlaybackHighlight(
  index: SheetObjectIndex | undefined,
  highlight: PlaybackHighlight | undefined,
): PlaybackHighlight {
  void index
  if (highlight === undefined) {
    return {
      activeTextRanges: [],
    }
  }

  return {
    ...highlight,
    activeTextRanges: [...new Map(
      highlight.activeTextRanges.map((tr) => [textRangeKey(tr), { ...tr }]),
    ).values()],
  }
}
