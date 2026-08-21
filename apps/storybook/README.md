# Storybook

Storybook ist eine eigene Workspace-App für isolierte Vue-Komponenten und die
gemeinsame Practice-Oberfläche.

Vom Repository-Root aus:

```bash
pnpm storybook
pnpm build-storybook
```

Stories liegen unter `apps/storybook/stories/`. Die Konfiguration liegt unter
`apps/storybook/.storybook/`. Das gemeinsame Design-System wird aus
`@zupfnoter/design-system` importiert. Workbench-Stories dürfen weiterhin
gezielt Web-Komponenten aus `apps/web/src/` verwenden; die Practice-Story nutzt
`@zupfnoter/practice-ui`, also dieselbe DOM-UI wie die produktive Practice-App.

Neue wiederverwendbare UI-Komponenten gehören in `packages/design-system`.
Die dort liegenden Komponenten können von Web, Practice und Storybook gemeinsam
verwendet und in den Stories unter `stories/design-system/` dokumentiert werden.
