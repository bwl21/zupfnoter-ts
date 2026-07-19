import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ZnTabs from '../../src/design-system/components/ZnTabs.vue'

const items = [{ id: 'abc', label: 'ABC-Notation' }, { id: 'lyrics', label: 'Liedtexte', badge: '3' }, { id: 'config', label: 'Konfiguration' }]
const meta = { title: 'Design System/ZnTabs', component: ZnTabs, tags: ['autodocs'], argTypes: { modelValue: { control: 'select', options: items.map((item) => item.id) } } } satisfies Meta<typeof ZnTabs>
export default meta
type Story = StoryObj<typeof meta>

export const WithBadge: Story = { render: (args) => ({ components: { ZnTabs }, setup: () => ({ args, items }), template: '<div style="min-height:8rem"><ZnTabs v-bind="args" :items="items"><template #default="{ activeItem }"><p style="margin:0">Aktiv: {{ activeItem?.label }}</p></template></ZnTabs></div>' }), args: { modelValue: 'abc', items } }

