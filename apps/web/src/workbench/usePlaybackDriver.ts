import { onBeforeUnmount, ref, type Ref } from 'vue'

import type { SelectionState, SelectionTextRange, SheetObjectIndex } from '@zupfnoter/types'

import { usePlaybackStore } from '../stores/playback'
import {
  resolvePlaybackSteps,
  resolveEffectivePlaybackPartNames,
  updateActivePlaybackRanges,
  type PlaybackStep,
} from './playback'
import { textRangeKey } from './selectionIndex'
import type { AudioPlayer, PlaybackMetronomeVisualBeat, PlaybackScheduleCallbacks } from './useAudioPlayer'
import type { PlaybackMetronomeConfig } from '@zupfnoter/playback'

interface PlaybackDriverSource {
  timeline: PlaybackStep[]
  baseTempoFromQ?: number
  tempoUnitFromQ?: number
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
  let metronomePulse = 0
  const metronomeBeat = ref<(PlaybackMetronomeVisualBeat & { pulse: number }) | undefined>()

  function clearTimer(): void {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  function stop(immediateAudioStop = true): void {
    clearTimer()
    activePlaybackRanges = new Map()
    metronomeBeat.value = undefined
    if (immediateAudioStop) {
      audioPlayer?.stop()
    }
    playbackStore.stopPlayback()
  }

  async function play(): Promise<void> {
    const source = timelineSource.value
    const partNames = resolveEffectivePlaybackPartNames(source.timeline)
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
    metronomeBeat.value = undefined
    playbackStore.startPlayback(source.baseTempoFromQ, totalPassCount > 0 ? totalPassCount : undefined)
    const firstStep = steps[0]
    playbackStore.handlePlayerEvent({
      kind: 'current-notes',
      activeTextRanges: [],
      activeTime: firstStep?.activeTime,
      measureNumber: firstStep?.position?.measureNumber,
      partName: firstStep === undefined ? undefined : partNames.get(firstStep.flowIndex),
      passIndex: firstStep?.passIndex,
      voltaNumber: firstStep?.voltaNumber,
    })
    const lastStep = steps[steps.length - 1]
    const callbacks: PlaybackScheduleCallbacks = {
      onStepStart: (step) => {
        if (source.metronomeConfig?.mode === 'countIn') metronomeBeat.value = undefined
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
          measureNumber: step.position?.measureNumber,
          partName: partNames.get(step.flowIndex),
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
      onMetronomeBeat: (beat) => {
        metronomePulse += 1
        metronomeBeat.value = { ...beat, pulse: metronomePulse }
      },
    }
    await audioPlayer?.schedule(
      steps,
      playbackStore.state.speedFactor,
      callbacks,
      source.metronomeConfig,
      source.baseTempoFromQ,
      source.tempoUnitFromQ,
    )
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
    metronomeBeat,
    play,
    stop,
    toggle,
  }
}
