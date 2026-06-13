import type {
  PlaybackHighlight,
  SelectionLineColumn,
  SelectionProjection,
  SelectionProjectionOptions,
  SelectionProjectionKind,
  SelectionState,
  SelectionSource,
  SelectionTarget,
  SelectionTargetCapabilities,
  SelectionTextRange,
  SheetObjectIndex,
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
  resolveScoreSelectionRanges,
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

function createSelectionState(selectedIndexes: number[], source: SelectionSource): SelectionState {
  const normalized = normalizeIndexes(selectedIndexes)
  return {
    selectedIndexes: normalized,
    anchorIndex: normalized[0],
    source,
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

export function resolveSelectionByIndexes(
  selectedIndexes: number[],
  source: SelectionSource = 'command',
): SelectionState {
  return createSelectionState(selectedIndexes, source)
}

export function resolveSelectionByZnId(
  index: SheetObjectIndex | undefined,
  znId: string,
  source: SelectionSource = 'command',
): SelectionState {
  return createSelectionState(resolveIndexesByZnId(index, znId), source)
}

export function resolveSelectionByMusicRange(
  index: SheetObjectIndex | undefined,
  znIds: string[],
  source: SelectionSource = 'command',
): SelectionState {
  return createSelectionState(
    znIds.flatMap((znId) => resolveIndexesByZnId(index, znId)),
    source,
  )
}

export function resolveSelectionByConfKey(
  index: SheetObjectIndex | undefined,
  confKey: string,
  source: SelectionSource = 'command',
): SelectionState {
  return createSelectionState(resolveIndexesByConfKey(index, confKey), source)
}

export function resolveSelectionByTextRange(
  index: SheetObjectIndex | undefined,
  startpos: number,
  endpos: number,
  source: SelectionSource = 'abc-editor',
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

  return createSelectionState(resolvedIndexes, source)
}

export function resolveSelectionByLineColumnRange(
  index: SheetObjectIndex | undefined,
  start: SelectionLineColumn,
  end: SelectionLineColumn,
  source: SelectionSource = 'abc-editor',
): SelectionState {
  const textRange = projectLineColumnRangeToTextRange(
    index,
    normalizeLineColumnRange(start, end),
  )
  if (textRange === undefined) {
    return createSelectionState([], source)
  }

  return resolveSelectionByTextRange(index, textRange.startpos, textRange.endpos, source)
}

export function resolveSelectionProjection(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
  target: SelectionTarget,
  options?: SelectionProjectionOptions,
): SelectionProjection {
  const svgSelection = resolveSvgSelection(index, selection, options)
  const projection: SelectionProjection = {
    selectedIndexes: [...selection.selectedIndexes],
    textRanges: resolveScoreSelectionRanges(index, selection),
    znIds: svgSelection.znIds,
    confKeys: svgSelection.confKeys,
  }

  return filterProjectionByCapability(projection, getSelectionTargetCapabilities(target))
}

export function resolveSelectionEditorRange(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
): SelectionTextRange | undefined {
  return resolveEditorSelectionRange(index, selection)
}

export function resolveSelectionScoreRanges(
  index: SheetObjectIndex | undefined,
  selection: SelectionState,
): SelectionTextRange[] {
  return resolveScoreSelectionRanges(index, selection)
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
