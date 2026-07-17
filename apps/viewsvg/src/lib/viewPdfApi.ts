export type PdfSource = 'legacy' | 'ts'

export interface ViewPdfCaseSummary {
  id: string
  legacyExtracts: number[]
  tsExtracts: number[]
}

export interface ViewPdfCaseDetails extends ViewPdfCaseSummary {
  legacyPdfCount: number
  tsPdfCount: number
}

export function getPdfCaseLabel(caseItem: ViewPdfCaseSummary): string {
  return `${caseItem.id} · L${String(caseItem.legacyExtracts.length)}/TS${String(caseItem.tsExtracts.length)}`
}

export async function fetchViewPdfCases(): Promise<ViewPdfCaseDetails[]> {
  const response = await fetch('/api/viewpdf/cases')
  if (!response.ok) {
    throw new Error(`Failed to load viewpdf cases (${String(response.status)})`)
  }
  return (await response.json()) as ViewPdfCaseDetails[]
}

export function viewPdfUrl(caseId: string, source: PdfSource, extractNr: number): string {
  const params = new URLSearchParams({
    case: caseId,
    source,
    extract: String(extractNr),
  })
  return `/api/viewpdf/pdf?${params.toString()}`
}
