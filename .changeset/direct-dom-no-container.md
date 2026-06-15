---
'@tanstack/react-virtual': patch
---

Make `directDomUpdates` a no-op for direct DOM writes when `containerRef` is omitted. Previously the virtualizer still wrote item positions while never sizing the container (a broken half-state). Now omitting `containerRef` skips all direct writes while still skipping re-renders, letting consumers own the DOM updates themselves (e.g. in `onChange`).
