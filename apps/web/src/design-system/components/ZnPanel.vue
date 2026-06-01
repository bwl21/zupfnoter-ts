<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  subtitle?: string
  eyebrow?: string
  tone?: 'surface' | 'sunken' | 'accent'
}>(), {
  title: undefined,
  subtitle: undefined,
  eyebrow: undefined,
  tone: 'surface',
})
</script>

<template>
  <section class="zn-panel" :data-tone="tone">
    <div class="zn-panel__shell">
      <slot name="header">
        <header v-if="title || subtitle || eyebrow" class="zn-panel__default-header">
          <div v-if="eyebrow" class="zn-panel__eyebrow">
            {{ eyebrow }}
          </div>
          <h2 v-if="title" class="zn-panel__title">
            {{ title }}
          </h2>
          <p v-if="subtitle" class="zn-panel__subtitle">
            {{ subtitle }}
          </p>
        </header>
      </slot>

      <div class="zn-panel__body">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="zn-panel__footer">
        <slot name="footer" />
      </footer>
    </div>
  </section>
</template>

<style scoped>
.zn-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.zn-panel__shell {
  display: flex;
  flex-direction: column;
  gap: var(--zn-space-3);
  flex: 1 1 auto;
  min-height: 0;
  padding: var(--zn-space-4);
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-md);
  background: var(--zn-bg-elevated);
  box-shadow: var(--zn-shadow-soft);
}

.zn-panel[data-tone='sunken'] .zn-panel__shell {
  background: var(--zn-bg-surface-soft);
}

.zn-panel[data-tone='accent'] .zn-panel__shell {
  border-color: color-mix(in srgb, var(--zn-accent) 30%, var(--zn-border));
  background: linear-gradient(180deg, color-mix(in srgb, var(--zn-accent) 6%, transparent), transparent), var(--zn-bg-elevated);
}

.zn-panel__default-header {
  display: grid;
  gap: var(--zn-space-2);
}

.zn-panel__eyebrow {
  color: var(--zn-accent-strong);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.zn-panel__title {
  margin: 0;
  color: var(--zn-heading);
  font-size: 1rem;
  font-weight: 700;
}

.zn-panel__subtitle {
  margin: 0;
  color: var(--zn-text-muted);
  font-size: 0.86rem;
}

.zn-panel__body {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.zn-panel__footer {
  padding-top: var(--zn-space-3);
  border-top: 1px solid var(--zn-border);
}
</style>
