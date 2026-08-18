---
'@tanstack/virtual-core': patch
---

Cancel the pending `isScrolling` reset when a scroll observer is torn down, and reset `isScrolling` and `scrollDirection` in `cleanup()` so they don't stay stuck after the scroll element changes or is removed.
