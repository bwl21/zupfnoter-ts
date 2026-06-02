<script setup lang="ts">
import ZnPanel from '../../design-system/components/ZnPanel.vue'

const abcText = defineModel<string>({
  required: true,
})
</script>

<template>
  <ZnPanel tone="accent">
    <div class="panel-shell">
      <textarea
        v-model="abcText"
        aria-label="ABC notation editor"
        class="panel-shell__editor"
        spellcheck="false"
      />
    </div>
  </ZnPanel>
</template>

<style scoped>
.panel-shell {
  display: grid;
  min-height: 0;
  height: 100%;
}

.panel-shell__editor {
  margin: 0;
  padding: var(--zn-space-3);
  width: 100%;
  box-sizing: border-box;
  border-radius: 0;
  background: transparent;
  border: 0;
  color: var(--zn-text-soft);
  font-family: var(--zn-font-mono);
  font-size: 0.82rem;
  line-height: 1.55;
  overflow: auto;
  white-space: pre;
  min-height: 0;
  height: 100%;
  resize: none;
  outline: none;
}
</style>
