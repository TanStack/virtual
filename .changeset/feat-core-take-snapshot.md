---
'@tanstack/virtual-core': minor
---

Add `takeSnapshot()` instance method for scroll-restoration round-trips.
Returns the currently-measured items as plain `VirtualItem` objects;
pair with the current `scrollOffset` to persist scroll position across
remounts (route navigation, list-view modals, etc.). The result feeds
back through the existing `initialMeasurementsCache` option:

```tsx
const snapshot = virtualizer.takeSnapshot()
const offset = virtualizer.scrollOffset
// later, on remount:
useVirtualizer({
  // …
  initialMeasurementsCache: snapshot,
  initialOffset: offset,
})
```

Closes the gap to virtua's `takeCacheSnapshot()` and react-virtuoso's
`getState`. Only items actually rendered (and thus measured) are
included; unmeasured items fall back to `estimateSize` on restore.
