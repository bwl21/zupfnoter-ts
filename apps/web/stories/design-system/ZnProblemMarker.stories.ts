import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ZnProblemMarker from '../../src/design-system/components/ZnProblemMarker.vue'

const meta = { title: 'Design System/ZnProblemMarker', component: ZnProblemMarker, tags: ['autodocs'], argTypes: { severity: { control: 'select', options: ['info', 'warning', 'danger', 'success'] } } } satisfies Meta<typeof ZnProblemMarker>
export default meta
type Story = StoryObj<typeof meta>

export const Warning: Story = { args: { severity: 'warning', default: '3 Probleme' } }
export const Error: Story = { args: { severity: 'danger', default: 'Renderfehler' } }

