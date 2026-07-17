---
'@tanstack/virtual-core': patch
---

Clamp the tracked `scrollOffset` at 0 when applying end-anchor measurement compensation and when re-anchoring in `setOptions`. Previously, with `anchorTo: 'end'` and content shorter than the viewport, items measuring smaller than their estimates drove the tracked offset negative with no scroll event to ever correct it — `getDistanceFromEnd()` reported a permanent phantom distance and iOS deferred measurement corrections stayed wedged forever.
