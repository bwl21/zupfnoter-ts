import { describe, expect, it } from 'vitest'

import { formatConfigEditorValue, serializeConfigEditorValue } from '../../configEditorValue.js'

describe('config editor value conversion', () => {
  it('ports the legacy integer-list conversion for produce', () => {
    expect(serializeConfigEditorValue('produce', '0, 2')).toBe('[0,2]')
  })

  it('ports the legacy integer-pair conversion for synchronization lines', () => {
    expect(formatConfigEditorValue('extract.0.synchlines', [[1, 2], [3, 4]])).toBe('1-2, 3-4')
    expect(serializeConfigEditorValue('extract.0.synchlines', '1-2, 2-3')).toBe('[[1,2],[2,3]]')
  })
})
