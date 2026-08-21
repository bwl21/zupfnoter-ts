---
name: update-abc2svg-vendor
description: Update the vendored abc2svg core in zupfnoter-ts from the canonical source, verify the exact upstream version/date, refresh vendor metadata, and run parser, fixture, and parity validation. Use when abc2svg releases a new version or when parser behavior needs to be checked against a newer abc2svg build.
---

# Update the abc2svg vendor

Use this workflow for `packages/core/vendor/abc2svg-1.js`. The repository does
not use the deprecated npm package; it vendors the canonical concatenated build
from Jef Moine's source server.

## 1. Inspect the current vendor

From the repository root:

```bash
rg -o 'abc2svg\\.version="[^"]+";abc2svg\\.vdate="[^"]+"' \\
  packages/core/vendor/abc2svg-1.js | tail -1
git status --short
```

Preserve unrelated user changes. Do not overwrite generated gap or audit
reports while preparing the update.

## 2. Download and verify the requested release

Download to a temporary path first; never replace the tracked vendor before
the version check succeeds:

```bash
curl -fsSL http://moinejf.free.fr/js/abc2svg-1.js \\
  -o /private/tmp/abc2svg-1.<version>.js
rg -o 'abc2svg\\.version="[^"]+";abc2svg\\.vdate="[^"]+"' \\
  /private/tmp/abc2svg-1.<version>.js | tail -1
```

The reported version and date must exactly match the requested release. For
example, the update performed on 2026-07-25 verified:

```text
abc2svg.version="v1.23.4";abc2svg.vdate="2026-07-24"
```

If the source is unreachable or reports another version, stop and report the
blocker. Do not silently use a mirror or an unverified build.

## 3. Replace the vendor and document it

After verification, replace only the vendor file and update
`packages/core/vendor/README.md` with the upstream version/date and the local
download date. Keep the existing source, repository, and license information.

```bash
cp /private/tmp/abc2svg-1.<version>.js packages/core/vendor/abc2svg-1.js
```

Use `apply_patch` for the README metadata. Confirm the tracked file still
reports the requested version/date.

## 4. Validate behavior

Run at minimum:

```bash
pnpm --filter @zupfnoter/core run type-check
pnpm --filter @zupfnoter/core exec vitest run \\
  src/testing/__tests__/practiceQrPosition.spec.ts \\
  src/testing/__tests__/SvgEngine.spec.ts \\
  src/testing/__tests__/PdfEngine.spec.ts --reporter=dot
pnpm --filter @zupfnoter/core exec vitest run \\
  src/testing/__tests__/song/legacy_comparison.spec.ts \\
  src/testing/__tests__/sheet/legacy_comparison.spec.ts \\
  src/testing/__tests__/output_svg/legacy_comparison.spec.ts \\
  --reporter=dot
```

Use the package's `test:pdf-parity` script for PDF parity when needed. Record
the exact pass/fail counts and distinguish abc2svg parser failures from TS
pipeline parity differences. Do not mask a new upstream behavior by changing
parity expectations without first identifying its cause.

## 5. Review and hand off

Run:

```bash
git diff --check
git status --short
```

Do not stage generated `fixtures/reports/*` files unless the user explicitly
requests updated reports. Mention the upstream version/date, validation
results, remaining parity differences, and any uncommitted generated files.
