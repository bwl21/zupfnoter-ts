import { onBeforeUnmount, type Ref } from 'vue'

import type { SelectionState, SheetObjectIndex } from '@zupfnoter/types'

import { usePlaybackStore } from '../stores/playback'
import {
  resolvePlaybackSteps,
  type PlaybackStep,
} from './playback'
import type { AudioPlayer, PlaybackScheduleCallbacks } from './useAudioPlayer'

interface PlaybackDriverSource {
  timeline: PlaybackStep[]
  baseTempoFromQ?: number
  mode?: import('@zupfnoter/types').PlaybackMode
}

export function usePlaybackDriver(
  playbackStore: ReturnType<typeof usePlaybackStore>,
  selection: Ref<SelectionState>,
  sheetObjectIndex: Ref<SheetObjectIndex | undefined>,
  timelineSource: Ref<PlaybackDriverSource>,
  audioPlayer?: AudioPlayer,
) {
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearTimer(): void {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  function stop(immediateAudioStop = true): void {
    clearTimer()
    if (immediateAudioStop) {
      audioPlayer?.stop()
    }
    playbackStore.stopPlayback()
  }

  async function play(): Promise<void> {
    const source = timelineSource.value
    const playbackMode = source.mode ?? playbackStore.mode
    const steps = resolvePlaybackSteps(
      selection.value,
      sheetObjectIndex.value,
      source.timeline,
      playbackMode,
    )
    if (steps.length === 0) {
      stop()
      return
    }

    const totalPassCount = steps.reduce((maxPassCount: number, step: PlaybackStep) => (
      Math.max(maxPassCount, step.passIndex)
    ), 0)

    clearTimer()
    playbackStore.startPlayback(source.baseTempoFromQ, totalPassCount > 0 ? totalPassCount : undefined)
    const callbacks: PlaybackScheduleCallbacks = {
      onStepStart: (step) => {
        playbackStore.handlePlayerEvent({
          kind: 'current-notes',
          activeTextRanges: step.activeTextRanges,
          activeStartChar: step.activeStartChar,
          activeTime: step.activeTime,
          passIndex: step.passIndex,
          voltaNumber: step.voltaNumber,
        })
      },
    }
    await audioPlayer?.schedule(steps, playbackStore.state.speedFactor, callbacks)
    timer = setTimeout(() => {
      stop()
    }, steps.reduce((total, step) => total + (step.durationMs / playbackStore.state.speedFactor), 0))
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
