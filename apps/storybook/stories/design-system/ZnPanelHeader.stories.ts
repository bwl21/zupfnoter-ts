import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnButton, ZnPanelHeader } from '@zupfnoter/design-system'

const meta = { title: 'Design System/ZnPanelHeader', component: ZnPanelHeader, tags: ['autodocs'], parameters: { docs: { description: { component: 'Wiederverwendbarer Panel-Kopf mit Eyebrow, Titel, Untertitel und optionalen Aktionen im `actions`-Slot.' } } } } satisfies Meta<typeof ZnPanelHeader>
export default meta
type Story = StoryObj<typeof meta>

export const Standard: Story = { args: { eyebrow: 'Vorschau', title: 'Harfennoten', subtitle: 'Aktueller Auszug' } }
export const WithAction: Story = { render: (args) => ({ components: { ZnButton, ZnPanelHeader }, setup: () => ({ args }), template: '<ZnPanelHeader v-bind="args"><template #actions><ZnButton variant="ghost">Aktualisieren</ZnButton></template></ZnPanelHeader>' }), args: { eyebrow: 'Ausgabe', title: 'PDF', subtitle: 'Export und Vorschau' } }
