---
'@tanstack/virtual-core': patch
---

Improve multi-lane virtualization performance: replace the backward scan in getMeasurements with an incremental per-lane argmin (O(lanes) shortest-lane lookup). Placement output is unchanged and the single-lane fast path is untouched.
