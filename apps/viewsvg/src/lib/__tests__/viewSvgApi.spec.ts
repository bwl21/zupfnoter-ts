import { describe, expect, it, vi, afterEach } from 'vitest'

import {
  fetchViewSvg,
  fetchViewSvgCases,
  getCaseLabel,
} from '../viewSvgApi'

describe('viewSvgApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('formats case labels from extract counts', () => {
    expect(getCaseLabel({
      id: 'case-a',
      legacyExtracts: [0, 1, 2],
      tsExtracts: [0, 2],
    })).toBe('case-a · L3/TS2')
  })

  it('loads case metadata from the api', async () => {
    const json = [{ id: 'case-a', legacyExtracts: [0], tsExtracts: [0], legacySvgCount: 1, tsSvgCount: 1 }]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(json), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch)

    await expect(fetchViewSvgCases()).resolves.toEqual(json)
    expect(fetch).toHaveBeenCalledWith('/api/viewsvg/cases')
  })

  it('loads svg markup for a selected case and extract', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<svg />', {
      status: 200,
      headers: { 'content-type': 'image/svg+xml' },
    })) as typeof fetch)

    await expect(fetchViewSvg('case-a', 'legacy', 3)).resolves.toEqual({
      svg: '<svg />',
      source: 'legacy',
      extractNr: 3,
      caseId: 'case-a',
    })
    expect(fetch).toHaveBeenCalledWith('/api/viewsvg/svg?case=case-a&source=legacy&extract=3')
  })
})
