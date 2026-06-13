<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow?: string
  title?: string
  subtitle?: string
}>(), {
  eyebrow: undefined,
  title: undefined,
  subtitle: undefined,
})
</script>

<template>
  <header class="zn-panel-header">
    <div v-if="eyebrow" class="zn-panel-header__eyebrow">
      {{ eyebrow }}
    </div>
    <div class="zn-panel-header__title-row">
      <h2 v-if="title" class="zn-panel-header__title">
        {{ title }}
      </h2>
      <slot name="actions" />
    </div>
    <p v-if="subtitle" class="zn-panel-header__subtitle">
      {{ subtitle }}
    </p>
    <div class="zn-panel-header__slots">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.zn-panel-header {
  display: grid;
  gap: var(--zn-space-2);
}

.zn-panel-header__eyebrow {
  color: var(--zn-accent-strong);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.zn-panel-header__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--zn-space-3);
}

.zn-panel-header__title {
  margin: 0;
  color: var(--zn-heading);
  font-size: 1rem;
  font-weight: 700;
  line-height: var(--zn-line-height-tight);
}

.zn-panel-header__subtitle {
  margin: 0;
  color: var(--zn-text-muted);
  font-size: 0.86rem;
}

.zn-panel-header__slots {
  min-width: 0;
}
</style>

