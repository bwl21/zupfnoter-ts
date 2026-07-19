<template>
  <footer class="zn-status-bar">
    <div class="zn-status-bar__main">
      <slot />
    </div>
    <div class="zn-status-bar__aside">
      <slot name="aside" />
    </div>
  </footer>
</template>

<style scoped>
.zn-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--zn-space-4);
  padding: var(--zn-space-2) var(--zn-space-3);
  border: 1px solid var(--zn-border);
  border-radius: var(--zn-radius-md);
  background: var(--zn-bg-elevated);
  box-shadow: var(--zn-shadow-soft);
}

.zn-status-bar__main,
.zn-status-bar__aside {
  display: inline-flex;
  align-items: center;
  gap: var(--zn-space-2);
  min-width: 0;
  flex-wrap: wrap;
}

.zn-status-bar__aside {
  justify-content: flex-end;
}
</style>
