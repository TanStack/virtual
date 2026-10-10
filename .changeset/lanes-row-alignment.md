---
'@tanstack/virtual-core': minor
---

fix(virtual-core): keep lanes aligned after changing `lanes` with `measureElement` (#1036)

- `overscan` now counts whole rows when `lanes > 1`, so every lane renders (and measures) the same number of extra items. This renders more items than before: `lanes: 4, overscan: 2` now adds 8 items on each side instead of 2. `Range` gains an optional `lanes` field that `defaultRangeExtractor` reads; a custom `rangeExtractor` gets row overscan only if it delegates to `defaultRangeExtractor`.
- A ResizeObserver callback now measures all of its entries before notifying, so a synchronous re-render can no longer unmount part of a row before it is measured.
