---
'@tanstack/virtual-core': minor
---

Add `useCachedMeasurements` option to skip DOM measurement when the list is hidden (e.g. `display: none`). When enabled, the default `measureElement` returns the cached size or `estimateSize` fallback instead of reading the DOM, preventing ResizeObserver from resetting measurements to zero.
