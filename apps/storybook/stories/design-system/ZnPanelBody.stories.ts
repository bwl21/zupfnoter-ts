import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnPanelBody } from '@zupfnoter/design-system'

const meta = { title: 'Design System/ZnPanelBody', component: ZnPanelBody, tags: ['autodocs'], parameters: { docs: { description: { component: 'Inhaltsbereich für Panel-Kompositionen. Nutze die Komponente, wenn der Panel-Inhalt unabhängig von Header und Footer strukturiert werden soll.' } } } } satisfies Meta<typeof ZnPanelBody>
export default meta
type Story = StoryObj<typeof meta>

export const Content: Story = { render: () => ({ components: { ZnPanelBody }, template: '<ZnPanelBody><p style="margin:0">Panel-Inhalt mit eigener Breite.</p></ZnPanelBody>' }) }
