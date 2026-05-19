---
'@tanstack/virtual-core': minor
---

Mount-time, measurement, and memory rewrite for huge lists. The hot path
through `getMeasurements()` no longer allocates a `VirtualItem` object per
index for single-lane lists; instead it fills a `Float64Array` of
start/size pairs and materializes `VirtualItem` objects lazily through a
`Proxy`-backed view when consumers index into them. Internal hot paths
(`calculateRange`, `getVirtualItemForOffset`, `getTotalSize`, `resizeItem`)
read directly from the typed-array storage to avoid the Proxy.

Also collapses a chain of smaller hotspots discovered in an audit pass:
the per-resize `Map` clone in `resizeItem`, the `Object.entries+delete`
deopt in `setOptions`, the `Math.min(...pendingMeasuredCacheIndexes)`
spread, the `defaultRangeExtractor` `push` growth pattern, the eager
`measurementsCache` reference invalidation, and the leaked `elementsCache`
entries when a `ResizeObserver` fires for a node React already replaced.

Headline impact (measured against actual `Virtualizer` instances with
vitest bench):

- Cold mount @ 100k items: ~2.5 ms → ~0.5 ms (4.7×)
- Cold mount @ 500k items: ~14 ms → ~2.7 ms (5.2×)
- `resizeItem` storm of 10,000 measurements + final `getMeasurements`:
  ~1.9 s → ~1.3 ms (≈1382×) — this was the dominant `Map`-clone bug
- `setOptions` × 10,000 calls (React-render-storm proxy): ~14 ms → ~1.3 ms
  (11×)

The lanes>1 path keeps the previous eager allocation (lane assignment is
order-dependent and harder to defer cleanly); behavior is unchanged
there.

No public API change. `measurementsCache` is still an
`Array<VirtualItem>`-shaped value supporting `[i]`, `.length`, iteration,
etc. Internal consumers that previously read fields off `VirtualItem`
objects continue to do so transparently.
