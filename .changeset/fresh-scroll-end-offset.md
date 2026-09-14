---
'@tanstack/virtual-core': patch
---

Read the current scroll offset when the debounced scroll-end fallback fires so measurement adjustments made since the last browser scroll event are not overwritten by stale state.
