import type {
  DrawableElement,
  PlaybackHighlight,
  SelectionOrigin,
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

import { isUserVisibleVoice, resolveUserVisibleVoiceId } from './songVoiceIdentity'

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
    scoreHitboxOrdinal: entry.scoreHitboxOrdinal,
    znId: entry.znId,
    voiceId: entry.voiceId,
    musicTime: entry.musicTime,
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
    entry.voiceId ?? '-',
    entry.musicTime ?? '-',
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

export function buildPlaybackIdentity(voiceId: string | undefined, znId: string): string {
  return `${voiceId ?? '?'}::${znId}`
}

function resolveEntryVoiceId(entry: SheetObjectIndexEntry | undefined): string | undefined {
  if (entry === undefined) return undefined
  if (entry.voiceId !== undefined) return entry.voiceId
  return parseVoiceIdFromConfKey(entry.confKey)
}

function buildSelectionOrigin(entry: SheetObjectIndexEntry | undefined): SelectionOrigin | undefined {
  if (entry === undefined) return undefined

  const origin: SelectionOrigin = {}
  if (entry.voiceId !== undefined && entry.voiceId.length > 0) {
    origin.voiceId = entry.voiceId
  }
  if (typeof entry.musicTime === 'number') {
    origin.musicTime = entry.musicTime
  }
  if (entry.znId !== undefined && entry.znId.length > 0) {
    origin.znId = entry.znId
  }

  return origin.voiceId !== undefined || origin.musicTime !== undefined || origin.znId !== undefined
    ? origin
    : undefined
}

function resolveEntryVoiceIdFromIndex(
  index: SheetObjectIndex | undefined,
  entry: SheetObjectIndexEntry | undefined,
): string | undefined {
  const confVoiceId = resolveEntryVoiceId(entry)
  if (confVoiceId !== undefined) return confVoiceId
  if (entry === undefined) return undefined
  const line = entry.startPos?.line
  if (line === undefined || index === undefined) return undefined
  return index.voiceByLine[line]
}

function resolveScopedSelectionContext(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  options?: SelectionProjectionOptions,
): {
  selectedEntries: SheetObjectIndexEntry[]
  selectedTextRanges: SelectionTextRange[]
  voiceScope: NonNullable<SelectionProjectionOptions['voiceScope']> | SelectionState['voiceScope']
  allowedVoiceIds?: Set<string>
  editorSelectionLineWindow?: { startLine: number; endLine: number }
  selectedVoiceId?: string
  selectedMusicTimes: number[]
  shouldExpandByMusicTime: boolean
  shouldExpandByZnId: boolean
} {
  const selectedEntries = projectIndexesToEntries(index, selection.selectedIndexes)
  const anchorEntries = selection.anchorIndex === undefined
    ? []
    : projectIndexesToEntries(index, [selection.anchorIndex])
  const anchorEntry = anchorEntries[0]
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
  const semanticSelectedEntries = dedupeEntries([
    ...selectedEntries,
    ...resolveMusicEntriesFromTextRanges(index, selectedTextRanges),
  ])
  const selectedVoiceSourceEntry = anchorEntry ?? selectedEntries[0]
  const selectedVoiceSemanticEntry = semanticSelectedEntries.find((entry) => resolveEntryVoiceIdFromIndex(index, entry) !== undefined)
  const selectedVoiceId = selectedVoiceSourceEntry === undefined
    ? undefined
    : resolveEntryVoiceIdFromIndex(index, selectedVoiceSemanticEntry ?? selectedVoiceSourceEntry)
  const activeVoiceIds = options?.activeVoiceIds ?? []
  const allowedVoiceIds = voiceScope === 'extract-voices'
    ? new Set(activeVoiceIds)
    : undefined
  const selectedMusicTimes = [...new Set(
    semanticSelectedEntries
      .map((entry) => entry.musicTime)
      .filter((musicTime): musicTime is number => typeof musicTime === 'number'),
  )]

  return {
    selectedEntries,
    selectedTextRanges,
    voiceScope,
    allowedVoiceIds,
    editorSelectionLineWindow,
    selectedVoiceId,
    selectedMusicTimes,
    shouldExpandByMusicTime: voiceScope !== 'single-voice',
    shouldExpandByZnId: voiceScope !== 'single-voice',
  }
}

function filterEntriesBySelectedVoice(
  index: SheetObjectIndex | undefined,
  entries: SheetObjectIndexEntry[],
  selectedVoiceId: string | undefined,
): SheetObjectIndexEntry[] {
  if (selectedVoiceId === undefined) return entries

  return entries.filter((entry) => {
    const voiceId = resolveEntryVoiceIdFromIndex(index, entry)
    return voiceId === undefined || voiceId === selectedVoiceId
  })
}

function filterEntriesByVoiceScope(
  index: SheetObjectIndex | undefined,
  entries: SheetObjectIndexEntry[],
  allowedVoiceIds?: Set<string>,
): SheetObjectIndexEntry[] {
  return entries.filter((entry) => {
    if (allowedVoiceIds === undefined || allowedVoiceIds.size === 0) return true
    const voiceId = resolveEntryVoiceIdFromIndex(index, entry)
    return voiceId === undefined || allowedVoiceIds.has(voiceId)
  })
}

function resolvePaneEntriesFromTextRanges(
  index: SheetObjectIndex | undefined,
  textRanges: SelectionTextRange[],
  pane: AddressablePane,
): SheetObjectIndexEntry[] {
  return dedupeEntries(
    textRanges.flatMap((textRange) => {
      const exactIndexes = resolveIndexesByTextRange(index, textRange, pane, 'exact')
      if (exactIndexes.length > 0) {
        return projectIndexesToEntries(index, exactIndexes)
      }

      const containedIndexes = resolveIndexesByTextRange(index, textRange, pane, 'contained')
      if (containedIndexes.length > 0) {
        return projectIndexesToEntries(index, containedIndexes)
      }

      return projectIndexesToEntries(
        index,
        resolveIndexesByTextRange(index, textRange, pane, 'overlap'),
      )
    }),
  )
}

function resolveMusicEntriesFromTextRanges(
  index: SheetObjectIndex | undefined,
  textRanges: SelectionTextRange[],
): SheetObjectIndexEntry[] {
  return dedupeEntries(
    textRanges.flatMap((textRange) => {
      const exactIndexes = resolveIndexesByTextRangeAndKind(
        index,
        textRange,
        'music-entity',
        undefined,
        'exact',
      )
      if (exactIndexes.length > 0) {
        return projectIndexesToEntries(index, exactIndexes)
      }

      const containedIndexes = resolveIndexesByTextRangeAndKind(
        index,
        textRange,
        'music-entity',
        undefined,
        'contained',
      )
      if (containedIndexes.length > 0) {
        return projectIndexesToEntries(index, containedIndexes)
      }

      return projectIndexesToEntries(
        index,
        resolveIndexesByTextRangeAndKind(
          index,
          textRange,
          'music-entity',
          undefined,
          'overlap',
        ),
      )
    }),
  )
}

function resolveScopedPaneEntries(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  pane: AddressablePane,
  options?: SelectionProjectionOptions,
): {
  entries: SheetObjectIndexEntry[]
  selectedVoiceId?: string
  allowedVoiceIds?: Set<string>
} {
  const context = resolveScopedSelectionContext(index, selection, options)
  const textResolvedEntries = resolvePaneEntriesFromTextRanges(index, context.selectedTextRanges, pane)
    .filter((entry) => {
      if (context.editorSelectionLineWindow === undefined) return true
      return lineRangeOverlapsEntry(
        entry,
        context.editorSelectionLineWindow.startLine,
        context.editorSelectionLineWindow.endLine,
      )
    })
  const musicTimeExpandedEntries = context.shouldExpandByMusicTime
    ? dedupeEntries(
        [...context.selectedEntries, ...textResolvedEntries]
          .map((entry) => entry.musicTime)
          .filter((musicTime): musicTime is number => typeof musicTime === 'number')
          .flatMap((musicTime) => projectIndexesToEntries(index, resolveIndexesByMusicTime(index, musicTime, pane))),
      )
    : []
  const znIdExpandedEntries = context.shouldExpandByZnId
    ? dedupeEntries(
        [...context.selectedEntries, ...textResolvedEntries, ...musicTimeExpandedEntries]
          .map((entry) => entry.znId)
          .filter((znId): znId is string => znId !== undefined)
          .flatMap((znId) => projectIndexesToEntries(index, resolveIndexesByZnId(index, znId, pane))),
      )
    : []

  const entries = filterEntriesByVoiceScope(
    index,
    filterEntriesBySelectedVoice(
      index,
      dedupeEntries([
        ...context.selectedEntries,
        ...textResolvedEntries,
        ...musicTimeExpandedEntries,
        ...znIdExpandedEntries,
      ].filter((entry) => entry.addressableIn[pane])),
      context.voiceScope === 'single-voice' ? context.selectedVoiceId : undefined,
    ),
    context.allowedVoiceIds,
  )

  return {
    entries,
    selectedVoiceId: context.selectedVoiceId,
    allowedVoiceIds: context.allowedVoiceIds,
  }
}

export function resolveScopedSelectionIndexes(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  options?: SelectionProjectionOptions,
): number[] {
  const context = resolveScopedSelectionContext(index, selection, options)
  const textResolvedEntries = resolvePaneEntriesFromTextRanges(index, context.selectedTextRanges, 'editor')
    .filter((entry) => {
      if (context.editorSelectionLineWindow === undefined) return true
      return lineRangeOverlapsEntry(
        entry,
        context.editorSelectionLineWindow.startLine,
        context.editorSelectionLineWindow.endLine,
      )
    })
  const musicTimeExpandedEntries = context.shouldExpandByMusicTime
    ? dedupeEntries(
        [...context.selectedEntries, ...textResolvedEntries]
          .map((entry) => entry.musicTime)
          .filter((musicTime): musicTime is number => typeof musicTime === 'number')
          .flatMap((musicTime) => projectIndexesToEntries(index, resolveIndexesByMusicTime(index, musicTime))),
      )
    : []
  const znIdExpandedEntries = context.shouldExpandByZnId
    ? dedupeEntries(
        [...context.selectedEntries, ...textResolvedEntries, ...musicTimeExpandedEntries]
          .map((entry) => entry.znId)
          .filter((znId): znId is string => znId !== undefined)
          .flatMap((znId) => projectIndexesToEntries(index, resolveIndexesByZnId(index, znId))),
      )
    : []

  const entries = filterEntriesByVoiceScope(
    index,
    filterEntriesBySelectedVoice(
      index,
      dedupeEntries([
        ...context.selectedEntries,
        ...textResolvedEntries,
        ...musicTimeExpandedEntries,
        ...znIdExpandedEntries,
      ]),
      context.voiceScope === 'single-voice' ? context.selectedVoiceId : undefined,
    ),
    context.allowedVoiceIds,
  )

  return dedupeIndexes(
    entries.flatMap((entry) => {
      const exactIndexes = entry.textRange === undefined
        ? []
        : resolveIndexesByTextRange(index, entry.textRange, undefined, 'exact')
      if (exactIndexes.length > 0) return exactIndexes
      if (entry.znId !== undefined) return resolveIndexesByZnId(index, entry.znId)
      if (entry.confKey !== undefined) return resolveIndexesByConfKey(index, entry.confKey)
      return []
    }),
  )
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

function createSongEntryFromVoiceEntity(entity: VoiceEntity, voiceId: string): SheetObjectIndexEntry | undefined {
  const sourceOffsets = entity.sourceOffsets
  if (sourceOffsets === undefined) return undefined

  return {
    kind: 'music-entity',
    znId: entity.znId,
    voiceId,
    musicTime: entity.time,
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
  const ordinalsByTextRange = new Map<string, number>()

  for (const match of scoreSvg.matchAll(pattern)) {
    const startpos = Number(match[1])
    const endpos = Number(match[2])
    if (Number.isNaN(startpos) || Number.isNaN(endpos)) continue
    const textRange = normalizeTextRange(startpos, endpos)
    const rangeKey = textRangeKey(textRange)
    const nextOrdinal = ordinalsByTextRange.get(rangeKey) ?? 0
    ordinalsByTextRange.set(rangeKey, nextOrdinal + 1)
    entries.push({
      kind: 'score-object',
      scoreHitboxOrdinal: nextOrdinal,
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
    ...song.voices
      .filter(isUserVisibleVoice)
      .flatMap((voice) => voice.entities
      .map((entity) => createSongEntryFromVoiceEntity(entity, resolveUserVisibleVoiceId(voice) ?? ''))
      .filter((entry): entry is SheetObjectIndexEntry => entry !== undefined)),
    ...sheet.children.map(createSheetEntryFromDrawable).filter((entry): entry is SheetObjectIndexEntry => entry !== undefined),
  ]

  const dedupedEntries = dedupeEntries(entries)
  const byZnId: Record<string, number[]> = {}
  const byConfKey: Record<string, number[]> = {}
  const byTextRange: Record<string, number[]> = {}
  const byMusicTime: Record<string, number[]> = {}

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
    if (typeof entry.musicTime === 'number') {
      const key = `${entry.musicTime}`
      byMusicTime[key] ??= []
      byMusicTime[key]?.push(index)
    }
  })

  return {
    version: ++sheetObjectIndexVersion,
    lineStarts,
    voiceByLine,
    byZnId,
    byConfKey,
    byTextRange,
    byMusicTime,
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

export function resolveIndexesByMusicTime(
  index: SheetObjectIndex | undefined,
  musicTime: number,
  pane?: AddressablePane,
): number[] {
  if (index === undefined) return []
  return (index.byMusicTime[`${musicTime}`] ?? []).filter((entryIndex: number) => {
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

function confKeyAddressesConfigPath(confKey: string, configPath: string): boolean {
  if (confKey === configPath) return true

  for (const wildcard of ['.***', '.*']) {
    if (!confKey.endsWith(wildcard)) continue
    const base = confKey.slice(0, -wildcard.length)
    return configPath === base || configPath.startsWith(`${base}.`)
  }

  if (configPath.startsWith(`${confKey}.`)) return true

  const confKeyParent = confKey.slice(0, confKey.lastIndexOf('.'))
  const configPathParent = configPath.slice(0, configPath.lastIndexOf('.'))
  if (confKeyParent !== '' && confKeyParent === configPathParent) return true

  return false
}

export function resolveConfKeyForConfigPath(
  index: SheetObjectIndex | undefined,
  configPath: string,
): string | undefined {
  if (index === undefined) return undefined
  if (index.byConfKey[configPath] !== undefined) return configPath

  return Object.keys(index.byConfKey).find((confKey) => confKeyAddressesConfigPath(confKey, configPath))
}

export function resolveIndexesByConfigPath(
  index: SheetObjectIndex | undefined,
  configPath: string,
  pane?: AddressablePane,
): number[] {
  const confKey = resolveConfKeyForConfigPath(index, configPath)
  return confKey === undefined ? [] : resolveIndexesByConfKey(index, confKey, pane)
}

export function resolveSelectionOriginByTextRange(
  index: SheetObjectIndex | undefined,
  textRange: SelectionTextRange,
): SelectionOrigin | undefined {
  const exactIndexes = resolveIndexesByTextRangeAndKind(index, textRange, 'music-entity', undefined, 'exact')
  if (exactIndexes.length > 0) {
    const entryIndex = exactIndexes[0]
    return entryIndex === undefined ? undefined : buildSelectionOrigin(index?.entries[entryIndex])
  }

  const containedIndexes = resolveIndexesByTextRangeAndKind(index, textRange, 'music-entity', undefined, 'contained')
  if (containedIndexes.length > 0) {
    const entryIndex = containedIndexes[0]
    return entryIndex === undefined ? undefined : buildSelectionOrigin(index?.entries[entryIndex])
  }

  const overlapIndexes = resolveIndexesByTextRangeAndKind(index, textRange, 'music-entity', undefined, 'overlap')
  const entryIndex = overlapIndexes[0]
  return entryIndex === undefined ? undefined : buildSelectionOrigin(index?.entries[entryIndex])
}

export function resolveSelectionOriginByZnId(
  index: SheetObjectIndex | undefined,
  znId: string,
): SelectionOrigin | undefined {
  const entryIndex = resolveIndexesByZnId(index, znId).find((candidateIndex) => index?.entries[candidateIndex]?.kind === 'music-entity')
  return buildSelectionOrigin(entryIndex === undefined ? undefined : index?.entries[entryIndex])
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
  options?: SelectionProjectionOptions,
): SelectionTextRange[] {
  const { entries } = resolveScopedPaneEntries(index, selection, 'score', options)
  return [...new Map(
    entries
      .filter((entry) => entry.textRange !== undefined)
      .map((entry) => {
        const textRange = entry.textRange as SelectionTextRange
        return [textRangeKey(textRange), { ...textRange }]
      }),
  ).values()]
}

export function resolveScoreSelectionEntries(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  options?: SelectionProjectionOptions,
): SheetObjectIndexEntry[] {
  return resolveScopedPaneEntries(index, selection, 'score', options).entries
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
  const { entries, selectedVoiceId, allowedVoiceIds } = resolveScopedPaneEntries(index, selection, 'svg', options)
  const editorOrScoreDriven = selection.source === 'abc-editor' || selection.source === 'score-preview'
  const confKeys = [...new Set(entries.map((entry) => entry.confKey).filter((confKey): confKey is string => confKey !== undefined))]
    .filter((confKey) => {
      if (allowedVoiceIds !== undefined && allowedVoiceIds.size > 0) {
        const voiceId = parseVoiceIdFromConfKey(confKey)
        return voiceId === undefined || allowedVoiceIds.has(voiceId)
      }
      if (!editorOrScoreDriven || selection.voiceScope !== 'single-voice' || selectedVoiceId === undefined) return true
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
  const context = resolveScopedSelectionContext(index, selection)
  const directZnIds = [...new Set(
    context.selectedEntries
      .map((entry) => entry.znId)
      .filter((znId): znId is string => znId !== undefined),
  )]

  if (selection.source !== 'abc-editor' && selection.source !== 'score-preview' && directZnIds.length > 0) {
    return directZnIds
  }

  const { entries, selectedVoiceId, allowedVoiceIds } = resolveScopedPaneEntries(index, selection, 'svg')
  return [...new Set(
    entries
      .filter((entry) => {
        if (allowedVoiceIds !== undefined && allowedVoiceIds.size > 0) {
          const voiceId = resolveEntryVoiceIdFromIndex(index, entry)
          return voiceId === undefined || allowedVoiceIds.has(voiceId)
        }
        if (selection.voiceScope !== 'single-voice' || selectedVoiceId === undefined) return true
        const voiceId = resolveEntryVoiceIdFromIndex(index, entry)
        return voiceId === undefined || voiceId === selectedVoiceId
      })
      .map((entry) => entry.znId)
      .filter((znId): znId is string => znId !== undefined),
  )]
}

export function resolveSelectedPlaybackIds(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
): string[] {
  const { entries, selectedVoiceId, allowedVoiceIds } = resolveScopedPaneEntries(index, selection, 'svg')
  const shouldRestrictToSelectedVoice = selection.voiceScope === 'single-voice' && selectedVoiceId !== undefined
  return [...new Set(
    entries
      .filter((entry) => entry.znId !== undefined)
      .filter((entry) => {
        const voiceId = resolveEntryVoiceIdFromIndex(index, entry)
        if (allowedVoiceIds !== undefined && allowedVoiceIds.size > 0) {
          return voiceId === undefined || allowedVoiceIds.has(voiceId)
        }
        if (shouldRestrictToSelectedVoice) {
          return voiceId === undefined || voiceId === selectedVoiceId
        }
        return true
      })
      .map((entry) => buildPlaybackIdentity(resolveEntryVoiceIdFromIndex(index, entry), entry.znId as string)),
  )]
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
