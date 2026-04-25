# Spec: `apps/demo` – Pipeline-Demo-App (Phase 3)

## Problem

Die `DemoView` (ABC-Editor + SVG-Vorschau) lebt aktuell in `apps/web`. Das ist
problematisch, weil `apps/web` der Platzhalter für die spätere vollständige
Zupfnoter-Web-App (Phase 5) ist. Die Demo dient als Entwicklungswerkzeug für Phase 3
(Pipeline-Verifikation) und soll nicht mit dem zukünftigen Web-App-Scaffold vermischt werden.

## Ziel

`apps/demo` wird ein eigenständiges Vite/Vue-3-Paket (`@zupfnoter/demo`) im Monorepo,
das ausschließlich die Demo-Funktionalität enthält (ABC-Editor + SVG-Vorschau).
`apps/web` wird auf einen leeren Scaffold zurückgesetzt und dient als Basis für Phase 5.

## Zielstruktur

```
apps/
├── demo/                    # NEU: @zupfnoter/demo
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.ts
│       ├── App.vue
│       └── DemoView.vue     # verschoben aus apps/web/src/views/
└── web/                     # BLEIBT: @zupfnoter/web (leerer Scaffold für Phase 5)
    └── src/
        └── views/
            └── (DemoView.vue entfernt)
```

## Anforderungen

### R1 – `apps/demo` als neues Paket anlegen

- Paketname: `@zupfnoter/demo`
- Vite + Vue 3 (Composition API), TypeScript
- Abhängigkeiten: `@zupfnoter/core`, `@zupfnoter/types`, `vue`
- Kein Router (Single-Page, kein Routing nötig)
- Kein Pinia (Demo braucht keinen globalen State)
- `pnpm-workspace.yaml` erfasst `apps/*` bereits — kein Änderungsbedarf

### R2 – `DemoView.vue` nach `apps/demo/src/` verschieben

- `apps/web/src/views/DemoView.vue` → `apps/demo/src/DemoView.vue`
- Inhalt unverändert (kein Refactoring der Demo-Logik)
- `apps/demo/src/App.vue` bindet `DemoView` direkt ein (kein Router)

### R3 – `apps/web` bereinigen

- `DemoView.vue` aus `apps/web/src/views/` entfernen
- Router-Eintrag für `DemoView` entfernen
- `apps/web` bleibt als funktionsfähiger (aber leerer) Vue-3-Scaffold

### R4 – Root-`dev`-Script auf `apps/demo` umstellen

Das Root-`package.json`-Script `"dev"` zeigt aktuell auf `@zupfnoter/web`.
Es soll auf `@zupfnoter/demo` umgestellt werden, damit `pnpm dev` die Demo startet.

### R5 – AGENTS.md aktualisieren

Zielarchitektur um `apps/demo` ergänzen:

```
apps/
├── web/           # Vue 3 Frontend (Editor + Preview) — Phase 5
├── demo/          # Standalone-Demo (ABC-Editor + SVG-Vorschau)
└── cli/           # TypeScript-CLI (PDF/SVG-Export ohne Browser)
```

## Akzeptanzkriterien

1. `pnpm dev` startet die Demo-App aus `apps/demo`
2. Die Demo zeigt ABC-Editor + SVG-Vorschau (identisch zum bisherigen Verhalten)
3. `apps/web` ist ein leerer Vue-3-Scaffold ohne DemoView
4. Alle Tests (171) bleiben grün
5. `pnpm build` baut alle Pakete ohne Fehler

## Implementierungsschritte

1. `apps/demo/` anlegen: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
2. `apps/demo/src/main.ts` und `apps/demo/src/App.vue` erstellen
3. `DemoView.vue` von `apps/web/src/views/` nach `apps/demo/src/` verschieben
4. `apps/web` bereinigen: `DemoView.vue` entfernen, Router-Eintrag entfernen
5. Root-`package.json`: `"dev"` auf `@zupfnoter/demo` umstellen
6. AGENTS.md aktualisieren
7. Tests und Build verifizieren