import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SheetObjectIndexEntry } from '@zupfnoter/types'

import HomeView from '../HomeView.vue'
import AbcEditorPanel from '../../workbench/panels/AbcEditorPanel.vue'
import ScorePreviewPanel from '../../workbench/panels/ScorePreviewPanel.vue'
import { useSelectionStore } from '../../stores/selection'
import { resolveScoreSelectionRanges } from '../../workbench/selectionIndex'

describe('HomeView', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the reference sheet panes', async () => {
    vi.useFakeTimers()
    const wrapper = mount(HomeView, {
      global: {
        plugins: [createPinia()],
      },
    })

    expect(wrapper.text()).toContain('ABC-Notation')
    expect(wrapper.text()).toContain('Pdf-Vorschau')
    expect(wrapper.text()).not.toContain('Console')
    expect(wrapper.text()).toContain('Extract 0')
    expect(wrapper.text()).toContain('01:01')
    expect(wrapper.findAll('.zn-zoom-control')).toHaveLength(1)

    expect(wrapper.find('.cm-editor').exists()).toBe(true)

    const editor = wrapper.find('[aria-label="ABC notation editor"]')
    const element = editor.element
    expect(element).toBeInstanceOf(HTMLElement)
    if (element instanceof HTMLElement) {
      expect(element.textContent ?? '').toContain('F:3015_reference_sheet')
    }

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()

    expect(wrapper.find('.preview-stage__svg svg').exists()).toBe(true)
    expect(wrapper.find('.harp-preview__svg svg').exists()).toBe(true)
  })

  it('treats a collapsed editor selection as cursor-only state', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
      },
    })

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()

    const selectionStore = useSelectionStore(pinia)
    const selectableRange = selectionStore.sheetObjectIndex?.entries.find((entry) => entry.addressableIn.editor && entry.textRange !== undefined)?.textRange
    expect(selectableRange).toBeDefined()
    if (selectableRange === undefined) {
      throw new Error('expected an editor-addressable range in sheetObjectIndex')
    }
    expect(selectionStore.selection.selectedIndexes).toEqual([])

    wrapper.findComponent(AbcEditorPanel).vm.$emit('selection-change', {
      startpos: 10,
      endpos: 10,
      start: { line: 2, column: 3 },
      end: { line: 2, column: 3 },
    })
    await nextTick()

    expect(selectionStore.selection.selectedIndexes).toEqual([])

    wrapper.findComponent(AbcEditorPanel).vm.$emit('selection-change', {
      startpos: selectableRange.startpos,
      endpos: selectableRange.endpos,
      start: { line: 2, column: 3 },
      end: { line: 2, column: 5 },
    })
    await nextTick()

    expect(selectionStore.selection.source).toBe('abc-editor')
    expect(selectionStore.selection.selectedIndexes.length).toBeGreaterThan(0)
  })

  it('keeps external score selections as score-originated state', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
      },
    })

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()

    const selectionStore = useSelectionStore(pinia)
    const scoreIndex = selectionStore.sheetObjectIndex?.entries.findIndex((entry) => entry.addressableIn.score && entry.textRange !== undefined) ?? -1
    expect(scoreIndex).toBeGreaterThanOrEqual(0)
    selectionStore.dispatchSelectionEvent({
      type: 'selection.indexes-selected',
      selectedIndexes: [scoreIndex],
      source: 'score-preview',
    })
    await nextTick()

    expect(selectionStore.selection.source).toBe('score-preview')
    expect(selectionStore.selection.selectedIndexes).toEqual([scoreIndex])
  })

  it('extends score selections when the score preview emits a shift-extended selection', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
      },
    })

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()

    const selectionStore = useSelectionStore(pinia)
    const scoreRanges = selectionStore.sheetObjectIndex?.entries
      .filter((entry) => entry.addressableIn.score && entry.textRange !== undefined)
      .map((entry) => entry.textRange)
      .filter((range): range is { startpos: number; endpos: number } => range !== undefined)

    expect(scoreRanges && scoreRanges.length >= 2).toBe(true)
    if (scoreRanges === undefined || scoreRanges.length < 2) {
      throw new Error('expected at least two score-addressable ranges')
    }

    const firstRange = scoreRanges[0]
    const secondRange = scoreRanges[1]
    if (firstRange === undefined || secondRange === undefined) {
      throw new Error('expected two concrete score ranges')
    }

    wrapper.findComponent(ScorePreviewPanel).vm.$emit('select-text-range', {
      ...firstRange,
      extend: false,
      source: 'score-preview',
    })
    await nextTick()

    wrapper.findComponent(ScorePreviewPanel).vm.$emit('select-text-range', {
      ...secondRange,
      extend: true,
      source: 'score-preview',
    })
    await nextTick()

    expect(selectionStore.selection.source).toBe('score-preview')
    expect(resolveScoreSelectionRanges(selectionStore.sheetObjectIndex, selectionStore.selection).length).toBeGreaterThan(1)
  })

  it('keeps the second segment active after projecting it into the ABC editor', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    const wrapper = mount(HomeView, {
      global: {
        plugins: [pinia],
      },
    })

    await vi.advanceTimersByTimeAsync(300)
    await nextTick()

    const selectionStore = useSelectionStore(pinia)
    const entriesByVoice = new Map<string, SheetObjectIndexEntry[]>()
    selectionStore.sheetObjectIndex?.entries.forEach((entry) => {
      if (entry.kind !== 'music-entity' || entry.voiceId === undefined || entry.textRange === undefined) return
      const entries = entriesByVoice.get(entry.voiceId) ?? []
      if (!entries.some((candidate) => (
        candidate.textRange?.startpos === entry.textRange?.startpos
        && candidate.textRange?.endpos === entry.textRange?.endpos
      ))) entries.push(entry)
      entriesByVoice.set(entry.voiceId, entries)
    })
    const entries = [...entriesByVoice.values()].find((candidates) => candidates.length >= 3)
    expect(entries).toBeDefined()
    if (entries === undefined) throw new Error('expected three selectable entries in one voice')
    const [first, second, third] = entries
    if (first?.textRange === undefined || second?.textRange === undefined || third?.textRange === undefined) {
      throw new Error('expected concrete text ranges')
    }

    const scorePreview = wrapper.findComponent(ScorePreviewPanel)
    scorePreview.vm.$emit('select-text-range', {
      ...first.textRange,
      extend: false,
      startNewSegment: false,
      origin: { voiceId: first.voiceId, musicTime: first.musicTime, znId: first.znId },
      source: 'score-preview',
    })
    await nextTick()
    scorePreview.vm.$emit('select-text-range', {
      ...second.textRange,
      extend: false,
      startNewSegment: true,
      origin: { voiceId: second.voiceId, musicTime: second.musicTime, znId: second.znId },
      source: 'score-preview',
    })
    await nextTick()
    scorePreview.vm.$emit('select-text-range', {
      ...third.textRange,
      extend: true,
      startNewSegment: false,
      origin: { voiceId: third.voiceId, musicTime: third.musicTime, znId: third.znId },
      source: 'score-preview',
    })
    await nextTick()

    expect(selectionStore.selection.activeSegmentIndex).toBe(1)
    expect(selectionStore.selection.segments?.[0]?.textRanges?.[0]?.startpos)
      .toBe(first.textRange.startpos)
    const activeSegment = selectionStore.selection.segments?.[1]
    const activeAnchor = activeSegment?.anchorIndex === undefined
      ? undefined
      : selectionStore.sheetObjectIndex?.entries[activeSegment.anchorIndex]
    expect(activeAnchor?.kind).toBe('music-entity')
    expect(activeAnchor?.voiceId).toBe(second.voiceId)
    expect(activeAnchor?.musicTime).toBe(second.musicTime)
    expect(activeSegment?.selectedIndexes).toContain(selectionStore.sheetObjectIndex?.entries.indexOf(second) ?? -1)
    expect(activeSegment?.selectedIndexes).toContain(selectionStore.sheetObjectIndex?.entries.indexOf(third) ?? -1)
  })
})
