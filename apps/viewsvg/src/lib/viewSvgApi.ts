export type SvgSource = 'legacy' | 'ts'

export interface ViewSvgCaseSummary {
  id: string
  legacyExtracts: number[]
  tsExtracts: number[]
}

export interface ViewSvgCaseDetails extends ViewSvgCaseSummary {
  legacySvgCount: number
  tsSvgCount: number
}

export interface ViewSvgResponse {
  svg: string
  source: SvgSource
  extractNr: number
  caseId: string
}

export function getCaseLabel(caseItem: ViewSvgCaseSummary): string {
  const legacyCount = caseItem.legacyExtracts.length
  const tsCount = caseItem.tsExtracts.length
  return `${caseItem.id} · L${legacyCount}/TS${tsCount}`
}

export async function fetchViewSvgCases(): Promise<ViewSvgCaseDetails[]> {
  const response = await fetch('/api/viewsvg/cases')
  if (!response.ok) {
    throw new Error(`Failed to load viewsvg cases (${response.status})`)
  }
  return (await response.json()) as ViewSvgCaseDetails[]
}

export async function fetchViewSvg(
  caseId: string,
  source: SvgSource,
  extractNr: number,
): Promise<ViewSvgResponse> {
  const params = new URLSearchParams({
    case: caseId,
    source,
    extract: String(extractNr),
  })
  const response = await fetch(`/api/viewsvg/svg?${params.toString()}`)
  if (!response.ok) {
    throw new Error(`Failed to load ${source} SVG for ${caseId} [extract ${extractNr}] (${response.status})`)
  }
  return {
    svg: await response.text(),
    source,
    extractNr,
    caseId,
  }
}
