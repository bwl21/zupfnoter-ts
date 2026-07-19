<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
}>(), {
  label: 'Toolbar',
})
</script>

<template>
  <div class="zn-toolbar" role="toolbar" :aria-label="props.label">
    <div class="zn-toolbar__group">
      <slot name="leading" />
    </div>
    <div class="zn-toolbar__body">
      <slot />
    </div>
    <div class="zn-toolbar__group zn-toolbar__group--trailing">
      <slot name="trailing" />
    </div>
  </div>
</template>

<style scoped>
.zn-toolbar {
  display: flex;
  align-items: center;
  gap: var(--zn-space-3);
  padding: 0.28rem 0.45rem;
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-md);
  background: var(--zn-bg-elevated);
  box-shadow: var(--zn-shadow-soft);
}

.zn-toolbar__group,
.zn-toolbar__body {
  display: inline-flex;
  align-items: center;
  gap: var(--zn-space-2);
  min-width: 0;
}

.zn-toolbar__body {
  flex: 1 1 auto;
}

.zn-toolbar__group--trailing {
  justify-content: flex-end;
}
</style>
