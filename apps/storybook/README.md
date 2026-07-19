# Storybook

Storybook ist eine eigene Workspace-App für isolierte Vue-Komponenten und die
gemeinsame Player-Oberfläche.

Vom Repository-Root aus:

```bash
pnpm storybook
pnpm build-storybook
```

Stories liegen unter `apps/storybook/stories/`. Die Konfiguration liegt unter
`apps/storybook/.storybook/`. Web-Komponenten werden direkt aus `apps/web/src/`
importiert; die Player-Story verwendet `@zupfnoter/player-ui`, also dieselbe
DOM-UI wie der produktive Player.
