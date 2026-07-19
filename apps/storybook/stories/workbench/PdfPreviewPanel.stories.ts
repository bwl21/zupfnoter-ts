import type { Meta, StoryObj } from '@storybook/vue3-vite'

import PdfPreviewPanel from '../../../web/src/workbench/panels/PdfPreviewPanel.vue'

const meta = { title: 'Workbench/Panels/PdfPreviewPanel', component: PdfPreviewPanel, tags: ['autodocs'] } satisfies Meta<typeof PdfPreviewPanel>
export default meta
type Story = StoryObj<typeof meta>

export const ExportPreview: Story = {}
