# Design-System

Dieses private Workspace-Paket ist ein **Quellpaket**. Alle Exporte zeigen auf
die produktiven TypeScript-/Vue-Dateien. Der jeweilige Verbraucher kompiliert
sie mit seinem Vue-fähigen Bundler (Web, Review und Storybook: Vite).
Ein separates `dist`-Artefakt wird weder erzeugt noch angeboten.

`pnpm build` validiert denselben Vertrag wie `pnpm type-check`: `vue-tsc`
prüft TypeScript einschließlich Vue-Templates. Normales Node.js ohne
TypeScript-/Vue-Transformation ist kein unterstützter Laufzeitverbraucher.

Styles der Komponenten sind lokal; allgemeine Designtokens werden über
`@zupfnoter/design-system/tokens.css` eingebunden. Produktive Komponenten
importieren weder Apps noch Storybook.
