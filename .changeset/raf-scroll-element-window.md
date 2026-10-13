---
'@tanstack/virtual-core': patch
---

fix(virtual-core): with `useAnimationFrameWithResizeObserver`, request frames from the scroll element's window instead of the global one, and cancel frames still queued on cleanup, so a list rendered into another window does not stall while the opener is minimized or occluded
