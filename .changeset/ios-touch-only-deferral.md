---
'@tanstack/virtual-core': patch
---

fix(virtual-core): on iOS, defer scroll corrections only for touch-driven scrolls (a finger down, or the momentum after it), so a programmatic landing like `scrollToOffset` compensates before paint instead of snapping later
