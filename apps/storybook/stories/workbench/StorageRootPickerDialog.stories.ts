import type { Meta, StoryObj } from '@storybook/vue3-vite'

import StorageRootPickerDialog from '../../../web/src/workbench/StorageRootPickerDialog.vue'

const meta = { title: 'Workbench/Dialog/StorageRootPickerDialog', component: StorageRootPickerDialog, tags: ['autodocs'] } satisfies Meta<typeof StorageRootPickerDialog>
export default meta
type Story = StoryObj<typeof meta>

const folders = [
  { name: 'Privat', path: 'Privat' },
  { name: 'Unterricht', path: 'Unterricht' },
  { name: 'Verein', path: 'Verein' },
]

export const FolderSelection: Story = { args: { open: true, path: '', folders, loading: false } }
export const Loading: Story = { args: { open: true, path: 'Privat', folders: [], loading: true } }
