import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnProblemMarker } from '@zupfnoter/design-system'

const meta = { title: 'Design System/ZnProblemMarker', component: ZnProblemMarker, tags: ['autodocs'], parameters: { docs: { description: { component: 'Kompakte Meldungsanzeige für Probleme und Statushinweise. `severity` steuert die visuelle Dringlichkeit; die konkrete Meldung wird als Slot-Inhalt übergeben.' } } }, argTypes: { severity: { control: 'select', options: ['info', 'warning', 'danger', 'success'] } } } satisfies Meta<typeof ZnProblemMarker>
export default meta
type Story = StoryObj<typeof meta>

export const Warning: Story = { args: { severity: 'warning', default: '3 Probleme' } }
export const Error: Story = { args: { severity: 'danger', default: 'Renderfehler' } }
