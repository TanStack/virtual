---
'@tanstack/virtual-core': patch
---

Fix crash when component unmounts during `scrollToIndex` by adding a null guard for `targetWindow` inside the `requestAnimationFrame` callback
