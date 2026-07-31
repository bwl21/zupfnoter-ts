export type FileToolbarAction =
  | 'new'
  | 'open'
  | 'save'
  | 'import'
  | 'download'
  | 'storage-connections'

export type ToolbarFileIconName = 'file' | 'new' | 'open' | 'save' | 'import' | 'format' | 'download' | 'storage'

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

/** Der für die Speichern-Aktion relevante Teil einer Speicherverbindung. */
export interface StorageSaveTarget {
  /** Fachlicher Name der Verbindung. */
  label: string
  /** Fester Wurzelordner der Verbindung beim Anbieter. */
  rootPath: string
  /** Verhindert Speichern innerhalb dieser Verbindung. */
  readOnly: boolean
}

/** Vollständige Dokument- und Speicherortaktionen der Haupttoolbar. */
export const FILE_TOOLBAR_MENU_ITEMS: FileToolbarMenuItem[] = [
  { type: 'action', action: 'new', label: 'Neu', tooltip: 'Neues Dokument anlegen', icon: 'new' },
  { type: 'action', action: 'open', label: 'Öffnen', tooltip: 'Dokument öffnen', icon: 'open' },
  { type: 'action', action: 'save', label: 'Speichern', tooltip: 'Aktuelles Dokument speichern', icon: 'save' },
  { type: 'separator' },
  { type: 'action', action: 'import', label: 'Importieren', tooltip: 'ABC oder MusicXML vom Gerät importieren', icon: 'import' },
  { type: 'action', action: 'download', label: 'ABC herunterladen', tooltip: 'Aktuelles Dokument als ABC herunterladen', icon: 'download' },
  { type: 'separator' },
  { type: 'action', action: 'storage-connections', label: 'Speicherverbindungen …', tooltip: 'Speicherverbindungen verwalten', icon: 'storage' },
]

/** Ein Speichern ist erst mit einem vollständigen Ziel aus Anbieter, Pfad und Dateiname möglich. */
export function isFileToolbarActionDisabled(action: FileToolbarAction, hasSaveTarget: boolean): boolean {
  return action === 'save' && !hasSaveTarget
}

/** Beschreibt das aktuelle Speicherziel beziehungsweise den Grund für eine Sperre. */
export function storageSaveTooltip(target: StorageSaveTarget | undefined, relativePath: string): string {
  if (target === undefined) return 'Speichern ist erst mit bekanntem Speicherziel möglich'
  if (target.readOnly) return `Speichern ist für „${target.label}“ deaktiviert (nur lesen)`

  const pathParts = [target.rootPath, relativePath]
    .map((path) => path.trim().replace(/^\/+|\/+$/g, ''))
    .filter((path) => path !== '')
  const targetPath = pathParts.length === 0 ? '/' : `/${pathParts.join('/')}`
  return `In „${target.label}“ unter ${targetPath} speichern`
}

export function fileToolbarPlaceholderMessage(action: FileToolbarAction): string | undefined {
  const messages: Partial<Record<FileToolbarAction, string>> = {
    open: 'Öffnen wird mit dem Dateiauswahl-Workflow in Phase 5.6 ergänzt.',
  }
  return messages[action]
}
