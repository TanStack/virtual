---
'@tanstack/virtual-core': patch
---

Rebuild the layout once per ResizeObserver batch instead of once per entry after a scroll adjustment. Dragging the scrollbar on large lists with measured rows no longer drops frames.
