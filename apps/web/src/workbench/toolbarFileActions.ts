export type FileToolbarAction =
  | 'new'
  | 'open'
  | 'save'
  | 'import'
  | 'download'
  | 'storage-select'
  | 'storage-connect'
  | 'storage-disconnect'
  | 'storage-path'

export type ToolbarFileIconName = 'file' | 'new' | 'open' | 'save' | 'import' | 'download' | 'storage'

export interface FileToolbarMenuAction {
  type: 'action'
  action: FileToolbarAction
  label: string
  tooltip: string
  icon: ToolbarFileIconName
}

export interface FileToolbarMenuSeparator {
  type: 'separator'
}

export type FileToolbarMenuItem = FileToolbarMenuAction | FileToolbarMenuSeparator

/** Vollständige Dokument- und Speicherortaktionen der Haupttoolbar. */
export const FILE_TOOLBAR_MENU_ITEMS: FileToolbarMenuItem[] = [
  { type: 'action', action: 'new', label: 'Neu', tooltip: 'Neues Dokument anlegen', icon: 'new' },
  { type: 'action', action: 'open', label: 'Öffnen', tooltip: 'Dokument öffnen', icon: 'open' },
  { type: 'action', action: 'save', label: 'Speichern', tooltip: 'Aktuelles Dokument speichern', icon: 'save' },
  { type: 'separator' },
  { type: 'action', action: 'import', label: 'Importieren', tooltip: 'ABC oder MusicXML vom Gerät importieren', icon: 'import' },
  { type: 'action', action: 'download', label: 'ABC herunterladen', tooltip: 'Aktuelles Dokument als ABC herunterladen', icon: 'download' },
  { type: 'separator' },
  { type: 'action', action: 'storage-select', label: 'Speicherort auswählen', tooltip: 'Anbieter und Speicherort auswählen', icon: 'storage' },
  { type: 'action', action: 'storage-connect', label: 'Anbieter verbinden', tooltip: 'Mit einem Speicheranbieter verbinden', icon: 'storage' },
  { type: 'action', action: 'storage-disconnect', label: 'Anbieter trennen', tooltip: 'Verbindung zum Speicheranbieter trennen', icon: 'storage' },
  { type: 'action', action: 'storage-path', label: 'Speicherpfad verwalten', tooltip: 'Aktuellen Speicherpfad verwalten', icon: 'storage' },
]

/** Ein Speichern ist erst mit einem vollständigen Ziel aus Anbieter, Pfad und Dateiname möglich. */
export function isFileToolbarActionDisabled(action: FileToolbarAction, hasSaveTarget: boolean): boolean {
  return action === 'save' && !hasSaveTarget
}

export function fileToolbarPlaceholderMessage(action: FileToolbarAction): string | undefined {
  const messages: Partial<Record<FileToolbarAction, string>> = {
    open: 'Öffnen wird mit dem Dateiauswahl-Workflow in Phase 5.6 ergänzt.',
    import: 'Der lokale Import wird mit der Datei-Integration in Phase 5.6 ergänzt.',
    'storage-select': 'Die Auswahl von Anbieter und Speicherort wird in Phase 5.6 ergänzt.',
    'storage-connect': 'Das Verbinden eines Speicheranbieters wird in Phase 5.6 über die Storage-Schicht ergänzt.',
    'storage-disconnect': 'Das Trennen eines Speicheranbieters wird in Phase 5.6 über die Storage-Schicht ergänzt.',
    'storage-path': 'Die Verwaltung des Speicherpfads wird in Phase 5.6 ergänzt.',
  }
  return messages[action]
}
