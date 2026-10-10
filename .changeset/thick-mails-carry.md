---
'@tanstack/solid-virtual': patch
---

Defer non-sync `onChange` updates to a microtask. `measureElement` runs from an item's ref while `<For>` is still iterating the virtual-item store, so the re-entrant `resizeItem` notification reconciled the store array underneath the running `mapArray`, which then read `undefined` items. Scroll-driven updates (`sync: true`) and option changes are still applied synchronously. Reading `getVirtualItems()` or `getTotalSize()` in the same tick as `resizeItem()` or `measure()` now returns the previous value; the update still lands before paint.
