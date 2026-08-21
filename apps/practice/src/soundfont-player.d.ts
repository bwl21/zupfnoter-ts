declare module 'soundfont-player' {
  interface SoundfontNote {
    time: number
    note: number
    duration: number
    gain?: number
  }

  interface SoundfontInstrument {
    schedule(startTime: number, notes: readonly SoundfontNote[]): void
  }

  interface SoundfontOptions {
    soundfont: string
    format?: 'mp3' | 'ogg'
    gain?: number
    notes?: readonly string[]
    destination?: AudioNode
  }

  export function instrument(
    context: AudioContext,
    name: string,
    options: SoundfontOptions,
  ): Promise<SoundfontInstrument>
}
