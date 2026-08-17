import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import InlineTextDiff from '../InlineTextDiff.vue'

describe('InlineTextDiff', () => {
  it('renders inline additions and removals with line numbers', () => {
    const wrapper = mount(InlineTextDiff, {
      props: { oldText: 'M: 3/4\nK: C', newText: 'M: 4/4\nK: C' },
    })

    expect(wrapper.findAll('.inline-text-diff__line')).toHaveLength(2)
    expect(wrapper.findAll('.is-removed').map((node) => node.text())).toContain('3')
    expect(wrapper.findAll('.is-added').map((node) => node.text())).toContain('4')
    expect(wrapper.findAll('.inline-text-diff__number').map((node) => node.text())).toEqual(['1', '1', '2', '2'])
  })
})
