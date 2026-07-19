import type { Meta, StoryObj } from '@storybook/vue3-vite'

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
  readOnly: boolean
}

function renderPlayerUi(args: PlayerUiArgs) {
  return {
    setup: () => ({ args }),
    template: `
      <main style="min-height:100vh;padding:2rem;background:#f0f4f8;font-family:system-ui,sans-serif;color:#243b53">
        <section style="box-sizing:border-box;width:min(34rem,100%);margin:0 auto;padding:1rem;border:1px solid #cbd5e1;border-radius:1rem;background:white;box-shadow:0 1rem 2rem #243b531f;text-align:center">
          <h1 style="margin:.2rem 0 .15rem;font-size:1.7rem">Zupfnoter Player</h1>
          <p style="margin:.2rem 0;color:#829ab1;font-size:.7rem">Player v0.1.5</p>
          <p style="margin:.75rem 0;color:#627d98;font-weight:600">T01 · Auszug 0</p>
          <fieldset style="display:flex;justify-content:center;gap:.5rem;margin:0;padding:.75rem;border:1px solid #cbd5e1;border-radius:.4rem">
            <legend style="color:#627d98;font-size:.8rem">Von</legend>
            <label style="display:grid;gap:.2rem;color:#627d98;font-size:.75rem">Takt<input value="1" type="number" min="1" style="width:4rem;padding:.45rem;border:1px solid #cbd5e1;border-radius:.35rem;text-align:center;font-size:1.1rem"></label>
            <label style="display:grid;gap:.2rem;color:#627d98;font-size:.75rem">Durchlauf<input value="1" type="number" min="1" style="width:4rem;padding:.45rem;border:1px solid #cbd5e1;border-radius:.35rem;text-align:center;font-size:1.1rem"></label>
            <button type="button" style="align-self:end;padding:.45rem .7rem;border:1px solid #cbd5e1;border-radius:.35rem;background:#f0f4f8">Reset</button>
          </fieldset>
          <p v-if="args.loading" style="color:#627d98">◌ Harfenklang wird geladen …</p>
          <label style="display:flex;justify-content:center;gap:.6rem;margin:1rem 0;color:#627d98">Geschwindigkeit <input type="range" min=".5" max="1.5" step=".05" value="1"></label>
          <div style="display:flex;align-items:center;justify-content:center;gap:.7rem;margin:.7rem 0;color:#627d98">
            <label><input :checked="args.metronome" type="checkbox"> Metronom</label>
            <span style="color:#e67e22">●</span><span style="color:#2f80ed">●</span><span style="color:#cbd5e1">●</span><strong>1</strong><span>4/4</span>
          </div>
          <output style="display:block;margin:.5rem 0;color:#102a43;font-size:4rem;font-weight:700">1.1</output>
          <p style="margin:0;color:#627d98">0:00</p>
          <div style="display:flex;justify-content:center;gap:.75rem;margin-top:1.25rem">
            <button type="button" aria-label="Wiedergabe starten" style="width:4rem;height:4rem;border:0;border-radius:50%;background:#2f80ed;color:white;font-size:1.4rem">▶</button>
            <button type="button" aria-label="Wiedergabe pausieren" style="width:4rem;height:4rem;border:0;border-radius:50%;background:#2f80ed;color:white;font-size:1.4rem">Ⅱ</button>
            <button type="button" aria-label="Wiedergabe stoppen" style="width:4rem;height:4rem;border:0;border-radius:50%;background:#2f80ed;color:white;font-size:1.4rem">■</button>
          </div>
        </section>
      </main>
    `,
  }
}

export const Default: Story = {
  args: { loading: false, metronome: false, readOnly: false },
  render: renderPlayerUi,
}

export const MetronomeActive: Story = {
  args: { loading: false, metronome: true, readOnly: false },
  render: renderPlayerUi,
}

export const Loading: Story = {
  args: { loading: true, metronome: false, readOnly: false },
  render: renderPlayerUi,
}

