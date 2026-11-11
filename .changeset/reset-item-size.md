---
'@tanstack/virtual-core': minor
---

Add `resetItemSize(index)` to forget one item's measured size, for content that changed shape while its key stayed the same. The item falls back to `estimateSize` until it is measured again, that measurement counts as a first one for scroll anchoring, and `takeSnapshot()` leaves the item out until then. A rendered item is measured again right away.
