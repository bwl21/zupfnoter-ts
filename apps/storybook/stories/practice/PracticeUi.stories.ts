import { onMounted, onUnmounted, ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { mountPracticeUi, type PracticeUiController } from '@zupfnoter/practice-ui'
import '@zupfnoter/practice-ui/style.css'

const meta = {
  title: 'Practice/UI',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<PracticeUiArgs>

export default meta
type Story = StoryObj<PracticeUiArgs>

interface PracticeUiArgs {
  loading: boolean
  metronome: boolean
  meterNumerator: number
  maximumPass: number
  rangeError: string
}

function renderPracticeUi(args: PracticeUiArgs) {
  return {
    setup() {
      const host = ref<HTMLElement>()
      let controller: PracticeUiController | undefined
      onMounted(() => {
        const container = host.value
        if (container === undefined) return
        const meter = { numerator: args.meterNumerator, denominator: args.meterNumerator === 12 ? 8 : 4 }
        controller = mountPracticeUi({
          container,
          practiceVersion: '0.1.5',
          identification: 'T01 · Auszug 0',
          firstPosition: { measureNumber: 1, passIndex: 1 },
          firstPartName: 'Strophe mit langem Namen',
          hasParts: true,
          maximumMeasure: 16,
          maximumPass: args.maximumPass,
          hasMetronomeData: true,
          minLeadIn: 4,
          bandPreCount: false,
          division: 4,
          subdivision: 1,
          metronomeEnabled: args.metronome,
          metronomeMode: 'always',
          callbacks: {
            onScan: () => undefined,
            onRangeChange: () => undefined,
            onReset: () => undefined,
            onSpeedChange: () => undefined,
            onMetronomeChange: (enabled) => controller?.setMetronome(meter, 1, enabled),
            onMetronomeModeChange: () => undefined,
            onMinLeadInChange: () => undefined,
            onBandPreCountChange: () => undefined,
            onDivisionChange: () => undefined,
            onSubdivisionChange: () => undefined,
            onMetronomeVolumeChange: () => undefined,
            onPlay: () => undefined,
            onPause: () => undefined,
            onStop: () => undefined,
            onTakePosition: () => undefined,
          },
        })
        controller.setLoading(args.loading)
        controller.setRangeError(args.rangeError)
        controller.setMetronome(meter, 1, args.metronome)
      })
      onUnmounted(() => controller?.destroy())
      return { host }
    },
    template: '<div ref="host"></div>',
  }
}

export const Default: Story = {
  args: { loading: false, metronome: false, meterNumerator: 4, maximumPass: 1, rangeError: '' },
  render: renderPracticeUi,
}

export const MetronomeActive: Story = {
  args: { loading: false, metronome: true, meterNumerator: 4, maximumPass: 2, rangeError: '' },
  render: renderPracticeUi,
}

export const Loading: Story = {
  args: { loading: true, metronome: false, meterNumerator: 4, maximumPass: 2, rangeError: '' },
  render: renderPracticeUi,
}

export const RangeError: Story = {
  args: { loading: false, metronome: false, meterNumerator: 4, maximumPass: 2, rangeError: 'Der Bereich wurde im Playback nicht gefunden.' },
  render: renderPracticeUi,
}

export const LongMeter: Story = {
  args: { loading: false, metronome: true, meterNumerator: 12, maximumPass: 2, rangeError: '' },
  render: renderPracticeUi,
}
