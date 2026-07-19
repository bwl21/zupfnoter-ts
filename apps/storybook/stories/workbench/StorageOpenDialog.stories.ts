import type { Meta, StoryObj } from '@storybook/vue3-vite'

import StorageOpenDialog from '../../../web/src/workbench/StorageOpenDialog.vue'

const meta = { title: 'Workbench/Dialog/StorageOpenDialog', component: StorageOpenDialog, tags: ['autodocs'] } satisfies Meta<typeof StorageOpenDialog>
export default meta
type Story = StoryObj<typeof meta>

const documents = [
  { path: '/Noten/Abendlied.abc', name: 'Abendlied.abc', modifiedAt: '2026-07-18T12:00:00.000Z', previewPdfPaths: ['/Noten/Abendlied-A4.pdf'], previewHtmlPaths: [] },
  { path: '/Noten/Morgenlied.abc', name: 'Morgenlied.abc', modifiedAt: '2026-07-17T09:30:00.000Z', previewPdfPaths: [], previewHtmlPaths: ['/Noten/Morgenlied.html'] },
]

export const FilterBeforeSearch: Story = { args: { open: true, locationLabel: 'Privat', path: 'Noten', documents, loading: false, previewLoading: false, previewError: '' } }
export const Loading: Story = { args: { open: true, locationLabel: 'Privat', path: 'Noten', documents: [], loading: true, previewLoading: false, previewError: '' } }
