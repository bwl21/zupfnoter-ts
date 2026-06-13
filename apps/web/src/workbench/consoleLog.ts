export type ConsoleLogKind = 'command' | 'output' | 'info' | 'error'

export interface ConsoleLogEntry {
  id: number
  kind: ConsoleLogKind
  message: string
}
