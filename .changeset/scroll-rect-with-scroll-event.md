---
'@tanstack/virtual-core': patch
---

Read the scroll element's size along with each scroll event. After a resize the browser fires the scroll event (from the clamped position) before the ResizeObserver runs, so an update could pair the new scroll position with the old size.
