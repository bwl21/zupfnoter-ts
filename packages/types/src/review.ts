import type { PlaybackStep } from './playback.js'

/** Ein in der Review-Anwendung auswählbarer Zupfnoter-Auszug. */
export interface ReviewExtract {
  /** Externe, in der ABC-Konfiguration verwendete Auszugsnummer. */
  number: number
  /** Für Leser sichtbare Bezeichnung des Auszugs. */
  title: string
}

/** Vollständig aus ABC abgeleitete, schreibgeschützte Review-Darstellung. */
export interface ReviewDocument {
  /** Titel des geladenen Musikstücks. */
  title: string
  /** Aktuell gerenderte externe Auszugsnummer. */
  extractNumber: number
  /** Für das Stück verfügbare Auszüge. */
  extracts: ReviewExtract[]
  /** Normale Notenschrift als SVG. */
  scoreSvg: string
  /** Zupfnoter-Harfennotation als SVG. */
  harpSvg: string
  /** Playback-Timeline der im Auszug aktiven, extern 1-basierten Stimmen. */
  playbackTimeline: PlaybackStep[]
  /** Grundtempo aus dem ABC-Header in Schlägen pro Minute. */
  baseTempoBpm: number
  /** Notenwert eines Grundschlags als Bruchteil einer ganzen Note. */
  tempoUnit: number
}
