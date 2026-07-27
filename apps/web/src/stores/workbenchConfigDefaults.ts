/** Reine Workbench-Einstellungen; ABC- und Song-Konfiguration gehört nicht hierher. */
export interface WorkbenchConfig {
  /** Zeigt editierbare Bézier-Handles an Flusslinien. */
  flowconf: boolean
  /** Steuert im ABC-Editor die Anzeige unsichtbarer Elemente. */
  showInvisibles: boolean
}

export const DEFAULT_WORKBENCH_CONFIG: Readonly<WorkbenchConfig> = {
  flowconf: true,
  showInvisibles: false,
}
