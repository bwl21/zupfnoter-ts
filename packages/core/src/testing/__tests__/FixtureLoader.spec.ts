import { describe, expect, it } from 'vitest'

import {
  fixtureConfigFromAbc,
  fixtureAbcPath,
  getSheetFixtureTargets,
  loadFixture,
  loadSongFixture,
  loadSheetExtractFixture,
  resolveFixtureSheetRenderTarget,
  scanFixtureCases,
} from '../fixtureLoader.js'
import { defaultTestConfig } from '../defaultConfig.js'
import { formatOpenImplementations, getOpenImplementations } from '../../../../../fixtures/openImplementations.js'

describe('fixtureLoader', () => {
  it('resolves fixture ABC paths by test case name', () => {
    expect(fixtureAbcPath('single_note')).toBe('fixtures/cases/single_note/input.abc')
    expect(fixtureAbcPath('Twostaff')).toBe('fixtures/cases/Twostaff/input.abc')
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

  it('loads input, effective config, and stage references as one fixture set', () => {
    const fixture = loadFixture('single_note')

    expect(fixture.input.abc).toContain('T:Single Note Test')
    expect(fixture.config.layout.SHORTEST_NOTE).toBe(defaultTestConfig.layout.SHORTEST_NOTE)
    expect(fixture.song?.voices.length).toBeGreaterThan(0)
    expect(Object.keys(fixture.sheetExtracts)).toContain('0')
    expect(fixture.sheetExtracts['0']?.children.length).toBeGreaterThan(0)
  })

  it('uses extract-specific sheet fixtures when present', () => {
    const fixture = loadFixture('3015_reference_sheet')
    const targets = getSheetFixtureTargets(fixture)

    expect(Object.keys(fixture.sheetExtracts)).toContain('0')
    expect(targets.map((target) => target.extractNr)).toEqual([0])
    expect(targets[0]?.expected).toEqual(loadSheetExtractFixture('3015_reference_sheet', 0))
  })

  it('loads song fixtures from song.extract-0.json', () => {
    const fixture = loadFixture('repeat')

    expect(fixture.song?.beat_maps).toEqual(loadSongFixture('repeat').beat_maps)
    expect(fixture.song?.beat_maps).toEqual([{ '0': 0, '48': 48, '96': 96, '144': 144 }])
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

    expect(openSheetImplementations.length).toBeGreaterThan(0)
    expect(formatted).toContain('Open implementations for this stage (')
    expect(formatted).toContain('sheet.barnumbers-config')
    expect(formatted).toContain('Entries:')
    expect(formatted).toContain('fixtures: 3015_reference_sheet')
    expect(formatted).toContain('prompt: Investigate barnumber config parity')
  })

  it('discovers fixture cases from test case directories', () => {
    const cases = scanFixtureCases()

    expect(cases.map((testCase) => testCase.id)).toContain('single_note')
    expect(cases.map((testCase) => testCase.id)).toContain('Twostaff')
    expect(cases.find((testCase) => testCase.id === 'single_note')?.hasSongFixture).toBe(true)
    expect(cases.find((testCase) => testCase.id === 'single_note')?.hasSheetFixture).toBe(true)
  })
})
