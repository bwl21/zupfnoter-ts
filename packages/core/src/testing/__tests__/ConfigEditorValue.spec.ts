import { describe, expect, it } from 'vitest'

import {
  formatConfigEditorValue,
  parseConfigEditorValue,
  serializeConfigEditorValue,
} from '../../configEditorValue.js'

describe('config editor value conversion', () => {
  it('ports the legacy integer-list conversion for produce', () => {
    expect(serializeConfigEditorValue('produce', '0, 2')).toBe('[0,2]')
  })

  it('ports the legacy integer-pair conversion for synchronization lines', () => {
    expect(formatConfigEditorValue('extract.0.synchlines', [[1, 2], [3, 4]])).toBe('1-2, 3-4')
    expect(serializeConfigEditorValue('extract.0.synchlines', '1-2, 2-3')).toBe('[[1,2],[2,3]]')
  })

  it('uses editor metadata for compact array display', () => {
    expect(formatConfigEditorValue('extract.0.voices', [1, 3])).toBe('1, 3')
    expect(formatConfigEditorValue('extract.0.synchlines', [[1, 2], [3, 4]])).toBe('1-2, 3-4')
    expect(formatConfigEditorValue('extract.0.notebound.annotation.v_1.1.pos', [10, 20])).toBe('10, 20')
  })

  it('derives scalar and nested array values from the schema', () => {
    expect(parseConfigEditorValue('produce', '0, 2')).toEqual({ value: [0, 2] })
    expect(parseConfigEditorValue('extract.0.synchlines', '1-2, 2-3')).toEqual({ value: [[1, 2], [2, 3]] })
  })

  it('rejects malformed values instead of coercing them', () => {
    expect(parseConfigEditorValue('produce', '0, nope')).toEqual({ error: 'Bitte eine ganze Zahl eingeben.' })
    expect(parseConfigEditorValue('extract.0.synchlines', '1-2-3')).toEqual({
      error: 'Paarwerte bitte als „erste-zweite“ eingeben.',
    })
  })
})
