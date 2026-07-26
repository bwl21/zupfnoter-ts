import { describe, expect, it } from 'vitest'

import { buildSvgContextMenuEntries, parseSvgContextMenuEntries } from '../svgContextMenu'

describe('svgContextMenu', () => {
  it('creates the legacy edit action and value actions', () => {
    const entries = buildSvgContextMenuEntries('extract.0.note.pos', [
      { conf_key: 'extract.0.note.nshift', text: 'shift right', value: 0.5 },
      { conf_key: 'extract.0.note.minc', text: 'Edit Minc' },
    ])

    expect(entries).toEqual([
      expect.objectContaining({ action: 'edit', path: 'extract.0.note' }),
      expect.objectContaining({ action: 'set', path: 'extract.0.note.nshift', value: 0.5 }),
      expect.objectContaining({ action: 'edit', path: 'extract.0.note', disabled: false }),
    ])
  })

  it('keeps the visibility help path while opening the parent editor', () => {
    const entries = buildSvgContextMenuEntries('extract.0.annotations.7.pos', [], {
      visibilityPath: 'extract.0.annotations.7.show',
    })
    const entry = entries[1]

    expect(entry).toMatchObject({
      action: 'edit',
      path: 'extract.0.annotations.7',
      helpPath: 'extract.0.annotations.7.show',
    })
  })

  it('keeps the minc leaf when opening the dynamic minc editor', () => {
    const entries = buildSvgContextMenuEntries(null, [
      { conf_key: 'extract.0.notebound.minc.4224.minc_f', text: 'Edit Minc' },
    ])

    expect(entries[0]).toMatchObject({
      action: 'edit',
      path: 'extract.0.notebound.minc.4224.minc_f',
    })
  })

  it('keeps the legacy placeholder as a disabled separator', () => {
    const [entry] = buildSvgContextMenuEntries(null, [{ text: '---', value: 0.5 }])

    expect(entry).toMatchObject({ action: 'separator', disabled: true, text: '---' })
  })

  it('ignores malformed serialized entries', () => {
    expect(parseSvgContextMenuEntries('[{"text":"ok"},{"text":4},null]')).toEqual([{ text: 'ok' }])
  })
})
