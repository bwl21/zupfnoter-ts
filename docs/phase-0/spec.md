# Spec: Phase 0 – Monorepo-Setup

**Status: umgesetzt.**

Dieses Dokument bewahrt die ursprünglichen Anforderungen. Der aktuelle
Repository-Stand ist in [`docs/architecture/current-state.md`](../architecture/current-state.md)
zusammengefasst.

## Problem

Das Projekt benötigte ursprünglich eine Monorepo-Struktur mit PNPM Workspaces,
damit die Kern-, App- und UI-Pakete eigenständig entwickelt und lokal verknüpft
werden können. Die Struktur ist inzwischen vorhanden und wurde um Playback,
Player-UI, Design-System, ViewSvg und Storybook erweitert.

## Ist-Zustand

| Element | Status |
|---------|--------|
| `packages/core/` | ✅ vorhanden und implementiert |
| `packages/types/` | ✅ vorhanden |
| `apps/web/` | ✅ vorhanden und aktiv |
| `apps/cli/` | ✅ Workspace vorhanden, fachlicher Ausbau offen |
| `apps/storybook/` | ✅ eigene Storybook-App |
| `apps/player/` | ✅ eigenständiger Player |
| `src/` (Vue-Scaffold) | ✅ aus dem Root entfernt |
| `pnpm-workspace.yaml` | ✅ vorhanden |
| `tsconfig.base.json` | ✅ vorhanden |
| Devcontainer mit Node.js | ⚠️ nicht maßgeblicher Entwicklungsweg |
| `package.json` Name | ✅ `zupfnoter-ts` |

## Anforderungen

### 1. Devcontainer: Node.js + PNPM

`devcontainer.json` auf `mcr.microsoft.com/devcontainers/typescript-node:22` umstellen.
Kein eigenes Dockerfile mehr nötig — das Image bringt Node 22, npm, TypeScript und
gängige Dev-Tools mit. PNPM via devcontainer Feature hinzufügen.

### 2. PNPM Workspaces

`pnpm-workspace.yaml` anlegen:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

Root-`package.json` anpassen:
- `name`: `zupfnoter-ts`
- `private: true`
- Scripts auf `pnpm` umstellen (`pnpm -r run …`)
- `package-lock.json` entfernen (durch `pnpm-lock.yaml` ersetzt nach `pnpm install`)

### 3. Verzeichnisstruktur anlegen

```
packages/
  core/        # bereits vorhanden — package.json ergänzen
  types/       # neu: leeres Paket mit package.json + tsconfig.json
apps/
  web/         # Vue-Scaffold hierher verschieben
  cli/         # neu: leeres Paket mit package.json + tsconfig.json
```

### 4. `src/` → `apps/web/` verschieben

Den bestehenden Vue-Scaffold (`src/`, `index.html`, `vite.config.ts`, `tsconfig.app.json`,
`tsconfig.vitest.json`, `env.d.ts`, `public/`) nach `apps/web/` verschieben.
Root bleibt nur noch Workspace-Konfiguration.

### 5. Gemeinsame `tsconfig.base.json`

Am Root eine `tsconfig.base.json` mit gemeinsamen Compiler-Optionen erstellen.
Alle Paket-`tsconfig.json`-Dateien erweitern diese Basis.

### 6. Paket-`package.json` für alle Pakete

| Paket | Name | Version |
|-------|------|---------|
| `packages/core` | `@zupfnoter/core` | `0.1.0` |
| `packages/types` | `@zupfnoter/types` | `0.1.0` |
| `apps/web` | `@zupfnoter/web` | `0.1.0` |
| `apps/cli` | `@zupfnoter/cli` | `0.1.0` |

`apps/web` hängt von `@zupfnoter/core` und `@zupfnoter/types` ab (`workspace:*`).
`packages/core` hängt von `@zupfnoter/types` ab (`workspace:*`).

## Akzeptanzkriterien

1. `pnpm install` läuft am Root durch ohne Fehler
2. `pnpm -r run type-check` läuft durch (alle Pakete)
3. `pnpm -r run test:unit` läuft durch (alle Pakete mit Tests)
4. `apps/web/` enthält den Vue-Scaffold, `src/` am Root existiert nicht mehr
5. `packages/types/` und `apps/cli/` existieren als leere Pakete
6. Devcontainer verwendet `typescript-node:22`-Image

## Implementierungsschritte

1. `devcontainer.json` auf `typescript-node:22`-Image umstellen, Dockerfile entfernen
2. `pnpm-workspace.yaml` anlegen
3. Root-`package.json` anpassen (Name, Scripts)
4. `tsconfig.base.json` am Root erstellen
5. `packages/types/` anlegen (package.json, tsconfig.json, leeres `src/index.ts`)
6. `apps/cli/` anlegen (package.json, tsconfig.json, leeres `src/index.ts`)
7. `src/` → `apps/web/` verschieben (inkl. vite.config, tsconfig.app, index.html, public/)
8. `apps/web/package.json` anlegen, Abhängigkeiten auf `workspace:*` setzen
9. `packages/core/package.json` anlegen/ergänzen
10. Alle Paket-`tsconfig.json` auf `tsconfig.base.json` umstellen
11. Root-`tsconfig.json` als Projekt-Referenz-Datei aktualisieren
12. `package-lock.json` entfernen, `.gitignore` um `pnpm-lock.yaml`-Eintrag ergänzen
13. `pnpm install` ausführen und verifizieren

---
