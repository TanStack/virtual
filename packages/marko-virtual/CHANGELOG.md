# @tanstack/marko-virtual

## 3.15.0

### Minor Changes

- [#1219](https://github.com/TanStack/virtual/pull/1219) [`1323692`](https://github.com/TanStack/virtual/commit/13236928fb4430f22f9c6de41937e24db578c9df) - Post-release follow-ups for the Marko adapter: full option parity for both tags
  (scrollMargin, enabled, isRtl, isScrollingResetDelay, useScrollendEvent,
  useAnimationFrameWithResizeObserver, laneAssignmentMode, useCachedMeasurements,
  debug, custom measureElement; window tag adds horizontal and initialOffset),
  named handle types (VirtualizerHandle / WindowVirtualizerHandle) whose .d.marko
  declarations are generated into dist/tags at build time (via marko-type-check)
  and type-checked in CI, a new Chat + Pretext example (calculated row heights via
  @chenglou/pretext; streamed replies grow through resizeItem), browser e2e suites
  for every example plus option-gate behavioral proofs, TypeScript-strict cleanups
  across examples, and chat example improvements (accurate size estimate,
  load-ahead history trigger, overflow-anchor handling).

### Patch Changes

- [#1243](https://github.com/TanStack/virtual/pull/1243) [`b4a76ca`](https://github.com/TanStack/virtual/commit/b4a76cac25ef7e334c180ceb8c0d859b7c91ab09) - Stop publishing the tags build's incremental state: `marko-type-check` writes
  `dist/tsconfig.tags.tsbuildinfo`, which the `files` field shipped to npm and nx
  cached as part of `dist`. Because `@marko/type-check` always runs incrementally, a
  `dist` that carried that file but not `dist/tags` (which `marko.json` points at)
  made every subsequent build a silent no-op — exit 0, nothing emitted — and any
  consumer then failed to compile with
  `ENOENT: no such file or directory, scandir '.../dist/tags'`. The build now removes
  the file after emitting, so a build always produces `dist/tags`.

## 3.14.4

### Patch Changes

- Updated dependencies [[`a5417b4`](https://github.com/TanStack/virtual/commit/a5417b4b0d3c82876747bb9635db7239c28d3e44)]:
  - @tanstack/virtual-core@3.17.7

## 3.14.3

### Patch Changes

- Updated dependencies [[`7ae32b5`](https://github.com/TanStack/virtual/commit/7ae32b55887fd044a48c788546cd940279b338e0)]:
  - @tanstack/virtual-core@3.17.6

## 3.14.2

### Patch Changes

- Updated dependencies [[`1e3b908`](https://github.com/TanStack/virtual/commit/1e3b908705e04e45be2615f2277580cb09f5cdef), [`7dcfc07`](https://github.com/TanStack/virtual/commit/7dcfc07b877479697124157d3124c09537b87a75)]:
  - @tanstack/virtual-core@3.17.5

## 3.14.1

### Patch Changes

- Updated dependencies [[`6cbecd8`](https://github.com/TanStack/virtual/commit/6cbecd887df56faaee3b6a81a1aae8049de0671e), [`d49cc52`](https://github.com/TanStack/virtual/commit/d49cc526fe248be7b5ad97ec6ac814db8271b0d0), [`cf7834d`](https://github.com/TanStack/virtual/commit/cf7834daade953fea5dfd2ab5685c15771ca300a)]:
  - @tanstack/virtual-core@3.17.4

## 3.14.0

### Minor Changes

- [#1156](https://github.com/TanStack/virtual/pull/1156) [`2b39aef`](https://github.com/TanStack/virtual/commit/2b39aef8099570e31155c2dbbb63612a6bf2a26b) - Add `@tanstack/marko-virtual` — a headless virtualisation adapter for Marko 6 using the runtime-tags API. Provides `<virtualizer>` and `<window-virtualizer>` tags covering fixed, variable, dynamic, grid, smooth-scroll, infinite-scroll, and window virtualisation patterns.
