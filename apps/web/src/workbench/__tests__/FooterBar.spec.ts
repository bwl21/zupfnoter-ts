import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import FooterBar from '../FooterBar.vue'

describe('FooterBar', () => {
  it('selects the metronome mode with a select chip', async () => {
    const wrapper = mount(FooterBar, {
      props: {
        extractLabel: 'Extract 0',
        storageLocation: 'Lokal',
        storageReadOnly: false,
        dirty: false,
        saveFormat: 'ABC',
        speedFactor: 1,
        metronomeMode: 'off',
        cursorPosition: '1:1',
        selectionVoiceScope: 'single-voice',
        selectionVoiceScopeSummary: 'Aktuelle Stimme',
      },
    })

    const select = wrapper.get<HTMLSelectElement>('[aria-label="Metronom-Modus"]')
    expect(select.element.value).toBe('off')
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      'Metronom aus',
      'Einzählen',
      'Playback',
      'Immer',
    ])

    await select.setValue('playback')
    expect(wrapper.emitted('metronome-mode-change')).toEqual([['playback']])
  })
})
