---
'@tanstack/virtual-core': patch
---

fix(virtual-core): compute `getOffsetForIndex` (and the first write of `scrollToIndex`) from the current measurements, not from those of the last render
