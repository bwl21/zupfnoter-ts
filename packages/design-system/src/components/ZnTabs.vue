<script setup lang="ts">
import { useId } from 'vue'

export interface ZnTabItem {
  id: string
  label: string
  badge?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  items: readonly ZnTabItem[]
  fillHeight?: boolean
}>(), {})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const instanceId = useId()

function tabId(itemId: string): string {
  return `${instanceId}-tab-${encodeURIComponent(itemId)}`
}

function panelId(): string {
  return `${instanceId}-panel`
}
</script>

<template>
  <div class="zn-tabs" :data-fill-height="props.fillHeight !== false">
    <div class="zn-tabs__bar" role="tablist" aria-label="Tabs">
      <button
        v-for="item in props.items"
        :key="item.id"
        :id="tabId(item.id)"
        class="zn-tabs__tab"
        :class="{ 'zn-tabs__tab--active': item.id === props.modelValue }"
        type="button"
        role="tab"
        :aria-selected="item.id === props.modelValue"
        :aria-controls="panelId()"
        @click="emit('update:modelValue', item.id)"
      >
        <span>{{ item.label }}</span>
        <span v-if="item.badge" class="zn-tabs__badge">
          {{ item.badge }}
        </span>
      </button>
    </div>
    <div
      :id="panelId()"
      class="zn-tabs__panel"
      role="tabpanel"
      :aria-labelledby="tabId(props.modelValue)"
      tabindex="0"
    >
      <slot :active-id="props.modelValue" :active-item="props.items.find((item) => item.id === props.modelValue)" />
    </div>
  </div>
</template>

<style scoped>
.zn-tabs {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--zn-space-2);
  min-width: 0;
  min-height: 0;
}

.zn-tabs[data-fill-height='true'] {
  height: 100%;
}

.zn-tabs[data-fill-height='false'] {
  height: auto;
  align-self: start;
}

.zn-tabs__bar {
  display: flex;
  gap: var(--zn-space-2);
  flex-wrap: wrap;
  padding-bottom: 0.2rem;
  border-bottom: 1px solid var(--zn-border);
}

.zn-tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: var(--zn-space-2);
  min-height: 1.9rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-sm);
  background: var(--zn-bg-surface-soft);
  color: var(--zn-text-soft);
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    color 140ms ease,
    transform 140ms ease;
}

.zn-tabs__tab:hover {
  transform: translateY(-1px);
  border-color: var(--zn-border-strong);
}

.zn-tabs__tab--active {
  border-color: var(--zn-accent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--zn-accent) 16%, transparent), color-mix(in srgb, var(--zn-accent) 8%, transparent));
  color: var(--zn-accent-strong);
}

.zn-tabs__tab:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--zn-accent) 65%, white);
  outline-offset: 2px;
}

.zn-tabs__badge {
  padding: 0.08rem 0.4rem;
  border-radius: var(--zn-radius-sm);
  background: color-mix(in srgb, var(--zn-bg-surface) 50%, transparent);
  font-size: 0.72rem;
}

.zn-tabs__panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
