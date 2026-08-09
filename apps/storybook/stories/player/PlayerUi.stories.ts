import { onMounted, onUnmounted, ref } from 'vue'
import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { mountPlayerUi, type PlayerUiController } from '@zupfnoter/player-ui'
import '@zupfnoter/player-ui/style.css'

const meta = {
  title: 'Player/UI',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<PlayerUiArgs>

export default meta
type Story = StoryObj<PlayerUiArgs>

interface PlayerUiArgs {
  loading: boolean
  metronome: boolean
  meterNumerator: number
  maximumPass: number
  rangeError: string
}

function renderPlayerUi(args: PlayerUiArgs) {
  return {
    setup() {
      const host = ref<HTMLElement>()
      let controller: PlayerUiController | undefined
      onMounted(() => {
        const container = host.value
        if (container === undefined) return
        const meter = { numerator: args.meterNumerator, denominator: args.meterNumerator === 12 ? 8 : 4 }
        controller = mountPlayerUi({
          container,
          playerVersion: '0.1.5',
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
  render: renderPlayerUi,
}

export const MetronomeActive: Story = {
  args: { loading: false, metronome: true, meterNumerator: 4, maximumPass: 2, rangeError: '' },
  render: renderPlayerUi,
}

export const Loading: Story = {
  args: { loading: true, metronome: false, meterNumerator: 4, maximumPass: 2, rangeError: '' },
  render: renderPlayerUi,
}

export const RangeError: Story = {
  args: { loading: false, metronome: false, meterNumerator: 4, maximumPass: 2, rangeError: 'Der Bereich wurde im Playback nicht gefunden.' },
  render: renderPlayerUi,
}

export const LongMeter: Story = {
  args: { loading: false, metronome: true, meterNumerator: 12, maximumPass: 2, rangeError: '' },
  render: renderPlayerUi,
}
