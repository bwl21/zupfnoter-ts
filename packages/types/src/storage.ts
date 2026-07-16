/** Sichtbarer Zustand einer gespeicherten Storage-Verbindung. */
export type StorageConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'planned'

/** Nicht geheime, persistierbare Benutzerverbindung zu einem Storage-Anbieter. */
export interface StorageConnection {
  /** Stabile technische ID der Verbindung. */
  id: string
  /** Kennung des implementierten Anbieters. */
  providerId: string
  /** Fachlicher, vom Benutzer vergebener Anzeigename. */
  label: string
  /** Fester, anbieterbezogener Wurzelordner dieser Verbindung. */
  rootPath: string
  /** Zuletzt verwendeter Ordner relativ zur Wurzel. */
  relativePath: string
  /** Verhindert das Überschreiben über diese Verbindung. */
  readOnly: boolean
  /** Anbieterbezogene, nicht geheime Werte wie ein Server-Endpunkt. */
  configuration: Record<string, string>
  /** Zuletzt bekannter Verbindungszustand. */
  status: StorageConnectionStatus
}

/** Deklaration eines fest implementierten oder geplanten Storage-Anbieters. */
export interface StorageProviderDescriptor {
  /** Eindeutige Anbieterkennung. */
  id: string
  /** Sichtbarer fachlicher Name. */
  label: string
  /** Kennzeichnet implementierte und erst geplante Adapter. */
  availability: 'available' | 'planned'
}

/** Ein im aktuellen Speicherpfad auffindbares ABC-Dokument. */
export interface StorageDocument {
  /** Anbieterpfad der ABC-Datei. */
  path: string
  /** Sichtbarer Dateiname. */
  name: string
  /** Letzter Änderungszeitpunkt des Anbieters als ISO-Zeitstempel. */
  modifiedAt?: string
  /** Anbieterpfade der zu diesem Stück gehörenden PDF-Ausgaben. */
  previewPdfPaths: string[]
  /** Anbieterpfade der zu diesem Stück gehörenden HTML-Notenansichten. */
  previewHtmlPaths: string[]
}
