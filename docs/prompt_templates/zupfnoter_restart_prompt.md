# Codex Restart Prompt: Zupfnoter-TS

You are continuing work in `/Users/beweiche/beweiche_noTimeMachine/zupfnoter-ts`.

## Current project state

- Horch parity is fixed and committed.
- The BeatPacker root cause was fixed:
  - `extract.notebound.minc` is now resolved correctly.
  - `pack_method 1` uses legacy-correct collision/carry semantics.
- Annotation text metrics were cleaned up:
  - `createDefaultAnnotationTextMetrics()` remains in core.
  - `createJsPdfAnnotationTextMetrics(...)` exists as an explicit jsPDF-backed factory.
  - `apps/demo` now passes annotation metrics explicitly into `HarpnotesLayout`.
- Sheet fixture comparisons use a test-only legacy metric adapter.
- `@zupfnoter/core` type-check is green after rebuilding `packages/types`.

## Open gap

- `Twostaff` still fails in `packages/core/src/testing/__tests__/sheet/legacy_comparison.spec.ts`.
- The remaining work is isolated to multi-staff / sheet parity, not Horch, not typecheck, not BeatPacker.

## Relevant files

- `packages/core/src/HarpnotesLayout.ts`
- `packages/core/src/BeatPacker.ts`
- `packages/core/src/TextMetrics.ts`
- `packages/core/src/index.ts`
- `packages/core/src/testing/fixtureLoader.ts`
- `packages/core/src/testing/legacyAnnotationTextMetrics.ts`
- `packages/core/src/testing/__tests__/sheet/legacy_comparison.spec.ts`
- `packages/core/src/testing/__tests__/HarpnotesLayout.spec.ts`
- `apps/demo/src/DemoView.vue`
- `packages/types/src/music.ts`
- `packages/types/src/config.ts`

## Constraints

- Make small, targeted changes only.
- Prefer production-code fixes over test rewrites.
- No broad refactoring.
- No unrelated formatting changes.
- Do not introduce `any` without a strong reason.
- Do not use non-null assertions (`!`).
- Do not change the existing prompt template workflow unless necessary.

## What must explicitly NOT be changed

- Do not undo the Horch fix.
- Do not reintroduce hidden jsPDF fallback logic into layout code.
- Do not remove `createDefaultAnnotationTextMetrics()` from core.
- Do not touch unrelated user changes, especially `docs/prompt_templates/prompt-template.md`.
- Do not mass-update snapshots.
- Do not change the demo merely to make tests pass unless the wiring is part of the architecture change.

## Acceptance criteria

- `pnpm --filter @zupfnoter/core exec vitest run src/testing/__tests__/sheet/legacy_comparison.spec.ts -t Twostaff` passes.
- The fix is minimal and localized.
- `pnpm --filter @zupfnoter/core type-check` remains green.
- `pnpm --filter @zupfnoter/core exec vitest run src/testing/__tests__/BeatPacker.spec.ts` remains green.
- No regressions in the Horch fixture or the demo wiring.

## Suggested next step

Start by reproducing and classifying the first concrete mismatch in `Twostaff`, then patch the smallest corresponding layout rule in `packages/core/src/HarpnotesLayout.ts`.
