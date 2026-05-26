---
'@tanstack/virtual-core': patch
---

Eagerly adjust scrollOffset on prepend to prevent one-frame jump with anchorTo: 'end'

When items are prepended with `anchorTo: 'end'` and dynamic sizes, the virtualizer would compute the wrong visible range for one frame (using stale estimate-based positions) and then correct in the next frame via `_willUpdate`, producing a visible jump. This fix eagerly adjusts `scrollOffset` in `setOptions` during the render pass so `calculateRange`/`getVirtualItems` return the correct items immediately.
