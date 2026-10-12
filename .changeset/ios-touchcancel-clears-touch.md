---
'@tanstack/virtual-core': patch
---

fix(virtual-core): treat iOS `touchcancel` like `touchend` so interrupted gestures cannot leave touch state stuck and keep scroll anchoring suppressed
