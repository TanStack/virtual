---
'@tanstack/virtual-core': patch
---

`scrollToIndex` and `scrollToEnd` no longer stop short of a target that moved while they settled: the report of the virtualizer's own write at rest (a size correction, or a write the browser clamped) is no longer read as the user scrolling away. This applies to `scrollend` with `useScrollendEvent: true`, and to the debounced fallback in the default mode when the next frame is slow. With `anchorTo: 'end'`, rows prepended once a `scrollToIndex` has landed end the command in either mode, so the view stays on the rows it showed rather than moving to the row the index names in the new list.
