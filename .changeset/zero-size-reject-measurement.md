---
'@tanstack/virtual-core': patch
---

Fix: reject 0-size ResizeObserver measurement when item has cached size

Prevent 0-size measurements from overwriting a previously cached size in resizeItem, avoiding infinite re-render loops when elements are temporarily hidden (e.g., display:none causes ResizeObserver to deliver 0 size, which triggers calculateRangeImpl to include all items and freeze the browser).
