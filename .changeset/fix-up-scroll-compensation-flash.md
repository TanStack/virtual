---
'@tanstack/virtual-core': patch
---

Fix a one-frame viewport jump when above-viewport rows resize while scrolling up (#1227). `resizeItem` writes `scrollTop` synchronously inside the ResizeObserver callback to compensate for the size change, but then notified asynchronously — so the browser could paint a frame with the new `scrollTop` and the old item transforms, making the content jerk by the resize delta and snap back. When a compensation actually moves the scroll position, `resizeItem` now notifies synchronously so the transform commit lands in the same paint as the scroll write. Resizes that don't move the scroll position (below-fold measurements, iOS-deferred adjustments) keep the cheaper async notify.
