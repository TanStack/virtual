---
'@tanstack/virtual-core': patch
---

fix(virtual-core): leave resizes measured before a scroll command's write is read back to reconcile, so an upward `scrollToIndex` no longer jumps back and stalls until the safety valve, and build `scrollBy` on a just-written offset
