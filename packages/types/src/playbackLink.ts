/** Fachliche Position eines Playback-Ereignisses in Takt und Durchlauf. */
export interface PlaybackPosition {
  /** Nummer des Takts in der Notation. */
  measureNumber: number
  /** Nummer des tatsächlichen Playback-Durchlaufs. */
  passIndex: number
}

/** Absolutes, noch nicht quantisiertes Audio-Ereignis für den Link-Export. */
export interface PlaybackEvent {
  /** Startzeit relativ zum Beginn der vollständigen Wiedergabe in Millisekunden. */
  startMs: number
  /** Dauer des Tons in Millisekunden. */
  durationMs: number
  /** MIDI-Tonhöhe im Bereich 0–127. */
  pitch: number
  /** Optionale Lautstärke; fehlt sie, verwendet der Export 127. */
  velocity?: number
  /** Takt und Durchlauf dieses Audio-Ereignisses. */
  position: PlaybackPosition
}

/** Optionen für die Erzeugung eines standalone Playback-Links. */
export interface PlaybackLinkOptions {
  /** Basis-URL der Player-Anwendung. */
  playerUrl: string
  /** Zeitquantisierung in Millisekunden, standardmäßig 10. */
  timeResolutionMs?: number
  /** Kompressionsverfahren der Payload, standardmäßig Deflate Raw. */
  compression?: 'deflate-raw'
}

/** Ergebnis des Binary- und URL-Exports. */
export interface PlaybackLinkResult {
  /** Vollständige Player-URL mit #p-Fragment. */
  url: string
  /** Komprimierte Binärpayload einschließlich Header. */
  payload: Uint8Array
  /** Base64URL-Repräsentation ohne Padding. */
  encodedPayload: string
}
