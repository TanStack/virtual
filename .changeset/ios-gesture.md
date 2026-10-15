---
'@tanstack/virtual-core': patch
---

refactor(virtual-core): move the iOS touch gesture tracking into its own internal module. One fix along the way: changing the scroll element no longer carries over a pending iOS late-fling window, which could defer corrections on the new element for 150ms.
