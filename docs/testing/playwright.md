# Playwright

Playwright validates browser workflows for `apps/web`.

## Setup

Install dependencies and browser binaries:

```bash
pnpm install
pnpm playwright:install
```

## Commands

Run the E2E suite:

```bash
pnpm test:e2e
```

Run with the Playwright UI:

```bash
pnpm test:e2e:ui
```

The config starts `apps/web` on `http://127.0.0.1:5173`.

To run against an existing local or remote server, set:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 pnpm test:e2e
```

When `PLAYWRIGHT_BASE_URL` is set, Playwright does not start the Vite dev server.
