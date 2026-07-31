import { describe, expect, it } from 'vitest'

import type { SheetObjectIndex } from '@zupfnoter/types'

import { resolveConfKeyForConfigPath, resolveIndexesByConfigPath } from '../selectionIndex'

const index: SheetObjectIndex = {
  version: 1,
  lineStarts: [0],
  voiceByLine: {},
  byZnId: {},
  byConfKey: {
    'extract.0.notebound.flowline.v_1.1536.*': [0],
    'extract.0.notebound.nconf.v_1.t_384.n_0.***': [1],
  },
  byTextRange: {},
  byMusicTime: {},
  entries: [
    {
      kind: 'sheet-object',
      confKey: 'extract.0.notebound.flowline.v_1.1536.*',
      addressableIn: { editor: false, score: false, svg: true },
    },
    {
      kind: 'sheet-object',
      confKey: 'extract.0.notebound.nconf.v_1.t_384.n_0.***',
      addressableIn: { editor: false, score: false, svg: true },
    },
  ],
}

describe('selectionIndex config path resolution', () => {
  it('resolves flowline control-point paths to the editable flowline', () => {
    const path = 'extract.0.notebound.flowline.v_1.1536.cp1'

    expect(resolveConfKeyForConfigPath(index, path)).toBe('extract.0.notebound.flowline.v_1.1536.*')
    expect(resolveIndexesByConfigPath(index, path)).toEqual([0])
  })

  it('resolves note configuration fields to the note drawable', () => {
    expect(resolveIndexesByConfigPath(index, 'extract.0.notebound.nconf.v_1.t_384.n_0.nshift')).toEqual([1])
  })
})
