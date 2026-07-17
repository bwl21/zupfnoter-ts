export type ConsoleLogKind = 'command' | 'output' | 'info' | 'warning' | 'error'

export interface ConsoleLogEntry {
  id: number
  kind: ConsoleLogKind
  message: string
}

/** Zentraler Erzeuger der formatierten Workbench-Konsolenmeldungen. */
export class WorkbenchLogger {
  private nextId = 0

  constructor(
    private readonly append: (entry: ConsoleLogEntry) => void,
    private readonly now: () => Date = () => new Date(),
  ) {}

  command(message: string): void {
    this.write('command', message, false)
  }

  output(message: string): void {
    this.write('output', message)
  }

  info(message: string): void {
    this.write('info', message)
  }

  warning(message: string): void {
    this.write('warning', message)
  }

  error(message: string): void {
    this.write('error', message)
  }

  private write(kind: ConsoleLogKind, message: string, includeTimestamp = true): void {
    this.nextId += 1
    this.append({
      id: this.nextId,
      kind,
      message: includeTimestamp ? `${formatLogTimestamp(this.now())}  ${message}` : message,
    })
  }
}

function formatLogTimestamp(value: Date): string {
  return value.toLocaleTimeString('de-DE', { hour12: false })
}
