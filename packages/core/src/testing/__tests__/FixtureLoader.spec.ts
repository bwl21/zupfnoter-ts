import { describe, expect, it } from 'vitest'
import { extractSongConfig, extractSongFilebase, extractSongResources, replaceSongDocumentAbc, replaceSongDocumentResources, splitSongDocument } from '../../extractSongConfig.js'
import {
  fixtureConfigFromAbc,
  fixtureAbcPath,
  getOutputSvgFixtureTargets,
  getSheetFixtureTargets,
  loadFixture,
  readFixtureAbc,
  loadSongFixture,
  loadSheetExtractFixture,
  songToFixture,
  resolveFixtureSheetRenderTarget,
  scanFixtureCases,
  transformFixtureToSong,
  transformFixtureToSheet,
  validateFixtureAbcPreconditions,
} from '../fixtureLoader.js'
import { normalizeRawSongFixture } from '../semanticMatch.js'
import { defaultTestConfig } from '../defaultConfig.js'
import { formatOpenImplementations, getOpenImplementations } from '../openImplementations.js'

describe('fixtureLoader', () => {
  const KNOWN_COMPACT_SLUR_CLOSE_FIXTURES = [
    '3015_reference_sheet',
    'abc-to-song-slur-tuplet-parity',
  ]

  it('resolves fixture ABC paths by test case name', () => {
    expect(fixtureAbcPath('single_note')).toBe('fixtures/cases/public/single_note/input.abc')
  })

  it('uses default config when ABC has no zupfnoter config block', () => {
    const config = fixtureConfigFromAbc('X:1\nT:No Config\nK:C\nC\n')

    expect(config.layout.SHORTEST_NOTE).toBe(defaultTestConfig.layout.SHORTEST_NOTE)
    expect(config.layout.ELLIPSE_SIZE).toEqual(defaultTestConfig.layout.ELLIPSE_SIZE)
  })

  it('merges embedded zupfnoter config over defaults', () => {
    const config = fixtureConfigFromAbc(
      [
        'X:1',
        'T:Inline Config',
        'K:C',
        'C',
        '%%%%zupfnoter.config',
        '{"layout":{"SHORTEST_NOTE":32},"extract":{"0":{"voices":[2]}}}',
      ].join('\n'),
    )

    expect(config.layout.SHORTEST_NOTE).toBe(32)
    expect(config.layout.ELLIPSE_SIZE).toEqual(defaultTestConfig.layout.ELLIPSE_SIZE)
    expect(config.extract['0']?.voices).toEqual([2])
  })

  it('separates embedded configuration from the ABC editor text and preserves it on edits', () => {
    const documentText = [
      'X:1',
      'T:Inline Config',
      'K:C',
      'C',
      '%%%%zupfnoter.config',
      '{"extract":{"0":{"voices":[2]}}}',
    ].join('\n')

    expect(splitSongDocument(documentText)).toEqual({
      abcText: 'X:1\nT:Inline Config\nK:C\nC\n',
      zupfnoterSections: '%%%%zupfnoter.config\n{"extract":{"0":{"voices":[2]}}}',
    })
    expect(replaceSongDocumentAbc(documentText, 'X:2\nT:Edited\nK:G\nG\n')).toBe([
      'X:2',
      'T:Edited',
      'K:G',
      'G',
      '%%%%zupfnoter.config',
      '{"extract":{"0":{"voices":[2]}}}',
    ].join('\n'))
    expect(extractSongFilebase('F:save-as-this\nC\n%%%%zupfnoter.config\n{}')).toBe('save-as-this')
    expect(extractSongFilebase(documentText)).toBeUndefined()
  })

  it('keeps open embedded legacy overlay branches open during config extraction', () => {
    expect(() => extractSongConfig(
      [
        'X:1',
        'T:Inline Config',
        'K:C',
        'C',
        '%%%%zupfnoter.config',
        '{"extract":{"0":{"printer":{"showBorder":false}}}}',
      ].join('\n'),
    )).not.toThrow()
  })

  it('stores image resources in a separate document section', () => {
    const documentText = [
      'X:1',
      'K:C',
      'C',
      '%%%%zupfnoter.config',
      '{"extract":{"0":{"voices":[1]}}}',
    ].join('\n')
    const resources = { 'cover.jpg': ['data:image/jpeg;base64,', 'abc'] as const }
    const withResources = replaceSongDocumentResources(documentText, resources)

    expect(extractSongConfig(withResources)).toEqual({ extract: { '0': { voices: [1] } } })
    expect(extractSongResources(withResources)).toEqual(resources)
    expect(withResources).toContain('%%%%zupfnoter.resources')
    expect(withResources).not.toContain('"$resources"')
  })

  it('loads input, effective config, and stage references as one fixture set', () => {
    const fixture = loadFixture('single_note')

    expect(fixture.input.abc).toContain('T:Single Note Test')
    expect(fixture.config.layout.SHORTEST_NOTE).toBe(defaultTestConfig.layout.SHORTEST_NOTE)
    expect(fixture.song).not.toBeNull()
    expect(Object.keys(fixture.sheetExtracts)).toContain('0')
    expect(fixture.sheetExtracts['0']?.children.length).toBeGreaterThan(0)
    expect(Object.keys(fixture.outputSvgExtracts)).toContain('0')
    expect(fixture.outputSvgExtracts['0']).toContain('<svg')
  })

  it('uses extract-specific sheet fixtures when present', () => {
    const fixture = loadFixture('3015_reference_sheet')
    const targets = getSheetFixtureTargets(fixture)

    expect(Object.keys(fixture.sheetExtracts)).toContain('0')
    expect(targets.map((target) => target.extractNr)).toEqual([0])
    expect(targets[0]?.expected).toEqual(loadSheetExtractFixture('3015_reference_sheet', 0))
  })

  it('uses extract-specific svg fixtures when present and falls back to extract 0 legacy naming', () => {
    const singleNoteFixture = loadFixture('single_note')
    expect(getOutputSvgFixtureTargets(singleNoteFixture).map((target) => target.extractNr)).toEqual([0])

    const fixtureWithLegacySvgName = {
      ...singleNoteFixture,
      outputSvgExtracts: { '0': '<svg />' },
    }

    expect(getOutputSvgFixtureTargets(fixtureWithLegacySvgName)).toEqual([
      { extractNr: 0, expected: '<svg />' },
    ])
  })

  it('loads song fixtures from song.legacy-raw.json', () => {
    const fixture = loadFixture('repeat')

    expect(fixture.song).not.toBeNull()
    const normalized = normalizeRawSongFixture(fixture.song)
    const expected = normalizeRawSongFixture(loadSongFixture('repeat'))
    expect(normalized.beat_maps).toEqual(expected.beat_maps)
  })

  it('preserves znId in generated song and sheet fixtures', () => {
    const fixture = loadFixture('single_note')
    const songFixture = transformFixtureToSong(fixture)
    const sheetFixture = transformFixtureToSheet(fixture, 0)

    expect(songFixture.voices[0]?.entities.some((entity) => entity.znId === '0')).toBe(true)
    expect(sheetFixture.children.some((child) => child.znId === '0')).toBe(true)
  })

  it('matches legacy tuplet marker handling in song fixtures', () => {
    const singleNoteFixture = transformFixtureToSong(loadFixture('single_note'))
    const singleNote = singleNoteFixture.voices
      .flatMap((voice) => voice.entities)
      .find((entity) => entity.type === 'Note')

    expect(singleNote?.tupletStart).toBeUndefined()
    expect(singleNote?.tupletEnd).toBeUndefined()

    const tupletFixture = transformFixtureToSong(loadFixture('tuplet'))
    const tupletNotes = tupletFixture.voices
      .flatMap((voice) => voice.entities)
      .filter((entity) => entity.type === 'Note' && 'tuplet' in entity && entity.tuplet === 3)

    expect(tupletNotes.some((entity) => entity.tupletStart === true)).toBe(true)
    expect(tupletNotes.some((entity) => entity.tupletStart === false)).toBe(true)
    expect(tupletNotes.some((entity) => entity.tupletEnd === true)).toBe(true)
  })

  it('loads extract-specific sheet fixtures for simple single-extract cases', () => {
    const fixture = loadFixture('single_note')
    const targets = getSheetFixtureTargets(fixture)

    expect(Object.keys(fixture.sheetExtracts)).toEqual(['0'])
    expect(targets.map((target) => target.extractNr)).toEqual([0])
    expect(targets[0]?.expected).toEqual(fixture.sheetExtracts['0'])
  })

  it('keeps sheet fixture rendering on the legacy edit-view target', () => {
    const config = fixtureConfigFromAbc(
      [
        'X:1',
        'T:Produced Extract',
        'K:C',
        'C',
        '%%%%zupfnoter.config',
        '{"produce":[2,3],"extract":{"0":{"voices":[1]},"2":{"voices":[2]},"3":{"voices":[3]}}}',
      ].join('\n'),
    )

    expect(resolveFixtureSheetRenderTarget(config)).toEqual({
      extractNr: 0,
      pageFormat: 'A4',
    })
  })

  it('falls back to extract 0 when produce is missing', () => {
    const config = fixtureConfigFromAbc('X:1\nT:No Produce\nK:C\nC\n')

    expect(resolveFixtureSheetRenderTarget(config)).toEqual({
      extractNr: 0,
      pageFormat: 'A4',
    })
  })

  it('formats the global open-implementation registry by stage', () => {
    const openSheetImplementations = getOpenImplementations('sheet')
    const formatted = formatOpenImplementations(openSheetImplementations)
    const firstImplementation = openSheetImplementations[0]
    if (!firstImplementation) {
      expect(openSheetImplementations).toEqual([])
      expect(formatted).toBe('')
      return
    }

    expect(formatted).toContain('Open implementations for this stage (')
    expect(formatted).toContain(firstImplementation.id)
    expect(formatted).toContain('Entries:')
    if (firstImplementation.fixtures?.length) {
      expect(formatted).toContain(`fixtures: ${firstImplementation.fixtures.join(', ')}`)
    }
    if (firstImplementation.prompt) {
      expect(formatted).toContain(`prompt: ${firstImplementation.prompt}`)
    }
  })

  it('discovers fixture cases from test case directories', () => {
    const cases = scanFixtureCases()

    expect(cases.map((testCase) => testCase.id)).toContain('single_note')
    expect(cases.find((testCase) => testCase.id === 'single_note')?.hasSongFixture).toBe(true)
    expect(cases.find((testCase) => testCase.id === 'single_note')?.hasSheetFixture).toBe(true)
    expect(cases.find((testCase) => testCase.id === 'single_note')?.hasOutputSvgFixture).toBe(true)
  })

  it('accepts whitespace-separated slur-close tokens in fixture ABC input', () => {
    const issues = validateFixtureAbcPreconditions(
      [
        'X:1',
        'T:Spaced Slur Close',
        'K:C',
        '%%score (V1)',
        'V:V1',
        '[V:V1] A )) |]',
      ].join('\n'),
    )

    expect(issues).toEqual([])
  })

  it('rejects compact slur-close tokens in fixture ABC input with a clear remediation hint', () => {
    const issues = validateFixtureAbcPreconditions(
      [
        'X:1',
        'T:Compact Slur Close',
        'K:C',
        '%%score (V1)',
        'V:V1',
        '[V:V1] A)) |]',
      ].join('\n'),
    )

    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('A))')
    expect(issues[0]).toContain('A ))')
  })

  it('tracks the current baseline of fixture ABC cases with compact slur-close tokens', () => {
    const violatingFixtures = scanFixtureCases()
      .map((testCase) => ({
        id: testCase.id,
        issues: validateFixtureAbcPreconditions(readFixtureAbc(testCase.id)),
      }))
      .filter((entry) => entry.issues.length > 0)

    expect(violatingFixtures.map((entry) => entry.id).sort()).toEqual(
      [...KNOWN_COMPACT_SLUR_CLOSE_FIXTURES].sort(),
    )
    const allIssuesContainRemediationHint = violatingFixtures
      .flatMap((entry) => entry.issues)
      .every((issue) => issue.includes('A ))'))
    expect(allIssuesContainRemediationHint).toBe(true)
  })
})
