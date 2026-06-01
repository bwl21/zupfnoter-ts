<template>
  <div class="workbench-layout">
    <header class="workbench-layout__header">
      <slot name="header" />
    </header>

    <main class="workbench-layout__workspace">
      <slot name="workspace" />
    </main>

    <section class="workbench-layout__footer">
      <slot name="footer" />
    </section>
  </div>
</template>

<style scoped>
.workbench-layout {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: var(--zn-space-2);
  min-height: 100vh;
  padding: 0.5rem;
  overflow: hidden;
}

.workbench-layout__header,
.workbench-layout__workspace,
.workbench-layout__footer {
  min-width: 0;
}

.workbench-layout__header {
  animation: workbench-enter 420ms ease both;
}

.workbench-layout__workspace {
  min-height: 0;
  animation: workbench-enter 520ms ease both;
}

.workbench-layout__footer {
  margin-top: auto;
  animation: workbench-enter 620ms ease both;
}

@keyframes workbench-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
