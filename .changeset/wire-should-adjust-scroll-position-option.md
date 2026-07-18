---
'@tanstack/virtual-core': patch
---

Wire `shouldAdjustScrollPositionOnItemSizeChange` into `VirtualizerOptions` so it can actually be supplied. `resizeItem` read the predicate from an instance field that `setOptions` never assigned, so passing the documented escape hatch through options silently did nothing and the default backward-scroll compensation skip could not be opted out of. The predicate is now read from options first, falling back to a directly-assigned instance field for back-compat.
