<script setup lang="ts">
import ZnPanel from '../../design-system/components/ZnPanel.vue'

const lines = [
  'X:1',
  'T:Zupfnoter Workbench',
  'M:4/4',
  'L:1/4',
  'Q:1/4=120',
  'K:C',
  'V:V1 clef=treble-8',
  '[V:V1] C D E F | G A B c |]',
]
</script>

<template>
  <ZnPanel tone="accent">
    <div class="panel-shell">
      <pre class="panel-shell__editor" aria-label="ABC source preview"><code><span v-for="(line, index) in lines" :key="line">{{ `${String(index + 1).padStart(2, '0')}  ${line}` }}<br></span></code></pre>
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
}
</style>
