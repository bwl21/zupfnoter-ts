import { onBeforeUnmount, type Ref } from 'vue'

import type { SelectionState, SheetObjectIndex } from '@zupfnoter/types'

import { usePlaybackStore } from '../stores/playback'
import {
  resolvePlaybackSteps,
  resolveBaseTempoFromSong,
  type PlaybackStep,
} from './playback'
import type { AudioPlayer } from './useAudioPlayer'

interface PlaybackDriverSource {
  timeline: PlaybackStep[]
  baseTempoFromQ?: number
}

export function usePlaybackDriver(
  playbackStore: ReturnType<typeof usePlaybackStore>,
  selection: Ref<SelectionState>,
  sheetObjectIndex: Ref<SheetObjectIndex | undefined>,
  timelineSource: Ref<PlaybackDriverSource>,
  audioPlayer?: AudioPlayer,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stepIndex = 0
  let audioStopTimer: ReturnType<typeof setTimeout> | undefined

  function clearAudioStopTimer(): void {
    if (audioStopTimer === undefined) return
    clearTimeout(audioStopTimer)
    audioStopTimer = undefined
  }

  function clearTimer(): void {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  function stop(immediateAudioStop = true): void {
    clearTimer()
    clearAudioStopTimer()
    stepIndex = 0
    if (immediateAudioStop) {
      audioPlayer?.stop()
    } else {
      audioStopTimer = setTimeout(() => {
        audioPlayer?.stop()
        audioStopTimer = undefined
      }, 160)
    }
    playbackStore.stopPlayback()
  }

  function scheduleNextStep(steps: PlaybackStep[]): void {
    if (stepIndex >= steps.length) {
      stop(false)
      return
    }

    const step = steps[stepIndex]
    if (step === undefined) {
      stop(false)
      return
    }

    playbackStore.handlePlayerEvent({
      kind: 'current-notes',
      activeTextRanges: step.activeTextRanges,
      activeStartChar: step.activeStartChar,
      activeTime: step.activeTime,
      passIndex: step.passIndex,
      voltaNumber: step.voltaNumber,
    })

    stepIndex += 1

    timer = setTimeout(() => {
      scheduleNextStep(steps)
    }, step.durationMs / playbackStore.state.speedFactor)
  }

  function play(): void {
    const source = timelineSource.value
    const steps = resolvePlaybackSteps(
      selection.value,
      sheetObjectIndex.value,
      source.timeline,
      playbackStore.mode,
    )
    if (steps.length === 0) {
      stop()
      return
    }

    clearAudioStopTimer()
    const totalPassCount = steps.reduce((maxPassCount: number, step: PlaybackStep) => (
      Math.max(maxPassCount, step.passIndex)
    ), 0)

    clearTimer()
    stepIndex = 0
    audioPlayer?.schedule(steps, playbackStore.state.speedFactor)
    playbackStore.startPlayback(source.baseTempoFromQ, totalPassCount > 0 ? totalPassCount : undefined)
    scheduleNextStep(steps)
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
    clearAudioStopTimer()
  })

  return {
    play,
    stop,
    toggle,
  }
}
