import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchViewPdfCases, getPdfCaseLabel, viewPdfUrl } from '../viewPdfApi'

describe('viewPdfApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('formats case labels from PDF extract counts', () => {
    expect(getPdfCaseLabel({
      id: 'case-a',
      legacyExtracts: [0, 1],
      tsExtracts: [0],
    })).toBe('case-a · L2/TS1')
  })

  it('loads PDF case metadata from the API', async () => {
    const json = [{ id: 'case-a', legacyExtracts: [0], tsExtracts: [0], legacyPdfCount: 1, tsPdfCount: 1 }]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(json), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch)

    await expect(fetchViewPdfCases()).resolves.toEqual(json)
    expect(fetch).toHaveBeenCalledWith('/api/viewpdf/cases')
  })

  it('builds a PDF endpoint for the selected source and extract', () => {
    expect(viewPdfUrl('case a', 'ts', 3)).toBe('/api/viewpdf/pdf?case=case+a&source=ts&extract=3')
  })
})
