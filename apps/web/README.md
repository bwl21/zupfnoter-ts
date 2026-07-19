# Web-Anwendung

## Storybook

Storybook ist für die Vue-Komponenten unter `apps/web` eingerichtet.

Vom Repository-Root aus:

```bash
pnpm storybook
pnpm build-storybook
```

Stories liegen zentral unter `apps/web/stories/` und verwenden die Endung
`.stories.ts`. Die globale Storybook-Konfiguration liegt in `apps/web/.storybook/`.
Globale Styles und Pinia werden in `preview.ts` registriert.

Spätere visuelle Notations-Fixtures sollten ihre ABC-, Song-, Sheet- oder SVG-Daten
aus bestehenden Fixtures importieren und die Berechnung erst innerhalb der Story
ausführen. So bleiben die Stories deterministisch und vermeiden Netzwerkzugriffe.
