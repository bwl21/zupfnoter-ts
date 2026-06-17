<script setup lang="ts">
import ZnButton from '../design-system/components/ZnButton.vue'

const props = defineProps<{
  open: boolean
  appVersion: string
  commitHash: string
  buildTime: string
}>()

const emit = defineEmits<{
  (event: 'close'): void
}>()

function formatBuildTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="props.open" class="about-dialog__backdrop">
      <section class="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-dialog-title">
        <header class="about-dialog__header">
          <h2 id="about-dialog-title">About Zupfnoter</h2>
          <ZnButton variant="ghost" aria-label="Close about dialog" @click="emit('close')">
            ×
          </ZnButton>
        </header>

        <div class="about-dialog__body">
          <p class="about-dialog__lead">
            Laufende Web-App und Build-Metadaten für die aktuelle Sitzung.
          </p>

          <dl class="about-dialog__facts">
            <div>
              <dt>App version</dt>
              <dd>{{ props.appVersion }}</dd>
            </div>
            <div>
              <dt>Commit</dt>
              <dd><code>{{ props.commitHash }}</code></dd>
            </div>
            <div>
              <dt>Built at</dt>
              <dd>{{ formatBuildTime(props.buildTime) }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.about-dialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 0.75rem;
  background: rgb(15 23 42 / 0.45);
}

.about-dialog {
  width: min(26rem, calc(100vw - 1.5rem));
  padding: 0;
  border: 1px solid var(--zn-border-strong);
  border-radius: 0.85rem;
  background: var(--zn-bg-elevated);
  box-shadow: 0 16px 36px rgb(15 23 42 / 0.22);
  color: var(--zn-text);
}

.about-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid var(--zn-border);
}

.about-dialog__header h2 {
  margin: 0;
  font-size: 1rem;
}

.about-dialog__body {
  padding: 0.8rem 0.85rem 0.9rem;
}

.about-dialog__lead {
  margin: 0 0 0.75rem;
  color: var(--zn-text-soft);
  font-size: 0.93rem;
}

.about-dialog__facts {
  display: grid;
  gap: 0.55rem;
  margin: 0;
}

.about-dialog__facts div {
  display: grid;
  gap: 0.2rem;
}

.about-dialog__facts dt {
  color: var(--zn-text-soft);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.about-dialog__facts dd {
  margin: 0;
  font-size: 0.9rem;
}
</style>
