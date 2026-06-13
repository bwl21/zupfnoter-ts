import type { SongDiagnostic } from '@zupfnoter/types'
import type { AbcParseError } from '@zupfnoter/core'

export interface WorkbenchDiagnostic {
  /** Schweregrad der fachlichen oder parserseitigen Diagnose */
  severity: 'warning' | 'error'
  /** Menschliche Diagnosemeldung */
  message: string
  /** Herkunft innerhalb der Transformationskette */
  source?: string
  /** Start-Position im ABC-Quelltext [Zeile, Spalte] */
  startPos?: [number, number]
  /** End-Position im ABC-Quelltext [Zeile, Spalte] */
  endPos?: [number, number]
}

export function parserErrorToWorkbenchDiagnostic(error: AbcParseError): WorkbenchDiagnostic {
  const diagnostic: WorkbenchDiagnostic = {
    severity: 'error',
    message: error.message,
    source: 'abc-parser',
  }

  if (error.line !== undefined) {
    const column = error.column ?? 1
    diagnostic.startPos = [error.line, column]
    diagnostic.endPos = [error.line, column]
  }

  return diagnostic
}

export function songDiagnosticToWorkbenchDiagnostic(diagnostic: SongDiagnostic): WorkbenchDiagnostic {
  return {
    severity: diagnostic.severity,
    message: diagnostic.message,
    source: 'abc-to-song',
    startPos: diagnostic.startPos,
    endPos: diagnostic.endPos,
  }
}

export function workbenchDiagnosticHasPosition(
  diagnostic: WorkbenchDiagnostic,
): diagnostic is WorkbenchDiagnostic & { startPos: [number, number] } {
  return diagnostic.startPos !== undefined
}

export function workbenchDiagnosticKey(diagnostic: WorkbenchDiagnostic): string {
  const startPos = diagnostic.startPos === undefined ? '' : `${diagnostic.startPos[0]}:${diagnostic.startPos[1]}`
  const endPos = diagnostic.endPos === undefined ? '' : `${diagnostic.endPos[0]}:${diagnostic.endPos[1]}`
  return [
    diagnostic.source ?? '',
    diagnostic.severity,
    diagnostic.message,
    startPos,
    endPos,
  ].join('|')
}
