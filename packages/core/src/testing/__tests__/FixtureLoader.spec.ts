import { describe, expect, it } from 'vitest'

import { fixtureConfigFromAbc, fixtureAbcPath, loadFixture, scanFixtureCases } from '../fixtureLoader.js'
import { defaultTestConfig } from '../defaultConfig.js'
import { formatOpenImplementations, getOpenImplementations } from '../openImplementations.js'

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
    expect(fixture.sheet?.children.length).toBeGreaterThan(0)
  })

  it('formats the global open-implementation registry by stage', () => {
    const openSheetImplementations = getOpenImplementations('sheet')
    const formatted = formatOpenImplementations(openSheetImplementations)

    expect(openSheetImplementations.length).toBeGreaterThan(0)
    expect(formatted).toContain('Open implementations for this stage:')
    expect(formatted).toContain('sheet.barnumbers-config')
  })

  it('discovers fixture cases from test case directories', () => {
    const cases = scanFixtureCases()

    expect(cases.map((testCase) => testCase.id)).toContain('single_note')
    expect(cases.map((testCase) => testCase.id)).toContain('Twostaff')
    expect(cases.find((testCase) => testCase.id === 'single_note')?.hasSongFixture).toBe(true)
    expect(cases.find((testCase) => testCase.id === 'single_note')?.hasSheetFixture).toBe(true)
  })
})
