import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnTabs } from '@zupfnoter/design-system'

const items = [{ id: 'abc', label: 'ABC-Notation' }, { id: 'lyrics', label: 'Liedtexte', badge: '3' }, { id: 'config', label: 'Konfiguration' }]
const meta: Meta<typeof ZnTabs> = { title: 'Design System/ZnTabs', component: ZnTabs, tags: ['autodocs'], parameters: { docs: { description: { component: 'Tab-Navigation für gleichrangige Inhaltsbereiche. `modelValue` enthält die ID des aktiven Tabs; über den Default-Slot stehen `activeId` und `activeItem` zur Verfügung.' } } }, argTypes: { modelValue: { control: 'select', options: items.map((item) => item.id) } } }
export default meta
type Story = StoryObj<typeof meta>

export const WithBadge: Story = { render: (args) => ({ components: { ZnTabs }, setup: () => ({ args, items }), template: '<div style="min-height:8rem"><ZnTabs v-bind="args" :items="items"><template #default="{ activeItem }"><p style="margin:0">Aktiv: {{ activeItem?.label }}</p></template></ZnTabs></div>' }), args: { modelValue: 'abc', items } }
