---
'@tanstack/virtual-core': patch
---

Keep scrollToIndex reconciliation active until pending ResizeObserver measurements can update its target, including when useAnimationFrameWithResizeObserver is enabled. Respect an external scroll away from a reached target during this settling period.
