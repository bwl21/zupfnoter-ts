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
  gap: 0.25rem;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  padding: 0.25rem;
  overflow: hidden;
}

.workbench-layout__header,
.workbench-layout__workspace,
.workbench-layout__footer {
  min-width: 0;
}

.workbench-layout__workspace {
  min-height: 0;
  overflow: hidden;
}

.workbench-layout__footer {
  margin-top: auto;
}
</style>
