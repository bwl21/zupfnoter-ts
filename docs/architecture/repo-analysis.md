# Repository Analysis

Terminology used in this document:

- `Stage` refers to a domain transformation stage in the pipeline
- `Phase` refers to a migration or implementation phase of the rewrite

## 1. Overall Architecture

This repository is a PNPM monorepo with a clear split between shared domain logic and app-facing entry points.

- Workspace configuration lives at the root in `pnpm-workspace.yaml`.
- Shared TypeScript configuration is centralized in `tsconfig.base.json`.
- Root scripts orchestrate package-level build, test, lint, and dev workflows from `package.json`.

The core architectural decision is that the system is built around a transformation pipeline library rather than around the UI. The app packages consume reusable logic from `@zupfnoter/core`, and `@zupfnoter/core` in turn depends on shared contracts from `@zupfnoter/types`.

The repository is also organized by migration phase. The `docs/` tree and root `spec.md` act as the documentation index and implementation record for the rewrite from the legacy Zupfnoter system to the TypeScript/Vue/Vite stack.

For a compact snapshot of the current implementation state, see
[current-state.md](current-state.md).

## 2. Packages And Responsibilities

### `packages/types`

`@zupfnoter/types` is the shared contract package. It contains no pipeline logic and exists to define the data model boundaries used across the repo.

It covers three domains:

- music model types in `packages/types/src/music.ts`
- drawing model types in `packages/types/src/drawing.ts`
- configuration types in `packages/types/src/config.ts`

Representative responsibilities:

- `Song`, `Voice`, `Playable`, `Pause`, `Goto`
- `Sheet`, `DrawableElement`, `Ellipse`, `Glyph`, `Annotation`
- `ZupfnoterConfig`, `LayoutConfig`, `ExtractConfig`, `PrinterConfig`

### `packages/core`

`@zupfnoter/core` is the main engine package. It contains the implementation of the transformation pipeline and the rendering API exposed to apps.

Main responsibilities:

- parse ABC via vendored `abc2svg`
- transform parsed ABC into the internal music model
- resolve layered configuration with `Confstack`
- compute beat compression for layout
- generate a drawing model (`Sheet`)
- render the drawing model to SVG

Key modules:

- `AbcParser.ts`
- `AbcToSong.ts`
- `Confstack.ts`
- `buildConfstack.ts`
- `BeatPacker.ts`
- `HarpnotesLayout.ts`
- `SvgEngine.ts`
- `extractSongConfig.ts`
- `initConf.ts`

The package also contains substantial unit and snapshot coverage under `packages/core/src/testing/__tests__`, including fixture-driven comparisons and regression tests for the pipeline stages already implemented.

### `apps/demo`

`@zupfnoter/demo` is the current functional app surface. It is a lightweight Vue/Vite demo that exercises the full pipeline in-browser.

Its role is development and verification rather than product UI. The main view:

- accepts ABC text
- extracts embedded Zupfnoter config
- runs parse -> song transform -> layout -> SVG rendering
- displays the resulting SVG preview

This app is currently the default `pnpm dev` target from the repository root.

### `apps/web`

`@zupfnoter/web` is the intended full web application package, but at the moment it is mostly scaffold state.

Current characteristics:

- Vue starter structure is present
- dependencies already include `@zupfnoter/core` and `@zupfnoter/types`
- router exists but has no routes
- generic scaffold components and starter views are still present

This package is clearly reserved for the later Phase 5 editor/preview application.

### `apps/cli`

`@zupfnoter/cli` is intended to provide command-line rendering for SVG and PDF export without a browser.

At present it is only a stub and does not implement the planned render command surface yet.

## 3. Transformation Pipeline Stages

The repository follows the legacy Zupfnoter processing model and already implements most of the pipeline through SVG output.

### Stage 1: `ABC text -> AbcModel`

Implemented by `AbcParser`.

- wraps vendored `abc2svg`
- isolates direct parser integration inside `packages/core`
- converts ABC input text into an internal parsed model

### Stage 2: `AbcModel -> Song`

Implemented by `AbcToSong`.

Responsibilities include:

- transforming notes, rests, synch points, and structural symbols
- extracting metadata
- handling repetitions, variants, ties, slurs, tuplets, and annotations
- computing beat maps
- attaching layout-relevant neighbor information such as previous/next playable context

The output is the normalized music model represented by `Song`.

### Stage 3: `Song -> Sheet`

Implemented by `HarpnotesLayout`, with support from `Confstack`, `buildConfstack`, and `computeBeatCompression`.

Responsibilities include:

- building the effective extract-specific configuration stack
- computing vertical compression for beats
- laying out notes, pauses, flowlines, gotos, tuplets, lyrics, legends, and barnumbers
- producing a drawing model composed of `DrawableElement` nodes

The output is the drawing model represented by `Sheet`.

### Stage 4: `Sheet -> SVG`

Implemented by `SvgEngine`.

Responsibilities include:

- rendering ellipses, glyphs, paths, annotations, flowlines, and images
- producing a self-contained SVG string
- translating the drawing model into a browser-displayable output format

This is the current end of the fully implemented rendering path.

## 4. Missing Or Incomplete Parts

Several major parts are still planned or only partially implemented.

### Incomplete app surfaces

- `apps/web` is not yet the real product UI. It remains a scaffold package with no editor/preview workflow wired up.
- `apps/cli` is only a placeholder and does not yet implement the planned command-line render interface.

### Missing rendering path

- There is no implemented `PdfEngine` in `packages/core/src`.
- The current completed output path ends at SVG generation.

### Missing UI interactivity

The SVG engine exists, but the interactive editing workflow is not yet in place:

- click from SVG element back to ABC source
- highlight SVG elements from editor selection
- full editor/preview synchronization

These are still Phase 5 concerns in the documented plan.

### Missing advanced configuration features

- voice styles are documented but not yet implemented as a completed feature
- worker-based execution is planned but not present
- command system, config editor, file integration, and MIDI player are not present yet

### Documentation and repo-structure inconsistencies

There are a few visible hygiene issues in the current repo state:

- the root `tsconfig.json` references `packages/types`, `packages/core`, `apps/web`, and `apps/cli`, but not `apps/demo`
- some planning rules historically assumed a stricter `docs/<phase>/spec.md` layout than the repository actually uses; the current documentation now allows supplemental `spec-<topic>.md` files per phase

## Summary

The repository already has the important domain core in place:

- shared type system
- ABC parsing
- music-model transformation
- layout generation
- SVG rendering
- meaningful automated test coverage around those stages

What is still missing is the production-facing shell around that core:

- real web application
- CLI
- PDF export
- editor/SVG interactivity
- worker offloading
- post-migration features such as voice styles

## How Ona Structured The Project

Ona structured the repository as a layered monorepo with a strict separation between shared data contracts, transformation logic, and application shells.

### Separation Between Types, Core, And Apps

The lowest layer is `@zupfnoter/types`. This package defines the shared data model for the whole system and is intentionally limited to interfaces and type aliases.

It provides:

- music model types such as `Song`, `Voice`, `Playable`, `Note`, `Pause`, and `Goto`
- drawing model types such as `Sheet`, `Ellipse`, `Glyph`, `Annotation`, and `FlowLine`
- configuration types such as `ZupfnoterConfig`, `LayoutConfig`, `ExtractConfig`, and `PrinterConfig`

The next layer is `@zupfnoter/core`. This package depends on `@zupfnoter/types` and implements the actual engine. It contains parser integration, transformation stages, layout, rendering, and configuration resolution logic. It does not depend on the app packages, which keeps it reusable across browser, demo, CLI, and later worker execution contexts.

The top layer is `apps/`. Ona kept these packages thin:

- `apps/demo` is the current working integration surface for pipeline verification
- `apps/web` is reserved for the later full editor/preview application
- `apps/cli` is the future command-line surface and is still a stub

This gives the repository a clean dependency direction:

- `types` defines models
- `core` transforms and renders those models
- `apps` consume the reusable `core` API

### How Transformations Are Organized

Ona organized transformations as explicit pipeline stages with clear model boundaries between them.

The stages are:

1. `ABC text -> AbcModel`
2. `AbcModel -> Song`
3. `Song -> Sheet`
4. `Sheet -> SVG`

Each stage has a dedicated implementation in `@zupfnoter/core`:

- `AbcParser` wraps the vendored `abc2svg` parser and isolates direct parser integration
- `AbcToSong` converts parsed ABC into the internal music model
- `HarpnotesLayout` converts the music model into a drawing model
- `SvgEngine` converts the drawing model into standalone SVG output

This structure mirrors the legacy Zupfnoter architecture, but with stronger type boundaries and package separation. Instead of mixing parsing, music semantics, layout, and rendering in one place, the rewrite keeps them as sequential domain stages with explicit input and output models.

That organization has a few consequences:

- each stage can be tested independently
- intermediate models such as `Song` and `Sheet` can be serialized for fixtures and regression testing
- app code only needs to orchestrate the pipeline instead of reimplementing domain logic

### How Configuration (`Confstack`) Is Handled

Configuration is handled through a layered resolver called `Confstack`.

Rather than passing a single mutable config object through the system, Ona separated the mechanism for resolving configuration from the policy that assembles Zupfnoter-specific layers.

`Confstack` itself is generic. It provides:

- `push()` and `pop()` for stack layers
- dot-path lookup such as `layout.X_SPACING`
- `require()` for mandatory values
- subtree and flattened access helpers
- late binding support
- circular dependency detection

Zupfnoter-specific stack assembly is kept in `buildConfstack.ts`, not inside `Confstack.ts`. That file applies project-specific layering rules for:

- global layout and printer defaults
- base extract inheritance from `extract.0`
- target extract values
- extract-specific printer overrides
- extract-specific layout overrides

There is also a second configuration source path at the song level. `extractSongConfig.ts` parses embedded `%%%%zupfnoter.config` blocks from the ABC text, and `mergeSongConfig()` merges those values with the defaults produced by `initConf()`.

This means configuration is handled in two steps:

1. build the effective `ZupfnoterConfig` from defaults plus song-embedded overrides
2. build an extract-specific `Confstack` from that config for layout and rendering

The important architectural rule is that configuration resolution is centralized. Layout and packing code read resolved values from `Confstack` instead of performing ad hoc config merging locally. That keeps configuration behavior consistent across the pipeline and makes overrides predictable.
