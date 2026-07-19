import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { ZnBadge, ZnButton, ZnToolbar } from '@zupfnoter/design-system'

const meta = { title: 'Design System/ZnToolbar', component: ZnToolbar, tags: ['autodocs'] } satisfies Meta<typeof ZnToolbar>
export default meta
type Story = StoryObj<typeof meta>

export const MainActions: Story = { render: () => ({ components: { ZnBadge, ZnButton, ZnToolbar }, template: '<ZnToolbar><template #leading><ZnBadge tone="accent">Datei</ZnBadge></template><ZnButton variant="ghost">Neu</ZnButton><ZnButton variant="ghost">Öffnen</ZnButton><ZnButton variant="primary">Speichern</ZnButton><template #trailing><ZnBadge tone="success">Bereit</ZnBadge></template></ZnToolbar>' }) }
