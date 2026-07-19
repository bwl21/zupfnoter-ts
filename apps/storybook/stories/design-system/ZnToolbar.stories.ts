import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ZnBadge from '../../../web/src/design-system/components/ZnBadge.vue'
import ZnButton from '../../../web/src/design-system/components/ZnButton.vue'
import ZnToolbar from '../../../web/src/design-system/components/ZnToolbar.vue'

const meta = { title: 'Design System/ZnToolbar', component: ZnToolbar, tags: ['autodocs'] } satisfies Meta<typeof ZnToolbar>
export default meta
type Story = StoryObj<typeof meta>

export const MainActions: Story = { render: () => ({ components: { ZnBadge, ZnButton, ZnToolbar }, template: '<ZnToolbar><template #leading><ZnBadge tone="accent">Datei</ZnBadge></template><ZnButton variant="ghost">Neu</ZnButton><ZnButton variant="ghost">Öffnen</ZnButton><ZnButton variant="primary">Speichern</ZnButton><template #trailing><ZnBadge tone="success">Bereit</ZnBadge></template></ZnToolbar>' }) }
