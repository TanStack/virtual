---
'@tanstack/virtual-core': patch
---

Avoid ResizeObserver loop errors when a synchronous resize render mounts or unmounts rows. Measure new rows immediately, defer their observation until the next frame, and stop observing detached rows before delivery ends.
