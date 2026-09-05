import type { ActivePlaybackRangeState, PlaybackStep, SelectionTextRange } from '@zupfnoter/types'

function textRangeKey(range: SelectionTextRange): string {
  return `${range.startpos}:${range.endpos}`
}

/** Entfernt Markierungen, deren tatsächliches Notenende erreicht ist. */
export function expireActivePlaybackRanges(
  activeRanges: ReadonlyMap<string, ActivePlaybackRangeState>,
  playbackTimeMs: number,
): Map<string, ActivePlaybackRangeState> {
  const nextRanges = new Map(activeRanges)
  for (const [key, range] of nextRanges) {
    if (range.endTimeMs <= playbackTimeMs) nextRanges.delete(key)
  }
  return nextRanges
}

/**
 * Hält Markierungen über globale Timeline-Schritte hinweg aktiv, solange die
 * zugehörige Note noch klingt.
 */
export function updateActivePlaybackRanges(
  activeRanges: ReadonlyMap<string, ActivePlaybackRangeState>,
  step: PlaybackStep,
): Map<string, ActivePlaybackRangeState> {
  const nextRanges = expireActivePlaybackRanges(activeRanges, step.playbackStartMs)
  for (const playbackId of step.endedPlaybackIds ?? []) {
    for (const key of nextRanges.keys()) {
      if (key.startsWith(`${playbackId}:`)) nextRanges.delete(key)
    }
  }

  const durationByPlaybackId = new Map<string, number>()
  for (const note of step.activeNotes) {
    const currentDuration = durationByPlaybackId.get(note.originPlaybackId) ?? 0
    durationByPlaybackId.set(note.originPlaybackId, Math.max(currentDuration, note.durationMs))
  }

  const playbackRanges = step.activePlaybackTextRanges ?? []
  if (playbackRanges.length > 0) {
    for (const entry of playbackRanges) {
      const key = `${entry.playbackId}:${textRangeKey(entry.textRange)}`
      const durationMs = durationByPlaybackId.get(entry.playbackId) ?? step.durationMs
      nextRanges.set(key, {
        textRange: { ...entry.textRange },
        endTimeMs: step.playbackStartMs + durationMs,
      })
    }
  } else {
    for (const textRange of step.activeTextRanges) {
      const key = `range:${textRangeKey(textRange)}`
      nextRanges.set(key, {
        textRange: { ...textRange },
        endTimeMs: step.playbackStartMs + step.durationMs,
      })
    }
  }

  return nextRanges
}
