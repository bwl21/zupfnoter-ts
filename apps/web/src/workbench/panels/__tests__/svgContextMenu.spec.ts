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

  it('offers flowline reset and deletion actions for a concrete shape', () => {
    const entries = buildSvgContextMenuEntries('extract.0.notebound.flowline.v_1.1536.*', [], {
      resetShapePath: 'extract.0.notebound.flowline.v_1.1536',
      resetShapeValue: { cp1: [0.33, 0], cp2: [0.67, 0] },
      deleteShapePath: 'extract.0.notebound.flowline.v_1.1536',
    })

    expect(entries).toEqual([
      expect.objectContaining({
        text: 'Konfiguration bearbeiten',
        action: 'edit',
        path: 'extract.0.notebound.flowline.v_1.1536',
      }),
      expect.objectContaining({
        text: 'Formung zurücksetzen',
        action: 'reset-shape',
        path: 'extract.0.notebound.flowline.v_1.1536',
        value: { cp1: [0.33, 0], cp2: [0.67, 0] },
      }),
      expect.objectContaining({
        text: 'Formung löschen',
        action: 'delete-shape',
        path: 'extract.0.notebound.flowline.v_1.1536',
      }),
    ])
  })

  it('keeps the legacy placeholder as a disabled separator', () => {
    const [entry] = buildSvgContextMenuEntries(null, [{ text: '---', value: 0.5 }])

    expect(entry).toMatchObject({ action: 'separator', disabled: true, text: '---' })
  })

  it('covers all legacy note and pause menu actions in their legacy order', () => {
    const entries = buildSvgContextMenuEntries(
      'extract.0.notebound.nconf.v_1.t_384.n_0',
      [
        { conf_key: 'extract.0.notebound.nconf.v_1.t_384.nshift', text: 'shift left', value: -0.5 },
        { conf_key: 'extract.0.notebound.nconf.v_1.t_384.nshift', text: 'shift right', value: 0.5 },
        { text: '---', value: 0.5 },
        { conf_key: 'extract.0.notebound.minc.384.minc_f', text: 'Edit Minc' },
        { conf_key: 'extract.0.notebound.minc.384.minc_f', text: 'increase Minc', value: 0.5 },
        { conf_key: 'extract.0.notebound.minc.384.minc_f', text: 'decrease Minc', value: -0.5 },
      ],
    )

    expect(entries.map(({ text, action, path, value }) => ({ text, action, path, value }))).toEqual([
      {
        text: 'Konfiguration bearbeiten',
        action: 'edit',
        path: 'extract.0.notebound.nconf.v_1.t_384',
        value: undefined,
      },
      {
        text: 'shift left',
        action: 'set',
        path: 'extract.0.notebound.nconf.v_1.t_384.nshift',
        value: -0.5,
      },
      {
        text: 'shift right',
        action: 'set',
        path: 'extract.0.notebound.nconf.v_1.t_384.nshift',
        value: 0.5,
      },
      { text: '---', action: 'separator', path: undefined, value: undefined },
      {
        text: 'Edit Minc',
        action: 'edit',
        path: 'extract.0.notebound.minc.384.minc_f',
        value: undefined,
      },
      {
        text: 'increase Minc',
        action: 'set',
        path: 'extract.0.notebound.minc.384.minc_f',
        value: 0.5,
      },
      {
        text: 'decrease Minc',
        action: 'set',
        path: 'extract.0.notebound.minc.384.minc_f',
        value: -0.5,
      },
    ])
  })

  it('covers legacy countnote and barnumber alignment actions', () => {
    const countnoteEntries = buildSvgContextMenuEntries(null, [
      { conf_key: 'extract.0.notebound.countnote.v_1.t_384.align', text: 'countnote left', value: 'l' },
      { conf_key: 'extract.0.notebound.countnote.v_1.t_384.align', text: 'countnote right', value: 'r' },
    ])
    const barnumberEntries = buildSvgContextMenuEntries(null, [
      { conf_key: 'extract.0.notebound.barnumber.v_1.t_384.align', text: 'barnumber left', value: 'l' },
      { conf_key: 'extract.0.notebound.barnumber.v_1.t_384.align', text: 'barnumber right', value: 'r' },
    ])

    expect(countnoteEntries.map(({ action, path, value }) => ({ action, path, value }))).toEqual([
      { action: 'set', path: 'extract.0.notebound.countnote.v_1.t_384.align', value: 'l' },
      { action: 'set', path: 'extract.0.notebound.countnote.v_1.t_384.align', value: 'r' },
    ])
    expect(barnumberEntries.map(({ action, path, value }) => ({ action, path, value }))).toEqual([
      { action: 'set', path: 'extract.0.notebound.barnumber.v_1.t_384.align', value: 'l' },
      { action: 'set', path: 'extract.0.notebound.barnumber.v_1.t_384.align', value: 'r' },
    ])
  })

  it('ignores malformed serialized entries', () => {
    expect(parseSvgContextMenuEntries('[{"text":"ok"},{"text":4},null]')).toEqual([{ text: 'ok' }])
  })
})
