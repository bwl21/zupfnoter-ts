import type { PlaybackStep } from './playback'

export interface PlaybackScheduleCallbacks {
  onStepStart?: (step: PlaybackStep) => void
  onStepEnd?: (step: PlaybackStep) => void
}

export function useAudioPlayer() {
  type SoundfontModule = typeof import('soundfont-player')
  type SoundfontPlayer = Awaited<ReturnType<SoundfontModule['instrument']>>

  let ctx: AudioContext | null = null
  let playerPromise: Promise<SoundfontPlayer> | null = null
  let timers: ReturnType<typeof setTimeout>[] = []

  function getContext(): AudioContext {
    if (ctx === null || ctx.state === 'closed') {
      ctx = new AudioContext()
    }
    return ctx
  }

  function loadPlayer(): Promise<SoundfontPlayer> {
    if (playerPromise !== null) return playerPromise
    playerPromise = import('soundfont-player').then(async (Soundfont) => {
      const context = getContext()
      if (context.state === 'suspended') {
        await context.resume()
      }
      return Soundfont.instrument(context, 'orchestral_harp', {
        soundfont: 'FluidR3_GM',
        gain: 2.0,
      })
    })
    return playerPromise
  }

  function clearTimers(): void {
    for (const timer of timers) {
      clearTimeout(timer)
    }
    timers = []
  }

  async function schedule(
    steps: PlaybackStep[],
    speedFactor: number,
    callbacks: PlaybackScheduleCallbacks = {},
  ): Promise<void> {
    const player = await loadPlayer()
    const context = getContext()
    const events: Array<{ time: number; note: number; duration: number }> = []
    const scheduledAtMs = performance.now()

    clearTimers()
    for (const step of steps) {
      const stepOffsetMs = step.playbackStartMs / speedFactor
      const stepStartSec = context.currentTime + stepOffsetMs / 1000
      if (callbacks.onStepStart !== undefined) {
        timers.push(setTimeout(() => {
          callbacks.onStepStart?.(step)
        }, stepOffsetMs))
      }
      if (callbacks.onStepEnd !== undefined) {
        timers.push(setTimeout(() => {
          callbacks.onStepEnd?.(step)
        }, stepOffsetMs + (step.durationMs / speedFactor)))
      }
      for (const note of step.activeNotes) {
        if (!note.attack) continue
        events.push({
          time: stepStartSec,
          note: note.pitch,
          duration: note.durationMs / speedFactor / 1000,
        })
      }
    }
    void scheduledAtMs
    if (events.length === 0) return
    player.schedule(context.currentTime, events)
  }

  function stop(): void {
    clearTimers()
    if (ctx !== null && ctx.state !== 'closed') {
      ctx.close()
      ctx = null
    }
    playerPromise = null
  }

  function suspend(): void {
    if (ctx !== null && ctx.state === 'running') {
      ctx.suspend()
    }
  }

  function resume(): void {
    if (ctx !== null && ctx.state === 'suspended') {
      ctx.resume()
    }
  }

  return { schedule, stop, suspend, resume }
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>
