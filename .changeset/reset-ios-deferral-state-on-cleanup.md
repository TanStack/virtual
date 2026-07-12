---
'@tanstack/virtual-core': patch
---

Reset iOS gesture/deferral state in `cleanup()` so it no longer leaks across scroll element swaps.
