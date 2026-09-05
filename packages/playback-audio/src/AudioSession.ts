type SoundfontModule = typeof import('soundfont-player')
type SoundfontPlayer = Awaited<ReturnType<SoundfontModule['instrument']>>

export class AudioSessionCancelledError extends Error {
  constructor() { super('Audio session was stopped') }
}

/** Browser-Audio-Ressourcen; besitzt keine Song- oder Link-Timeline. */
export function createAudioSession() {
  let context: AudioContext | undefined
  let soundfontModule: Promise<SoundfontModule> | undefined
  const players = new Map<string, Promise<SoundfontPlayer>>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const cancelLoads = new Set<() => void>()
  let generation = 0

  function getContext(): AudioContext {
    if (context === undefined || context.state === 'closed') {
      const browserWindow = typeof window === 'undefined' ? undefined : window as Window & {
        webkitAudioContext?: typeof AudioContext
      }
      const Context = typeof AudioContext === 'undefined' ? browserWindow?.webkitAudioContext : AudioContext
      if (Context === undefined) throw new Error('Dieser Browser unterstützt keine Audiowiedergabe.')
      const navigatorWithSession = typeof navigator === 'undefined' ? undefined : navigator as Navigator & {
        audioSession?: { type: string }
      }
      if (navigatorWithSession?.audioSession !== undefined) navigatorWithSession.audioSession.type = 'playback'
      context = new Context({ latencyHint: 'playback' })
    }
    return context
  }

  /** Aufruf direkt in der Play-Geste, vor Sample-Downloads. */
  async function ensureRunning(): Promise<AudioContext> {
    const current = getContext()
    if (current.state === 'suspended') await current.resume()
    if (context !== current) throw new AudioSessionCancelledError()
    return current
  }

  function clearSchedule(): void {
    generation += 1
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }

  function stop(): void {
    clearSchedule()
    const previous = context
    context = undefined
    for (const cancel of cancelLoads) cancel()
    cancelLoads.clear()
    players.clear()
    if (previous !== undefined && previous.state !== 'closed') void previous.close()
  }

  async function loadInstrument(
    key: string,
    instrument: Parameters<SoundfontModule['instrument']>[1],
    options: Parameters<SoundfontModule['instrument']>[2],
    timeoutMs = 15000,
  ): Promise<SoundfontPlayer> {
    const cached = players.get(key)
    if (cached !== undefined) return cached
    const current = getContext()
    let timeout: ReturnType<typeof setTimeout> | undefined
    let cancelLoad: (() => void) | undefined
    const promise = Promise.race([
      (soundfontModule ??= import('soundfont-player')).then((soundfont) => {
        if (context !== current) throw new AudioSessionCancelledError()
        return soundfont.instrument(current, instrument, options)
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Instrument-Ladevorgang überschritten')), timeoutMs)
        cancelLoad = () => reject(new AudioSessionCancelledError())
        cancelLoads.add(cancelLoad)
      }),
    ]).then((player) => {
      if (context !== current) throw new AudioSessionCancelledError()
      return player
    }).catch((error: unknown) => {
      if (players.get(key) === promise) players.delete(key)
      throw error
    }).finally(() => {
      if (timeout !== undefined) clearTimeout(timeout)
      if (cancelLoad !== undefined) cancelLoads.delete(cancelLoad)
    })
    players.set(key, promise)
    return promise
  }

  /** Audio-clock-basierte Fenster; ein unendlicher Horizont plant einmal komplett. */
  function scheduleWindows(options: {
    durationMs: number
    startOffsetMs?: number
    elapsedMs: () => number
    lookaheadMs?: number
    windowMs?: number
    refillMs?: number
    onWindow: (startMs: number, endMs: number, includeOverlaps: boolean) => void
  }): void {
    const currentGeneration = generation
    let nextStart = options.startOffsetMs ?? 0
    let includeOverlaps = true
    const tick = () => {
      if (currentGeneration !== generation || nextStart >= options.durationMs) return
      const elapsed = Math.max(options.startOffsetMs ?? 0, options.elapsedMs())
      const targetEnd = Math.min(options.durationMs, elapsed + (options.lookaheadMs ?? Infinity))
      nextStart = Math.max(nextStart, elapsed)
      if (nextStart < targetEnd) {
        const end = Math.min(targetEnd, nextStart + (options.windowMs ?? Infinity))
        options.onWindow(nextStart, end, includeOverlaps)
        includeOverlaps = false
        nextStart = end
      }
      if (nextStart < options.durationMs && currentGeneration === generation) {
        const timer = setTimeout(() => { timers.delete(timer); tick() }, options.refillMs ?? 150)
        timers.add(timer)
      }
    }
    tick()
  }

  return {
    getContext, ensureRunning, loadInstrument, scheduleWindows, clearSchedule, stop,
    isCurrent: (candidate: AudioContext) => context === candidate && candidate.state !== 'closed',
    suspend: () => { if (context?.state === 'running') void context.suspend() },
    resume: () => { if (context?.state === 'suspended') void context.resume() },
  }
}
