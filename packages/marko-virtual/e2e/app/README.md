# Browser test app (test harness — not a shipped example)

The whole Marko browser suite: one app, one server, one Playwright config. Each
scenario is a route under src/routes/, and each spec under e2e/ drives its own
route. `npm run test:e2e` builds the app, serves it, runs every spec, tears down.

Two kinds of route live here:

- **Option gates** (enabled, rtl, scroll-margin, cached, lanes-mode,
  measure-element, debug, scroll-events, window-horizontal,
  window-initial-offset, window-example) — deliberately artificial pages, one per
  option, asserting the option observably changes behavior. Tier 1 (jsdom
  forwarding for every option) lives in the package's options.test.ts, which also
  owns anything only observable in dev — core's debug logging is compiled out by
  `process.env.NODE_ENV !== 'production'`, so the browser gate for `debug` asserts
  only that the option does not disturb rendering. `useAnimationFrameWithResizeObserver`
  remains forwarding-only and explicitly UNPROVEN.
- **Example fixtures** (chat, table, ssr-slice, window, …) — thin wrappers that
  render the real page from examples/marko/&lt;name&gt;:

  ```marko
  import Page from "../../../../../../../examples/marko/fixed/src/routes/+page.marko"
  <Page/>
  ```

  The example is imported, never copied, so the shipped examples are what the
  suite actually covers and a fixture cannot drift from the example it tests.
  api/reply/+handler.ts is re-exported from the chat example for the same reason
  (both chat fixtures POST to an absolute /api/reply, so it is mounted once at the
  app root).

## Why one app

Each example used to carry its own e2e/, playwright.config.ts and port
(4173–4191): 19 dev servers per CI run, 19 copies of the config, and a build-order
coupling that broke the suite. The examples resolve tags through
`@tanstack/marko-virtual`, whose marko.json points at ./dist/tags, so with the
package unbuilt every page 500s — and because marko-run silently falls back to a
random free port when the requested one is taken, that surfaced only as
`Timed out waiting 120000ms from config.webServer`, with the real error nowhere in
the log. Here the vite aliases resolve the adapter and core to **source**, so the
suite needs no build at all, and nx.json declares `test:e2e`
`dependsOn: ["^build"]` so nothing else can fall into that trap either.

## Layout constraints

Relative paths assume exactly this depth: marko.json -> ../../src/tags, vite
aliases -> ../../src/index.ts and ../../../virtual-core/src/index.ts, fixture
imports -> seven levels up to the repo root. Moving this folder means updating all
of them.

Install is covered by the repo-level `pnpm install` via the workspace glob
`packages/marko-virtual/e2e/*`. A first browser run may need
`npx playwright install chromium`.

To debug a spec interactively, start `npm run dev -- --port 4199` (HMR) or
`npm run preview` in one terminal and rerun `npm run test:e2e` — it reuses an
already-running server unless CI is set. MARKO_E2E_PORT points a run at another
port.

## Dependency note (do not re-add `@tanstack/marko-virtual` here)

This app lives INSIDE packages/marko-virtual. Depending on the ancestor makes
pnpm create node_modules/@tanstack/marko-virtual -> ../../.. — a symlink cycle.
`@marko/vite`'s production-only known-templates scan globs `**/*.marko` following
symlinks with no cycle guard, so any `marko-run build` of an app that links the
package dies with ENAMETOOLONG. The dep is also unnecessary: tags resolve through
the relative taglib path, and the adapter and core through the vite aliases. The
nx graph edge that build ordering and cache invalidation need is declared as
`implicitDependencies` in package.json, which costs no symlink. If a real JS
import from the package is ever needed here, use pnpm's `dependenciesMeta`
injected mode (which packs a copy honoring the `files` field, so e2e/ is excluded
and no cycle forms) instead of a plain workspace dependency.

Publishing: not affected — the package's `files` field publishes only dist,
marko.json, and README.md, so nothing under e2e/ reaches npm.

## Known-bug note

The enabled gate carries a documented 250ms settle wait for an upstream core bug
(end-of-scroll debounce timer surviving observeOffset unsubscription and firing a
stale offset into the live instance). Remove the wait if/when the
cancellable-debounce core fix lands; the spec comment marks the spot.
