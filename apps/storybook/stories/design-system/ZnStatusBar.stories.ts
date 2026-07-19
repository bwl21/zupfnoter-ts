import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnBadge, ZnStatusBar } from '@zupfnoter/design-system'

const meta = { title: 'Design System/ZnStatusBar', component: ZnStatusBar, tags: ['autodocs'], parameters: { docs: { description: { component: 'Horizontale Statusleiste für dauerhafte Kontextinformationen. Der Hauptinhalt liegt im Default-Slot, zusätzliche Angaben kommen in den `aside`-Slot.' } } } } satisfies Meta<typeof ZnStatusBar>
export default meta
type Story = StoryObj<typeof meta>

export const StorageStatus: Story = { render: () => ({ components: { ZnBadge, ZnStatusBar }, template: '<ZnStatusBar><ZnBadge tone="success">Privat</ZnBadge><template #aside><ZnBadge tone="info">A4</ZnBadge><ZnBadge tone="accent">Bereit</ZnBadge></template></ZnStatusBar>' }) }
