# Chat example — browser tests

In the monorepo: install at the repo root as usual (`pnpm install` — the workspace
brings in this example's `@playwright/test` too). Then, from this directory
(examples/marko/chat):

    npx playwright install chromium   # one-time browser download
    npm run test:e2e                  # starts the dev server itself, runs 7 tests, tears down

Standalone (this folder copied out of the monorepo): run `pnpm install` (or
`npm install`) inside the folder first, then the same two commands.

No separate server start needed: playwright.config.ts declares a webServer
(marko-run dev --port 4173) that Playwright boots and stops around the run.
