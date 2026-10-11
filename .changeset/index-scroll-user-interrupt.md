---
'@tanstack/virtual-core': patch
---

fix(virtual-core): let a user scroll end a non-smooth `scrollToIndex` before reconcile has seen it land, so a later measurement no longer pulls the user back to the old target
