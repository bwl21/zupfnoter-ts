import type { PlaybackStep } from './playback'

export interface Instrument {
  playNote(
    pitch: number,
    startTime: number,
    durationMs: number,
    ctx: AudioContext,
  ): void
}

export class HarpInstrument implements Instrument {
  playNote(
    pitch: number,
    startTime: number,
    durationMs: number,
    ctx: AudioContext,
  ): void {
    const freq = 440 * Math.pow(2, (pitch - 69) / 12)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.value = freq

    const attackSec = 0.008
    const noteDurationSec = Math.max(durationMs / 1000, 0.05)
    const releaseSec = noteDurationSec * 0.9
    const endTime = startTime + noteDurationSec

    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(0.25, startTime + attackSec)
    gain.gain.setValueAtTime(0.25, startTime + releaseSec)
    gain.gain.exponentialRampToValueAtTime(0.001, endTime)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(startTime)
    osc.stop(endTime + 0.02)
  }
}

export function useAudioPlayer(instrument?: Instrument) {
  let ctx: AudioContext | null = null

  function getContext(): AudioContext {
    if (ctx === null || ctx.state === 'closed') {
      ctx = new AudioContext()
    }
    return ctx
  }

  function schedule(steps: PlaybackStep[], speedFactor: number): void {
    const context = getContext()
    if (context.state === 'suspended') {
      context.resume()
    }

    const inst = instrument ?? new HarpInstrument()
    let timeOffsetMs = 0

    for (const step of steps) {
      const adjustedStepDuration = step.durationMs / speedFactor
      const stepStartSec = context.currentTime + timeOffsetMs / 1000

      for (const note of step.activeNotes) {
        if (!note.attack) continue
        inst.playNote(
          note.pitch,
          stepStartSec,
          note.durationMs / speedFactor,
          context,
        )
      }

      timeOffsetMs += adjustedStepDuration
    }
  }

  function stop(): void {
    if (ctx !== null && ctx.state !== 'closed') {
      ctx.close()
      ctx = null
    }
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
