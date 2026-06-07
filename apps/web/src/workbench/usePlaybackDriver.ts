import { onBeforeUnmount, type Ref } from 'vue'

import type { SelectionState } from '@zupfnoter/types'

import { usePlaybackStore } from '../stores/playback'
import {
  resolvePlaybackSteps,
  resolveBaseTempoFromSong,
  type PlaybackStep,
} from './playback'

interface PlaybackDriverSource {
  timeline: PlaybackStep[]
  baseTempoFromQ?: number
}

export function usePlaybackDriver(
  playbackStore: ReturnType<typeof usePlaybackStore>,
  selection: Ref<SelectionState>,
  timelineSource: Ref<PlaybackDriverSource>,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let stepIndex = 0

  function clearTimer(): void {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  function stop(): void {
    clearTimer()
    stepIndex = 0
    playbackStore.stopPlayback()
  }

  function scheduleNextStep(steps: PlaybackStep[]): void {
    if (stepIndex >= steps.length) {
      stop()
      return
    }

    const step = steps[stepIndex]
    if (step === undefined) {
      stop()
      return
    }

    playbackStore.handlePlayerEvent({
      kind: 'current-notes',
      activeZnIds: step.activeZnIds,
      activeStartChar: step.activeStartChar,
      activeTime: step.activeTime,
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
      source.timeline,
      playbackStore.mode,
    )
    if (steps.length === 0) {
      stop()
      return
    }

    clearTimer()
    stepIndex = 0
    playbackStore.startPlayback(source.baseTempoFromQ)
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
  })

  return {
    play,
    stop,
    toggle,
  }
}
