import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'

import { buildSyntaxDecorations } from '../abcEditorCodeMirror'

function syntaxRanges(text: string): Array<{ from: number; to: number; className: string | undefined }> {
  const state = EditorState.create({ doc: text })
  const ranges: Array<{ from: number; to: number; className: string | undefined }> = []
  buildSyntaxDecorations(state).between(0, state.doc.length, (from, to, decoration) => {
    ranges.push({ from, to, className: decoration.spec.class })
  })
  return ranges
}

describe('ABC syntax decorations', () => {
  it('does not color pitch letters inside inline part annotations', () => {
    const text = 'C D E [P:part 2] | G A B c |]'
    const ranges = syntaxRanges(text)
    const partStart = text.indexOf('[P:part 2]')
    const partEnd = partStart + '[P:part 2]'.length

    expect(ranges.some((range) => range.className === 'cm-abc-note'
      && range.from >= partStart && range.to <= partEnd)).toBe(false)
    expect(ranges.some((range) => range.className === 'cm-abc-inline-header'
      && range.from === partStart && range.to === partEnd)).toBe(true)
    expect(ranges.some((range) => range.className === 'cm-abc-note'
      && range.from === text.indexOf('C'))).toBe(true)
    expect(ranges.some((range) => range.className === 'cm-abc-note'
      && range.from === text.indexOf('G'))).toBe(true)
  })
})
