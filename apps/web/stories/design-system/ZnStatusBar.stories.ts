import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ZnBadge from '../../src/design-system/components/ZnBadge.vue'
import ZnStatusBar from '../../src/design-system/components/ZnStatusBar.vue'

const meta = { title: 'Design System/ZnStatusBar', component: ZnStatusBar, tags: ['autodocs'] } satisfies Meta<typeof ZnStatusBar>
export default meta
type Story = StoryObj<typeof meta>

export const StorageStatus: Story = { render: () => ({ components: { ZnBadge, ZnStatusBar }, template: '<ZnStatusBar><ZnBadge tone="success">Privat</ZnBadge><template #aside><ZnBadge tone="info">A4</ZnBadge><ZnBadge tone="accent">Bereit</ZnBadge></template></ZnStatusBar>' }) }

