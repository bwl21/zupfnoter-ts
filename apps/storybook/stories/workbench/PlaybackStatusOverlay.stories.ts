import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PlaybackStatusOverlay from '../../../web/src/workbench/PlaybackStatusOverlay.vue'

const meta = {
  title: 'Workbench/PlaybackStatusOverlay',
  component: PlaybackStatusOverlay,
  tags: ['autodocs'],
  decorators: [() => ({ template: '<div style="position:relative;height:8rem;margin-top:3rem"><story /></div>' })],
} satisfies Meta<typeof PlaybackStatusOverlay>

export default meta
type Story = StoryObj<typeof meta>

export const WithMetronome: Story = {
  args: {
    measureNumber: 15,
    partName: 'Teil A mit einem sehr langen Abschnittsnamen',
    passIndex: 2,
    metronomeBeat: { beat: 3, division: 4, accent: false, pulse: 1 },
  },
}

export const MeasureAccent: Story = {
  args: {
    measureNumber: 1,
    partName: 'Teil A',
    passIndex: 1,
    metronomeBeat: { beat: 1, division: 4, accent: true, pulse: 1 },
  },
}
