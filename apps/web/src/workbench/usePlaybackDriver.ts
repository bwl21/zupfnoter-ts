import { onBeforeUnmount, type Ref } from 'vue'

import type { SelectionState, SelectionTextRange, SheetObjectIndex } from '@zupfnoter/types'

import { usePlaybackStore } from '../stores/playback'
import {
  resolvePlaybackSteps,
  updateActivePlaybackRanges,
  type PlaybackStep,
} from './playback'
import { textRangeKey } from './selectionIndex'
import type { AudioPlayer, PlaybackScheduleCallbacks } from './useAudioPlayer'
import type { PlaybackMetronomeConfig } from '@zupfnoter/playback'

interface PlaybackDriverSource {
  timeline: PlaybackStep[]
  baseTempoFromQ?: number
  activeVoiceIds?: string[]
  metronomeConfig?: PlaybackMetronomeConfig
}

export function usePlaybackDriver(
  playbackStore: ReturnType<typeof usePlaybackStore>,
  selection: Ref<SelectionState>,
  sheetObjectIndex: Ref<SheetObjectIndex | undefined>,
  timelineSource: Ref<PlaybackDriverSource>,
  audioPlayer?: AudioPlayer,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let activePlaybackRanges = new Map<string, { textRange: SelectionTextRange, endTimeMs: number }>()

  function clearTimer(): void {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  function stop(immediateAudioStop = true): void {
    clearTimer()
    activePlaybackRanges = new Map()
    if (immediateAudioStop) {
      audioPlayer?.stop()
    }
    playbackStore.stopPlayback()
  }

  async function play(): Promise<void> {
    const source = timelineSource.value
    const steps = resolvePlaybackSteps(
      selection.value,
      sheetObjectIndex.value,
      source.timeline,
      playbackStore.mode,
      {
        activeVoiceIds: source.activeVoiceIds,
      },
    )
    if (steps.length === 0) {
      stop()
      return
    }

    const totalPassCount = steps.reduce((maxPassCount: number, step: PlaybackStep) => (
      Math.max(maxPassCount, step.passIndex)
    ), 0)

    clearTimer()
    activePlaybackRanges = new Map()
    playbackStore.startPlayback(source.baseTempoFromQ, totalPassCount > 0 ? totalPassCount : undefined)
    const lastStep = steps[steps.length - 1]
    const callbacks: PlaybackScheduleCallbacks = {
      onStepStart: (step) => {
        activePlaybackRanges = updateActivePlaybackRanges(activePlaybackRanges, step)
        const activeTextRanges = [...new Map(
          [...activePlaybackRanges.values()].map((range) => [
            textRangeKey(range.textRange),
            range.textRange,
          ] as const),
        ).values()]
        playbackStore.handlePlayerEvent({
          kind: 'current-notes',
          activeTextRanges,
          activeStartChar: step.activeStartChar,
          activeTime: step.activeTime,
          passIndex: step.passIndex,
          voltaNumber: step.voltaNumber,
        })
      },
      onStepEnd: (step) => {
        if (lastStep !== undefined && step !== lastStep) return
        clearTimer()
        playbackStore.handlePlayerEvent({ kind: 'stop' })
        audioPlayer?.stop()
      },
    }
    await audioPlayer?.schedule(steps, playbackStore.state.speedFactor, callbacks, source.metronomeConfig)
    if (audioPlayer === undefined) {
      timer = setTimeout(() => {
        stop()
      }, steps.reduce((total, step) => total + (step.durationMs / playbackStore.state.speedFactor), 0))
    }
  }

  function toggle(): void {
    if (playbackStore.state.status === 'playing') {
      stop()
      return
    }
    play()
  }

  onBeforeUnmount(() => {
    clearTimer()
  })

  return {
    play,
    stop,
    toggle,
  }
}
