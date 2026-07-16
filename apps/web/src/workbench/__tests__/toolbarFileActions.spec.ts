import { describe, expect, it } from 'vitest'

import {
  FILE_TOOLBAR_MENU_ITEMS,
  fileToolbarPlaceholderMessage,
  isFileToolbarActionDisabled,
} from '../toolbarFileActions'

describe('file toolbar actions', () => {
  it('keeps document shortcuts and file menu actions in the defined order', () => {
    expect(FILE_TOOLBAR_MENU_ITEMS.map((item) => item.type === 'action' ? item.action : 'separator')).toEqual([
      'new',
      'open',
      'save',
      'separator',
      'import',
      'download',
      'separator',
      'storage-connections',
    ])
  })

  it('disables saving until a complete storage target exists', () => {
    expect(isFileToolbarActionDisabled('save', false)).toBe(true)
    expect(isFileToolbarActionDisabled('save', true)).toBe(false)
    expect(isFileToolbarActionDisabled('open', false)).toBe(false)
  })

  it('provides a visible status message for unfinished actions', () => {
    expect(fileToolbarPlaceholderMessage('open')).toContain('Phase 5.6')
    expect(fileToolbarPlaceholderMessage('storage-connections')).toBeUndefined()
    expect(fileToolbarPlaceholderMessage('new')).toBeUndefined()
    expect(fileToolbarPlaceholderMessage('download')).toBeUndefined()
  })
})
