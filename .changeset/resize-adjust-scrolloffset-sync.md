---
'@tanstack/virtual-core': patch
---

Sync `scrollOffset` in `applyScrollAdjustment` so end-anchored streaming resize isn't lost to browser clamp

With `anchorTo: 'end'` and a dynamically growing last item (token streaming), `resizeItem` writes the scroll adjustment to `scrollTop` before the consumer has grown the sizer, so the browser clamps the write and no scroll event fires. `scrollOffset` stayed stale, the next tick's `wasAtEnd` check failed, and the viewport drifted away from the end. This fix carries the intended target in `scrollOffset` (zeroing `scrollAdjustments`) the same way the prepend path in `setOptions` does, so the next `getVirtualDistanceFromEnd()` reads the post-adjustment position.
