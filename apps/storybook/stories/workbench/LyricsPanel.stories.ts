import type { Meta, StoryObj } from '@storybook/vue3-vite'

import LyricsPanel from '../../../web/src/workbench/panels/LyricsPanel.vue'

const meta = { title: 'Workbench/Panels/LyricsPanel', component: LyricsPanel, tags: ['autodocs'] } satisfies Meta<typeof LyricsPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    documentText: 'W:La la la',
  },
}
