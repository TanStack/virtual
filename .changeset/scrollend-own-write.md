---
'@tanstack/virtual-core': patch
---

With `useScrollendEvent: true`, `scrollToIndex` and `scrollToEnd` no longer stop short of a target that moved while they settled: the `scrollend` that reports the virtualizer's own write again (a size correction, or a write the browser clamped) is no longer read as the user scrolling away. With `anchorTo: 'end'`, rows prepended once a `scrollToIndex` has landed end the command in either mode, so the view stays on the rows it showed rather than moving to the row the index names in the new list.
