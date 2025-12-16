---
'@tanstack/virtual-core': patch
---

Fix: Correct lane assignments when lane count changes dynamically

Fixed a critical bug where changing the number of lanes dynamically would cause layout breakage with incorrect lane assignments. When the lane count changed (e.g., from 3 to 2 columns in a responsive masonry layout), some virtual items would retain their old lane numbers, causing out-of-bounds errors and broken layouts.

**Root Cause**: After clearing measurements cache on lane change, the virtualizer was incorrectly restoring data from `initialMeasurementsCache`, which contained stale lane assignments from the previous lane count.

**Fix**: Skip `initialMeasurementsCache` restoration during lane transitions by checking the `lanesSettling` flag. This ensures all measurements are recalculated with correct lane assignments for the new lane count.

**Before**: 
```typescript
// With lanes = 2
virtualItems.forEach(item => {
  columns[item.lane].push(item) // ❌ Error: item.lane could be 3
})
```

**After**:
```typescript
// With lanes = 2
virtualItems.forEach(item => {
  columns[item.lane].push(item) // ✅ item.lane is always 0 or 1
})
```

This fix is essential for responsive masonry layouts where column count changes based on viewport width. No performance impact as it only affects the lane change transition path.

