import type {
  PlaybackHighlight,
  SelectionLineColumn,
  SelectionEvent,
  SelectionOrigin,
  SelectionProjection,
  SelectionProjectionOptions,
  SelectionProjectionKind,
  SelectionState,
  SelectionSource,
  SelectionTarget,
  SelectionTargetCapabilities,
  SelectionTextRange,
  SelectionVoiceScope,
  SheetObjectIndex,
  SheetObjectIndexEntry,
} from '@zupfnoter/types'

import { textRangeKey } from './selectionIndex'

import {
  projectPlaybackHighlight,
  normalizeLineColumnRange,
  projectLineColumnRangeToTextRange,
  resolveEditorSelectionRange,
  resolveIndexesByConfKey,
  resolveIndexesByTextRange,
  resolveIndexesByTextRangeAndKind,
  resolveIndexesByZnId,
  resolveSelectionOriginByTextRange,
  resolveScoreSelectionEntries as resolveScoreSelectionEntriesFromIndex,
  resolveScoreSelectionRanges,
  resolveScopedSelectionIndexes,
  resolveSelectedZnIds,
  resolveSvgSelection,
} from './selectionIndex'

const DEFAULT_SELECTION_TARGET_CAPABILITIES: Record<SelectionTarget, SelectionTargetCapabilities> = {
  'abc-editor': {
    reads: ['textRange'],
    writes: ['textRange'],
  },
  'score-preview': {
    reads: ['textRange'],
    writes: ['textRange'],
  },
  'harp-preview': {
    reads: ['textRange', 'znId', 'confKey'],
    writes: ['textRange', 'znId', 'confKey'],
  },
  player: {
    reads: ['textRange', 'znId'],
    writes: [],
  },
}

const selectionTargetCapabilities = new Map<SelectionTarget, SelectionTargetCapabilities>()

for (const [target, capabilities] of Object.entries(DEFAULT_SELECTION_TARGET_CAPABILITIES) as Array<
  [SelectionTarget, SelectionTargetCapabilities]
>) {
  selectionTargetCapabilities.set(target, {
    reads: [...capabilities.reads],
    writes: [...capabilities.writes],
  })
}

function uniqueTextRanges(textRanges: SelectionTextRange[]): SelectionTextRange[] {
  const seen = new Set<string>()
  const result: SelectionTextRange[] = []

  for (const textRange of textRanges) {
    const key = textRangeKey(textRange)
    if (seen.has(key)) continue
    seen.add(key)
    result.push({
      startpos: textRange.startpos,
      endpos: textRange.endpos,
    })
  }

  return result
}

function normalizeIndexes(indexes: number[]): number[] {
  return [...new Set(indexes)].sort((left, right) => left - right)
}

function createSelectionState(
  selectedIndexes: number[],
  source: SelectionSource,
  voiceScope: SelectionVoiceScope = 'single-voice',
  originSelectedIndexes?: number[],
  anchorIndex?: number,
): SelectionState {
  const normalized = normalizeIndexes(selectedIndexes)
  const normalizedOrigin = normalizeIndexes(originSelectedIndexes ?? selectedIndexes)
  return {
    selectedIndexes: normalized,
    originSelectedIndexes: normalizedOrigin,
    anchorIndex: anchorIndex ?? normalized[0],
    source,
    voiceScope,
  }
}

function filterProjectionByCapability(
  projection: SelectionProjection,
  capability: SelectionTargetCapabilities,
): SelectionProjection {
  return {
    selectedIndexes: [...projection.selectedIndexes],
    textRanges: capability.reads.includes('textRange') ? uniqueTextRanges(projection.textRanges) : [],
    znIds: capability.reads.includes('znId') ? [...new Set(projection.znIds)] : [],
    confKeys: capability.reads.includes('confKey') ? [...new Set(projection.confKeys)] : [],
  }
}

export function registerSelectionTargetCapabilities(
  target: SelectionTarget,
  capabilities: SelectionTargetCapabilities,
): void {
  selectionTargetCapabilities.set(target, {
    reads: [...capabilities.reads],
    writes: [...capabilities.writes],
  })
}

export function getSelectionTargetCapabilities(
  target: SelectionTarget,
): SelectionTargetCapabilities {
  return selectionTargetCapabilities.get(target) ?? DEFAULT_SELECTION_TARGET_CAPABILITIES[target]
}

export function canTargetCreateSelection(
  target: SelectionTarget,
  kind: SelectionProjectionKind,
): boolean {
  return getSelectionTargetCapabilities(target).writes.includes(kind)
}

export function createReplacedSelectionEvent(selection: SelectionState): SelectionEvent {
  return {
    type: 'selection.replaced',
    selection,
  }
}

export function createIndexesSelectedSelectionEvent(
  selectedIndexes: number[],
  source: SelectionSource = 'command',
): SelectionEvent {
  return {
    type: 'selection.indexes-selected',
    selectedIndexes,
    source,
  }
}

export function createTextRangeSelectionEvent(
  startpos: number,
  endpos: number,
  source: SelectionSource = 'abc-editor',
  extend: boolean = false,
  origin?: SelectionOrigin,
): SelectionEvent {
  return {
    type: 'selection.text-range-selected',
    startpos,
    endpos,
    extend,
    origin,
    source,
  }
}

export function createLineColumnRangeSelectionEvent(
  start: SelectionLineColumn,
  end: SelectionLineColumn,
  source: SelectionSource = 'abc-editor',
  extend: boolean = false,
  origin?: SelectionOrigin,
): SelectionEvent {
  return {
    type: 'selection.line-column-range-selected',
    start,
    end,
    extend,
    origin,
    source,
  }
}

export function createZnIdSelectedSelectionEvent(
  znId: string,
  source: SelectionSource = 'command',
): SelectionEvent {
  return {
    type: 'selection.znid-selected',
    znId,
    source,
  }
}

export function createMusicRangeSelectedSelectionEvent(
  znIds: string[],
  source: SelectionSource = 'command',
): SelectionEvent {
  return {
    type: 'selection.music-range-selected',
    znIds,
    source,
  }
}

export function createConfKeySelectedSelectionEvent(
  confKey: string,
  source: SelectionSource = 'command',
): SelectionEvent {
  return {
    type: 'selection.confkey-selected',
    confKey,
    source,
  }
}

export function createSongLoadedSelectionEvent(
  source?: SelectionSource,
  voiceScope?: SelectionVoiceScope,
): SelectionEvent {
  return {
    type: 'selection.song-loaded',
    source,
    voiceScope,
  }
}

export function createScopeChangedSelectionEvent(
  voiceScope: SelectionVoiceScope,
): SelectionEvent {
  return {
    type: 'selection.scope-changed',
    voiceScope,
  }
}

export function createExtractChangedSelectionEvent(
  activeVoiceIds: string[],
): SelectionEvent {
  return {
    type: 'selection.extract-changed',
    activeVoiceIds,
  }
}

export function createRenderRefreshedSelectionEvent(
  nextIndex?: SheetObjectIndex,
): SelectionEvent {
  return {
    type: 'selection.render-refreshed',
    nextIndex,
  }
}

export function resolveSelectionByIndexes(
  selectedIndexes: number[],
  source: SelectionSource = 'command',
  voiceScope: SelectionVoiceScope = 'single-voice',
): SelectionState {
  return createSelectionState(selectedIndexes, source, voiceScope)
}

export function createClearedSelectionState(
  source: SelectionSource = 'command',
  voiceScope: SelectionVoiceScope = 'single-voice',
): SelectionState {
  return createSelectionState([], source, voiceScope)
}

export function resolveSelectionWithVoiceScope(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  voiceScope: SelectionVoiceScope,
  options?: SelectionProjectionOptions,
): SelectionState {
  if (voiceScope === 'single-voice') {
    return createSelectionState(
      selection.originSelectedIndexes,
      selection.source,
      voiceScope,
      selection.originSelectedIndexes,
    )
  }
  const originSelection = createSelectionState(
    selection.originSelectedIndexes,
    selection.source,
    selection.voiceScope,
    selection.originSelectedIndexes,
  )
  return createSelectionState(
    resolveScopedSelectionIndexes(index, {
      ...originSelection,
      voiceScope,
    }, {
      ...options,
      voiceScope,
    }),
    selection.source,
    voiceScope,
    selection.originSelectedIndexes,
  )
}

export function resolveSelectionByZnId(
  index: SheetObjectIndex | undefined,
  znId: string,
  source: SelectionSource = 'command',
  voiceScope: SelectionVoiceScope = 'single-voice',
): SelectionState {
  return createSelectionState(resolveIndexesByZnId(index, znId), source, voiceScope)
}

export function resolveSelectionByMusicRange(
  index: SheetObjectIndex | undefined,
  znIds: string[],
  source: SelectionSource = 'command',
  voiceScope: SelectionVoiceScope = 'single-voice',
): SelectionState {
  return createSelectionState(
    znIds.flatMap((znId) => resolveIndexesByZnId(index, znId)),
    source,
    voiceScope,
  )
}

export function resolveSelectionByConfKey(
  index: SheetObjectIndex | undefined,
  confKey: string,
  source: SelectionSource = 'command',
  voiceScope: SelectionVoiceScope = 'single-voice',
): SelectionState {
  return createSelectionState(resolveIndexesByConfKey(index, confKey), source, voiceScope)
}

export function resolveSelectionByTextRange(
  index: SheetObjectIndex | undefined,
  startpos: number,
  endpos: number,
  source: SelectionSource = 'abc-editor',
  voiceScope: SelectionVoiceScope = 'single-voice',
): SelectionState {
  const resolvedIndexes = source === 'score-preview'
    ? (() => {
        const exactScoreObjectIndexes = resolveIndexesByTextRangeAndKind(
          index,
          { startpos, endpos },
          'score-object',
          'score',
          'exact',
        )
        if (exactScoreObjectIndexes.length > 0) return exactScoreObjectIndexes

        const overlapScoreObjectIndexes = resolveIndexesByTextRangeAndKind(
          index,
          { startpos, endpos },
          'score-object',
          'score',
          'overlap',
        )
        if (overlapScoreObjectIndexes.length > 0) return overlapScoreObjectIndexes

        const exactIndexes = resolveIndexesByTextRange(index, { startpos, endpos }, undefined, 'exact')
        return exactIndexes.length > 0
          ? exactIndexes
          : resolveIndexesByTextRange(index, { startpos, endpos }, undefined, 'overlap')
      })()
    : source === 'abc-editor'
      ? (() => {
          const exactMusicEntityIndexes = resolveIndexesByTextRangeAndKind(
            index,
            { startpos, endpos },
            'music-entity',
            'editor',
            'exact',
          )
          if (exactMusicEntityIndexes.length > 0) return exactMusicEntityIndexes

          const containedMusicEntityIndexes = resolveIndexesByTextRangeAndKind(
            index,
            { startpos, endpos },
            'music-entity',
            'editor',
            'contained',
          )
          if (containedMusicEntityIndexes.length > 0) return containedMusicEntityIndexes

          const overlapMusicEntityIndexes = resolveIndexesByTextRangeAndKind(
            index,
            { startpos, endpos },
            'music-entity',
            'editor',
            'overlap',
          )
          if (overlapMusicEntityIndexes.length > 0) return overlapMusicEntityIndexes

          const overlapScoreObjectIndexes = resolveIndexesByTextRangeAndKind(
            index,
            { startpos, endpos },
            'score-object',
            'editor',
            'overlap',
          )
          return overlapScoreObjectIndexes.length > 0
            ? overlapScoreObjectIndexes
            : resolveIndexesByTextRange(index, { startpos, endpos }, undefined, 'overlap')
        })()
      : resolveIndexesByTextRange(index, { startpos, endpos }, undefined, 'overlap')

  return createSelectionState(resolvedIndexes, source, voiceScope)
}

function resolveSelectionByOrigin(
  index: SheetObjectIndex | undefined,
  origin: SelectionOrigin,
  source: SelectionSource,
  voiceScope: SelectionVoiceScope,
): SelectionState | undefined {
  const matchingIndexes = origin.znId === undefined
    ? []
    : resolveIndexesByZnId(index, origin.znId).filter((entryIndex) => {
        const entry = index?.entries[entryIndex]
        if (entry?.kind !== 'music-entity') return false
        if (origin.voiceId !== undefined && entry.voiceId !== origin.voiceId) return false
        if (origin.musicTime !== undefined && entry.musicTime !== origin.musicTime) return false
        return true
      })

  if (matchingIndexes.length > 0) {
    return createSelectionState(matchingIndexes, source, voiceScope)
  }

  return undefined
}

export function resolveSelectionByLineColumnRange(
  index: SheetObjectIndex | undefined,
  start: SelectionLineColumn,
  end: SelectionLineColumn,
  source: SelectionSource = 'abc-editor',
  voiceScope: SelectionVoiceScope = 'single-voice',
): SelectionState {
  const textRange = projectLineColumnRangeToTextRange(
    index,
    normalizeLineColumnRange(start, end),
  )
  if (textRange === undefined) {
    return createSelectionState([], source, voiceScope)
  }

  return resolveSelectionByTextRange(index, textRange.startpos, textRange.endpos, source, voiceScope)
}

function resolveExtendedSelectionByTextRange(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  startpos: number,
  endpos: number,
  source: SelectionSource,
  voiceScope: SelectionVoiceScope,
  origin?: SelectionOrigin,
): SelectionState {
  const nextSelection = origin === undefined
    ? resolveSelectionByTextRange(index, startpos, endpos, source, voiceScope)
    : resolveSelectionByOrigin(index, origin, source, voiceScope)
      ?? resolveSelectionByTextRange(index, startpos, endpos, source, voiceScope)
  const anchorIndex = selection.anchorIndex
  if (anchorIndex === undefined) return nextSelection

  const anchorSelection = createSelectionState(
    [anchorIndex],
    selection.source,
    selection.voiceScope,
    [anchorIndex],
    anchorIndex,
  )
  const anchorRange = resolveSelectionEditorRange(index, anchorSelection)
  const nextRange = resolveSelectionEditorRange(index, nextSelection)
  if (anchorRange === undefined || nextRange === undefined) {
    return {
      ...nextSelection,
      anchorIndex,
    }
  }

  const extendedSelection = resolveSelectionByTextRange(
    index,
    Math.min(anchorRange.startpos, nextRange.startpos),
    Math.max(anchorRange.endpos, nextRange.endpos),
    source,
    voiceScope,
  )

  return {
    ...extendedSelection,
    anchorIndex,
  }
}

function resolveExtendedSelectionByLineColumnRange(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  start: SelectionLineColumn,
  end: SelectionLineColumn,
  source: SelectionSource,
  voiceScope: SelectionVoiceScope,
  origin?: SelectionOrigin,
): SelectionState {
  const textRange = projectLineColumnRangeToTextRange(
    index,
    normalizeLineColumnRange(start, end),
  )
  if (textRange === undefined) {
    return createSelectionState([], source, voiceScope)
  }

  return resolveExtendedSelectionByTextRange(
    index,
    selection,
    textRange.startpos,
    textRange.endpos,
    source,
    voiceScope,
    origin,
  )
}

export function resolveSelectionAfterActiveVoicesChange(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  activeVoiceIds: string[],
): SelectionState {
  if (selection.selectedIndexes.length === 0) return selection
  if (selection.voiceScope !== 'extract-voices') return selection

  return resolveSelectionWithVoiceScope(
    index,
    selection,
    selection.voiceScope,
    {
      activeVoiceIds,
    },
  )
}

export function resolveSelectionAfterRenderRefresh(
  previousIndex: SheetObjectIndex | undefined,
  nextIndex: SheetObjectIndex | undefined,
  selection: SelectionState,
  options?: SelectionProjectionOptions,
): SelectionState {
  if (nextIndex === undefined) {
    return createClearedSelectionState(selection.source, selection.voiceScope)
  }

  const supportsTextRangeRebind = selection.source === 'abc-editor' || selection.source === 'score-preview'
  if (!supportsTextRangeRebind) {
    return createClearedSelectionState(selection.source, selection.voiceScope)
  }

  const originSelection: SelectionState = {
    ...selection,
    selectedIndexes: [...selection.originSelectedIndexes],
  }
  const previousTextRange = resolveSelectionEditorRange(previousIndex, originSelection)
  if (previousTextRange === undefined) {
    return createClearedSelectionState(selection.source, selection.voiceScope)
  }

  const reboundSelection = resolveSelectionByTextRange(
    nextIndex,
    previousTextRange.startpos,
    previousTextRange.endpos,
    selection.source,
    selection.voiceScope,
  )

  if (selection.voiceScope === 'single-voice') {
    return reboundSelection
  }

  return resolveSelectionWithVoiceScope(
    nextIndex,
    reboundSelection,
    selection.voiceScope,
    options,
  )
}

export function dispatchSelectionEvent(
  event: SelectionEvent,
  context: {
    selection: SelectionState
    sheetObjectIndex?: SheetObjectIndex
    activeVoiceIds?: string[]
  },
): SelectionState {
  const projectInputSelectionToCurrentScope = (nextSelection: SelectionState): SelectionState => {
    if (nextSelection.voiceScope === 'single-voice') {
      return nextSelection
    }
    return resolveSelectionWithVoiceScope(
      context.sheetObjectIndex,
      nextSelection,
      nextSelection.voiceScope,
      {
        activeVoiceIds: context.activeVoiceIds,
      },
    )
  }

  if (event.type === 'selection.replaced') {
    return event.selection
  }

  if (event.type === 'selection.indexes-selected') {
    return projectInputSelectionToCurrentScope(
      resolveSelectionByIndexes(
        event.selectedIndexes,
        event.source ?? 'command',
        context.selection.voiceScope,
      ),
    )
  }

  if (event.type === 'selection.text-range-selected') {
    const eventOrigin = event.origin ?? (
      event.source === 'score-preview'
        ? resolveSelectionOriginByTextRange(
            context.sheetObjectIndex,
            { startpos: event.startpos, endpos: event.endpos },
          )
        : undefined
    )
    const nextSelection = eventOrigin === undefined
      ? resolveSelectionByTextRange(
          context.sheetObjectIndex,
          event.startpos,
          event.endpos,
          event.source ?? 'abc-editor',
          context.selection.voiceScope,
        )
      : resolveSelectionByOrigin(
          context.sheetObjectIndex,
          eventOrigin,
          event.source ?? 'abc-editor',
          context.selection.voiceScope,
        ) ?? resolveSelectionByTextRange(
          context.sheetObjectIndex,
          event.startpos,
          event.endpos,
          event.source ?? 'abc-editor',
          context.selection.voiceScope,
        )

    return projectInputSelectionToCurrentScope(
      event.extend === true
        ? resolveExtendedSelectionByTextRange(
            context.sheetObjectIndex,
            context.selection,
            event.startpos,
            event.endpos,
            event.source ?? 'abc-editor',
            context.selection.voiceScope,
            eventOrigin,
          )
        : nextSelection,
    )
  }

  if (event.type === 'selection.line-column-range-selected') {
    return projectInputSelectionToCurrentScope(
      event.extend === true
        ? resolveExtendedSelectionByLineColumnRange(
            context.sheetObjectIndex,
            context.selection,
            event.start,
            event.end,
            event.source ?? 'abc-editor',
            context.selection.voiceScope,
            event.origin,
          )
        : resolveSelectionByLineColumnRange(
            context.sheetObjectIndex,
            event.start,
            event.end,
            event.source ?? 'abc-editor',
            context.selection.voiceScope,
          ),
    )
  }

  if (event.type === 'selection.znid-selected') {
    return projectInputSelectionToCurrentScope(
      resolveSelectionByZnId(
        context.sheetObjectIndex,
        event.znId,
        event.source ?? 'command',
        context.selection.voiceScope,
      ),
    )
  }

  if (event.type === 'selection.music-range-selected') {
    return projectInputSelectionToCurrentScope(
      resolveSelectionByMusicRange(
        context.sheetObjectIndex,
        event.znIds,
        event.source ?? 'command',
        context.selection.voiceScope,
      ),
    )
  }

  if (event.type === 'selection.confkey-selected') {
    return projectInputSelectionToCurrentScope(
      resolveSelectionByConfKey(
        context.sheetObjectIndex,
        event.confKey,
        event.source ?? 'command',
        context.selection.voiceScope,
      ),
    )
  }

  if (event.type === 'selection.song-loaded') {
    return createClearedSelectionState(
      event.source ?? context.selection.source,
      event.voiceScope ?? context.selection.voiceScope,
    )
  }

  if (event.type === 'selection.scope-changed') {
    return resolveSelectionWithVoiceScope(
      context.sheetObjectIndex,
      context.selection,
      event.voiceScope,
      {
        activeVoiceIds: context.activeVoiceIds,
      },
    )
  }

  if (event.type === 'selection.extract-changed') {
    return resolveSelectionAfterActiveVoicesChange(
      context.sheetObjectIndex,
      context.selection,
      event.activeVoiceIds,
    )
  }

  return resolveSelectionAfterRenderRefresh(
    context.sheetObjectIndex,
    event.nextIndex,
    context.selection,
    {
      activeVoiceIds: context.activeVoiceIds,
    },
  )
}

export function resolveSelectionProjection(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  target: SelectionTarget,
  options?: SelectionProjectionOptions,
): SelectionProjection {
  const svgSelection = resolveSvgSelection(index, selection, options)
  const projectedTextRanges = target === 'harp-preview'
    ? resolveScoreSelectionRanges(index, selection)
    : resolveScoreSelectionRanges(index, selection, options)
  const projection: SelectionProjection = {
    selectedIndexes: [...selection.selectedIndexes],
    textRanges: projectedTextRanges,
    znIds: svgSelection.znIds,
    confKeys: svgSelection.confKeys,
  }

  return filterProjectionByCapability(projection, getSelectionTargetCapabilities(target))
}

export function resolveSelectionEditorRange(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
): SelectionTextRange | undefined {
  const editorSelection: SelectionState = {
    ...selection,
    selectedIndexes: selection.originSelectedIndexes.length > 0
      ? [...selection.originSelectedIndexes]
      : [...selection.selectedIndexes],
  }
  return resolveEditorSelectionRange(index, editorSelection)
}

export function resolveSelectionScoreRanges(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  options?: SelectionProjectionOptions,
): SelectionTextRange[] {
  return resolveScoreSelectionRanges(index, selection, options)
}

export function resolveSelectionScoreEntries(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  options?: SelectionProjectionOptions,
): SheetObjectIndexEntry[] {
  return resolveScoreSelectionEntriesFromIndex(index, selection, options)
}

export function resolveSelectionZnIds(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
): string[] {
  return resolveSelectedZnIds(index, selection)
}

export function resolvePlaybackProjection(
  index: SheetObjectIndex | undefined,
  highlight: PlaybackHighlight | undefined,
  target: SelectionTarget = 'player',
): PlaybackHighlight {
  const projectedHighlight = projectPlaybackHighlight(index, highlight)
  const capability = getSelectionTargetCapabilities(target)
  if (!capability.reads.includes('textRange')) {
    return {
      ...projectedHighlight,
      activeTextRanges: [],
    }
  }

  return projectedHighlight
}

export function resolvePlaybackScoreRanges(
  index: SheetObjectIndex | undefined,
  highlight: PlaybackHighlight | undefined,
): SelectionTextRange[] {
  void index
  if (highlight === undefined) return []
  return highlight.activeTextRanges
}
