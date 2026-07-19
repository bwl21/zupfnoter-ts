import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ZnPanel from '../../src/design-system/components/ZnPanel.vue'
import ZnSplitPane from '../../src/design-system/components/ZnSplitPane.vue'

const meta = { title: 'Design System/ZnSplitPane', component: ZnSplitPane, tags: ['autodocs'], argTypes: { orientation: { control: 'select', options: ['horizontal', 'vertical'] }, primarySize: { control: { type: 'number', min: 10, max: 90 } } } } satisfies Meta<typeof ZnSplitPane>
export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = { render: (args) => ({ components: { ZnPanel, ZnSplitPane }, setup: () => ({ args }), template: '<div style="height:18rem"><ZnSplitPane v-bind="args"><template #primary><ZnPanel title="Editor" fill-height="false"><p>ABC-Text</p></ZnPanel></template><template #secondary><ZnPanel title="Vorschau" fill-height="false"><p>SVG-Vorschau</p></ZnPanel></template></ZnSplitPane></div>' }), args: { orientation: 'horizontal', primarySize: 55 } }
export const Vertical: Story = { render: (args) => ({ components: { ZnPanel, ZnSplitPane }, setup: () => ({ args }), template: '<div style="height:24rem"><ZnSplitPane v-bind="args"><template #primary><ZnPanel title="Oben" fill-height="false"><p>Oberer Bereich</p></ZnPanel></template><template #secondary><ZnPanel title="Unten" fill-height="false"><p>Unterer Bereich</p></ZnPanel></template></ZnSplitPane></div>' }), args: { orientation: 'vertical', primarySize: 45 } }

