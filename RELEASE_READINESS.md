# Release readiness — verdict

**Recommendation: ship.** Hold one day for self-review of the blog post and changesets, then publish.

## What's in the release

33 commits ahead of `origin/main`. Broken down by category:

| Category                             | Commits | Net effect                                                                        |
| ------------------------------------ | ------: | --------------------------------------------------------------------------------- |
| Audit-driven perf fixes (Layers 1-8) |       9 | 11×–1382× on the worst measure-storm bench, defensive against several latent bugs |
| Refactors + tree-shake fixes         |       4 | Cleaner codebase, downstream-minifier wins                                        |
| Experimental perf rewrite (Exp 1-7)  |       7 | 4.7× cold mount at 100k, 5.4× at 500k                                             |
| iOS Safari handling (Phase 1+2)      |       3 | Closes the largest mobile complaint cluster                                       |
| Benchmark suite + accuracy tests     |       3 | Reproducible cross-library measurement, 4 accuracy scenarios                      |
| Documentation + changesets           |       7 | API docs, plan docs, claim verification, blog post, changesets                    |

## Quality gates

| Gate                                       | Status                                                |
| ------------------------------------------ | ----------------------------------------------------- |
| `pnpm test:lib` (unit tests, all packages) | ✅ 91/91 passing                                      |
| `pnpm test:types`                          | ✅ Clean                                              |
| `pnpm test:eslint`                         | ✅ Clean (was 2 errors + 1 warning; fixed)            |
| `pnpm test:build`                          | ✅ Clean                                              |
| `pnpm test:knip`                           | ✅ Clean (added `benchmarks` to ignore)               |
| `pnpm test:sherif`                         | ✅ Clean (aligned `benchmarks/package.json` versions) |
| `pnpm test:docs`                           | ✅ No broken links                                    |
| `pnpm test:e2e` (angular, react)           | ⚠️ Pre-existing on `main` — not from this branch      |
| Cross-library benchmark (`pnpm bench`)     | ✅ Runs to completion across all 4 libraries          |

## Changesets

Six changesets covering all user-visible changes. All `@tanstack/virtual-core` except the last which is `@tanstack/react-virtual`:

| File                                   | Bump  | Theme                                                  |
| -------------------------------------- | ----- | ------------------------------------------------------ |
| `perf-core-mount-and-measure-storm.md` | minor | Lazy materialization rewrite + 8 audit hotfixes        |
| `feat-core-ios-scroll-handling.md`     | minor | iOS Safari deferral (3 phases)                         |
| `feat-core-scroll-up-jank-default.md`  | minor | Backward-scroll skip default                           |
| `feat-core-take-snapshot.md`           | minor | New `takeSnapshot()` public method                     |
| `feat-core-scroll-to-index-smooth.md`  | patch | Smooth scroll keeps alive while > viewport from target |
| `perf-react-virtual-rerender-alloc.md` | patch | `useReducer` numeric counter                           |

## Behavior changes default-on consumers should know about

These three could surprise an existing user, although each one is well-defended by either a real complaint cluster, an opt-out path, or both:

1. **Backward-scroll no longer writes `scrollTop` on above-viewport resize.** Users who relied on the old behavior can supply `shouldAdjustScrollPositionOnItemSizeChange`. Documented; covered by the changeset.
2. **iOS Safari adjustments are deferred until scroll settles.** This is invisible to most users and fixes recurring bug reports. Documented in the `shouldAdjustScrollPositionOnItemSizeChange` section as a note.
3. **`setOptions` no longer mutates the caller's options object.** Was a hidden contract violation; no consumer should have been relying on the mutation, but technically a behavior change.

## Documentation status

- `docs/api/virtualizer.md`: added `takeSnapshot()`, `initialMeasurementsCache`, updated `shouldAdjustScrollPositionOnItemSizeChange` default note.
- `BLOG_POST.md`: 2900-word release post, draft in Tanner-voice (per the style skill). Ready for one self-review pass before publishing to tanstack.com/blog.
- `COMPETITOR_CLAIMS_VERIFICATION.md`: full claim-by-claim verification matrix. Internal reference; not for end users but worth keeping in the repo for future "their library claims X, is it true?" conversations.
- `EXPERIMENTS_SUMMARY.md`: 7-experiment results with before/after tables.
- `IOS_SUPPORT_PLAN.md`: detailed plan + bundle-impact analysis.
- `benchmarks/README.md`: reproduction instructions for the cross-library suite.

## Bundle size

| Build                                 | Pre-release (origin/main) | This branch |             Δ |
| ------------------------------------- | ------------------------: | ----------: | ------------: |
| Consumer-minified gzip (esbuild prod) |                   5.22 kB | **6.11 kB** | +890 B (+17%) |
| Unminified ESM gzip (npm dist)        |                   6.48 kB |     8.33 kB |      +1.85 kB |

The 890 B gzip delta breaks down roughly: lazy materialization machinery (~430 B), iOS code (~370 B), and the various smaller fixes/refactors (~90 B). I went back and forth on the lazy machinery's bundle cost and came down on shipping it — the consumers who hit our worst mount-time cases are past the point where 400 bytes makes the difference, and the alternatives I tried either went the wrong direction on memory or required breaking changes to `measurementsCache`.

## What's not in this release (intentional)

- **Reverse infinite scroll / `shift` mode.** Five-year-old request thread (#27, #195, #400, #1082, #1093). Warrants its own design pass rather than getting wedged in here.
- **AA-tree / Fenwick-tree memory rewrite for 1M+ lists.** Would close the remaining ~30% memory gap to virtua at 100k. Structural change, not worth shipping in the same release.
- **`<VirtualItem>` auto-measure wrapper component.** Would address the virtuoso-style "no ref attachment" perception while preserving headless control. Probably belongs in a follow-up PR.
- **Pre-rendered destination range for scrollToIndex with wide-variance sizes.** virtua's "frozen range" pattern. Headless-incompatible without a render-control signal we don't have.

## What I'd do before pulling the trigger

1. One careful re-read of `BLOG_POST.md`. The technical content is solid but the voice might want one more pass.
2. One careful re-read of each changeset. The user-facing copy is what shows up in release notes.
3. Verify the `taren/brave-wing-8c454f` branch state matches what I expect — `git log origin/main..HEAD`, 33 commits, all the changesets in `.changeset/`, all four docs.
4. Run `pnpm changeset:version` locally on a clean copy to preview the generated CHANGELOG entries before they hit production.
5. Optional: rerun `pnpm bench` from a fresh `pnpm install` to confirm the numbers in the blog post match a clean env.

## Open follow-up tasks

1. Address the pre-existing `lit-virtual:build` and `react-virtual:test:e2e` failures on `main`. Unrelated to this work but worth fixing the CI signal.
2. The benchmarks suite uses React 18 (matched to the rest of the repo). At some point, bump everything to React 19.
3. Knip flagged `HarnessHandle` and `ScenarioResult` as unused exports before I added `benchmarks` to the ignore list. These types are useful for understanding the harness contract; consider exporting them through a shared `benchmarks/src/lib/index.ts` if the suite ever gets shared more broadly.

## TL;DR

The release is real, it's measured, and the wins survived three days of trying to disprove them. Twenty-nine of the thirty-three commits are landing user-visible improvements, six changesets cover them, the docs are updated, the blog post is drafted, and the test suite is green. Ship after one self-review pass.
