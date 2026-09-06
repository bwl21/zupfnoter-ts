import type { PlaybackMetronomeMode } from './playback.js'

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
  /** Vollständige zeitbasierte Positionsspur, einschließlich stiller Schritte. */
  positionMarkers?: readonly PlaybackPositionMarker[]
  /** Schläge pro Minute bezogen auf tempoUnit. */
  tempoBpm?: number
  /** Dauer der Tempoeinheit als Bruchteil einer ganzen Note. */
  tempoUnit?: number
  /** Metronom-Empfehlung für den Empfänger. */
  metronome?: PlaybackMetronomeOverrides
}

/** Metrum eines Playback-Taktes. */
export interface PlaybackMeter {
  /** Anzahl der Zählzeiten im Takt. */
  numerator: number
  /** Notenwert-Nenner einer Zählzeit. */
  denominator: number
  /** Optionale additive Gruppierung der Zählzeiten. */
  grouping?: readonly number[]
}

/** Position und Metrum an einem Zeitpunkt der Wiedergabe. */
export interface PlaybackPositionMarker {
  /** Millisekunden ab Beginn der vollständigen Wiedergabe. */
  timeMs: number
  /** Notierter Takt und tatsächlicher Durchlauf. */
  position: PlaybackPosition
  /** Metrum an dieser Position, falls bekannt. */
  meter?: PlaybackMeter
  /** Sichtbarer Abschnittsname, falls an diesem Zeitpunkt gesetzt. */
  partName?: string
}

/** Metronom-Einstellung für Scheduler und Link-Format. */
export interface PlaybackMetronomeConfig {
  /** Phasen, in denen das Metronom hörbar ist. */
  mode: PlaybackMetronomeMode
  /** Mindestanzahl hörbarer Hauptschläge vor dem Einstieg. */
  minLeadIn?: number
  /** Aktiviert das zusätzliche Ensemble-Vorzählen. */
  bandPreCount?: boolean
  /** Hauptschläge pro Takt; ohne Angabe gilt das Metrum. */
  division?: number
  /** Unterteilungen je Hauptschlag. */
  subdivision?: number
}

/** Explizite Link-Vorgaben; fehlende Felder überlassen die Entscheidung dem Empfänger. */
export type PlaybackMetronomeOverrides = Partial<PlaybackMetronomeConfig>

/** Ergebnis des Binary- und URL-Exports. */
export interface PlaybackLinkResult {
  /** Vollständige Player-URL mit #p-Fragment. */
  url: string
  /** Komprimierte Binärpayload einschließlich Header. */
  payload: Uint8Array
  /** Base64URL-Repräsentation ohne Padding. */
  encodedPayload: string
  /** Größenanalyse der erzeugten Binär- und URL-Darstellung. */
  analysis: PlaybackLinkAnalysis
}

/** Größenanteile einzelner Felder; Einheit durch den verwendenden Kontext bestimmt. */
export interface PlaybackByteBreakdown {
  /** Header-Anteil. */
  headerBytes: number
  /** Zeitstempel-Anteil. */
  timeBytes: number
  /** Tondauer-Anteil. */
  durationBytes: number
  /** Tonhöhen-Anteil. */
  pitchBytes: number
  /** Lautstärke-Anteil. */
  velocityBytes: number
  /** Instrument-Anteil. */
  instrumentBytes: number
  /** Stimmen-Anteil. */
  voiceBytes: number
  /** Flag-Anteil. */
  flagsBytes: number
  /** Identitäts-Anteil. */
  idsBytes: number
  /** Positionsspur-Anteil. */
  markerBytes: number
  /** Sonstiger Metadaten-Anteil. */
  otherMetadataBytes: number
}

/** Messwerte des Playback-Link-Encoders. */
export interface PlaybackLinkAnalysis {
  /** Anzahl der codierten Notenereignisse. */
  eventCount: number
  /** Unkomprimierte Länge in Bytes. */
  binaryBytes: number
  /** Komprimierte Länge in Bytes. */
  compressedBytes: number
  /** Länge der Base64URL-Darstellung in Zeichen. */
  base64UrlChars: number
  /** Mittlere unkomprimierte Bytezahl pro Ereignis. */
  bytesPerEvent: number
  /** Absolute Größenanteile in Bytes. */
  breakdown: PlaybackByteBreakdown
  /** Relative Größenanteile in Prozent. */
  percentages: PlaybackByteBreakdown
}
