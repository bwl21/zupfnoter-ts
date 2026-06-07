import type {
  PlaybackHighlight,
  SelectionIndex,
  SelectionIndexEntry,
  SelectionLineColumn,
  SelectionTextRange,
  Song,
  VoiceEntity,
} from '@zupfnoter/types'

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

function cloneEntry(entry: SelectionIndexEntry): SelectionIndexEntry {
  return {
    znId: entry.znId,
    textRange: { ...entry.textRange },
    startPos: cloneLineColumn(entry.startPos),
    endPos: cloneLineColumn(entry.endPos),
    confKey: entry.confKey,
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

function compareLineColumn(left: SelectionLineColumn, right: SelectionLineColumn): number {
  if (left.line !== right.line) return left.line - right.line
  return left.column - right.column
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

function createEntryFromVoiceEntity(entity: VoiceEntity): SelectionIndexEntry | undefined {
  const sourceOffsets = entity.sourceOffsets
  if (sourceOffsets === undefined) return undefined

  return {
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
  }
}

export function buildSelectionIndexFromSong(song: Song, abcText: string): SelectionIndex {
  const byZnId: Record<string, SelectionIndexEntry> = {}
  const entries: SelectionIndexEntry[] = []

  for (const voice of song.voices) {
    for (const entity of voice.entities) {
      const entry = createEntryFromVoiceEntity(entity)
      if (entry === undefined) continue

      const clonedEntry = cloneEntry(entry)
      entries.push(clonedEntry)

      if (clonedEntry.znId !== undefined && clonedEntry.znId.length > 0) {
        byZnId[clonedEntry.znId] = clonedEntry
      }
    }
  }

  entries.sort((left, right) => {
    if (left.textRange.startpos !== right.textRange.startpos) {
      return left.textRange.startpos - right.textRange.startpos
    }
    return left.textRange.endpos - right.textRange.endpos
  })

  return {
    lineStarts: createLineStarts(abcText),
    byZnId,
    entries,
  }
}

export function selectEntriesByTextRange(
  index: SelectionIndex | undefined,
  textRange: SelectionTextRange,
): SelectionIndexEntry[] {
  if (index === undefined) return []
  const normalized = normalizeTextRange(textRange.startpos, textRange.endpos)

  return index.entries
    .filter((entry) => entry.textRange.endpos >= normalized.startpos && entry.textRange.startpos <= normalized.endpos)
    .map(cloneEntry)
}

export function selectEntriesByLineColumnRange(
  index: SelectionIndex | undefined,
  range: { start: SelectionLineColumn; end: SelectionLineColumn },
): SelectionIndexEntry[] {
  if (index === undefined) return []
  const startOffset = lineColumnToCharOffset(index.lineStarts, range.start)
  const endOffset = lineColumnToCharOffset(index.lineStarts, range.end)
  if (startOffset === undefined || endOffset === undefined) return []
  return selectEntriesByTextRange(index, normalizeTextRange(startOffset, endOffset))
}

export function projectZnIdsToTextRange(
  index: SelectionIndex | undefined,
  znIds: string[],
): SelectionTextRange | undefined {
  if (index === undefined || znIds.length === 0) return undefined

  const entries = znIds
    .map((znId) => index.byZnId[znId])
    .filter((entry): entry is SelectionIndexEntry => entry !== undefined)

  if (entries.length === 0) return undefined

  return {
    startpos: Math.min(...entries.map((entry) => entry.textRange.startpos)),
    endpos: Math.max(...entries.map((entry) => entry.textRange.endpos)),
  }
}

export function projectTextRangeToZnIds(
  index: SelectionIndex | undefined,
  textRange: SelectionTextRange,
): string[] {
  return selectEntriesByTextRange(index, textRange)
    .map((entry) => entry.znId)
    .filter((znId): znId is string => znId !== undefined)
}

export function projectTextRangeToLineColumnRange(
  index: SelectionIndex | undefined,
  textRange: SelectionTextRange,
): { start: SelectionLineColumn; end: SelectionLineColumn } | undefined {
  if (index === undefined) return undefined
  return {
    start: charOffsetToLineColumn(index.lineStarts, textRange.startpos),
    end: charOffsetToLineColumn(index.lineStarts, textRange.endpos),
  }
}

export function projectLineColumnRangeToTextRange(
  index: SelectionIndex | undefined,
  range: { start: SelectionLineColumn; end: SelectionLineColumn },
): SelectionTextRange | undefined {
  if (index === undefined) return undefined
  const startOffset = lineColumnToCharOffset(index.lineStarts, range.start)
  const endOffset = lineColumnToCharOffset(index.lineStarts, range.end)
  if (startOffset === undefined || endOffset === undefined) return undefined
  return normalizeTextRange(startOffset, endOffset)
}

export function projectPlaybackHighlight(
  index: SelectionIndex | undefined,
  highlight: PlaybackHighlight | undefined,
): PlaybackHighlight {
  if (highlight === undefined) {
    return {
      activeZnIds: [],
    }
  }

  const projectedTextRange = projectZnIdsToTextRange(index, highlight.activeZnIds)

  return {
    ...highlight,
    activeZnIds: [...highlight.activeZnIds],
    activeStartChar: projectedTextRange?.startpos ?? highlight.activeStartChar,
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
