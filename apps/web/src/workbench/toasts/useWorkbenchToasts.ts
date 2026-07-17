import { computed, ref } from 'vue'

import type { WorkbenchDiagnostic } from '../diagnostics'
import { workbenchDiagnosticKey } from '../diagnostics'

export interface WorkbenchToast {
  /** Laufende interne Toast-ID */
  id: number
  /** Visuelle Schwereklasse */
  severity: 'info' | 'warning' | 'danger' | 'success'
  /** Kurzlabel für die Herkunft */
  title: string
  /** Vollständige Meldung */
  message: string
  /** Optionale technische Quelle */
  source?: string
  /** Fehler bleiben sichtbar, bis sie ausdrücklich geschlossen werden. */
  persistent?: boolean
}

const TOAST_TTL_MS = 6000

function severityToToastTone(severity: WorkbenchDiagnostic['severity']): WorkbenchToast['severity'] {
  return severity === 'error' ? 'danger' : 'warning'
}

function diagnosticTitle(diagnostic: WorkbenchDiagnostic): string {
  if (diagnostic.source === undefined || diagnostic.source.length === 0) return 'Diagnose'
  return diagnostic.source
}

export function useWorkbenchToasts() {
  const toasts = ref<WorkbenchToast[]>([])
  const seenDiagnosticKeys = ref(new Set<string>())
  let nextToastId = 1

  function dismissToast(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function pushDiagnostic(diagnostic: WorkbenchDiagnostic): void {
    const key = workbenchDiagnosticKey(diagnostic)
    if (seenDiagnosticKeys.value.has(key)) return

    seenDiagnosticKeys.value = new Set(seenDiagnosticKeys.value).add(key)

    const toast: WorkbenchToast = {
      id: nextToastId,
      severity: severityToToastTone(diagnostic.severity),
      title: diagnosticTitle(diagnostic),
      message: diagnostic.message,
      source: diagnostic.source,
    }
    nextToastId += 1
    toasts.value = [toast, ...toasts.value]

    if (!toast.persistent) {
      setTimeout(() => {
        dismissToast(toast.id)
      }, TOAST_TTL_MS)
    }
  }

  function pushToast(toast: Omit<WorkbenchToast, 'id'>): void {
    const nextToast: WorkbenchToast = {
      ...toast,
      id: nextToastId,
    }
    nextToastId += 1
    toasts.value = [nextToast, ...toasts.value]
    if (!nextToast.persistent) {
      setTimeout(() => {
        dismissToast(nextToast.id)
      }, TOAST_TTL_MS)
    }
  }

  function syncDiagnostics(diagnostics: WorkbenchDiagnostic[]): void {
    const nextKeys = new Set(diagnostics.map((diagnostic) => workbenchDiagnosticKey(diagnostic)))
    for (const diagnostic of diagnostics) {
      const key = workbenchDiagnosticKey(diagnostic)
      if (!seenDiagnosticKeys.value.has(key)) {
        pushDiagnostic(diagnostic)
      }
    }
    seenDiagnosticKeys.value = nextKeys
  }

  const visibleToasts = computed(() => toasts.value)

  return {
    toasts: visibleToasts,
    pushToast,
    syncDiagnostics,
    dismissToast,
  }
}
