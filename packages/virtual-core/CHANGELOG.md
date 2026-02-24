# @tanstack/virtual-core

## 3.13.19

### Patch Changes

- Fix crash when component unmounts during `scrollToIndex` by adding a null guard for `targetWindow` inside the `requestAnimationFrame` callback ([#1129](https://github.com/TanStack/virtual/pull/1129))

## 3.13.18

### Patch Changes

- revert(virtual-core): "notify framework when count changes" 2542c5a ([#1112](https://github.com/TanStack/virtual/pull/1112))

## 3.13.17

### Patch Changes

- fix(virtual-core): preserve auto alignment for visible items when scrolling ([#1110](https://github.com/TanStack/virtual/pull/1110))

## 3.13.16

### Patch Changes

- fix(virtual-core): improve scrollToIndex reliability in dynamic mode ([#1106](https://github.com/TanStack/virtual/pull/1106))
  - Wait extra frame for ResizeObserver measurements before verifying position
  - Abort pending scroll operations when new scrollToIndex is called

## 3.13.15

### Patch Changes

- fix(virtual-core): scroll to last index properly ([#1105](https://github.com/TanStack/virtual/pull/1105))

## 3.13.14

### Patch Changes

- Fix: Correct lane assignments when lane count changes dynamically ([#1095](https://github.com/TanStack/virtual/pull/1095))

  Fixed a critical bug where changing the number of lanes dynamically would cause layout breakage with incorrect lane assignments. When the lane count changed (e.g., from 3 to 2 columns in a responsive masonry layout), some virtual items would retain their old lane numbers, causing out-of-bounds errors and broken layouts.

  **Root Cause**: After clearing measurements cache on lane change, the virtualizer was incorrectly restoring data from `initialMeasurementsCache`, which contained stale lane assignments from the previous lane count.

  **Fix**: Skip `initialMeasurementsCache` restoration during lane transitions by checking the `lanesSettling` flag. This ensures all measurements are recalculated with correct lane assignments for the new lane count.

  **Before**:

  ```typescript
  // With lanes = 2
  virtualItems.forEach((item) => {
    columns[item.lane].push(item) // ❌ Error: item.lane could be 3
  })
  ```

  **After**:

  ```typescript
  // With lanes = 2
  virtualItems.forEach((item) => {
    columns[item.lane].push(item) // ✅ item.lane is always 0 or 1
  })
  ```

  This fix is essential for responsive masonry layouts where column count changes based on viewport width. No performance impact as it only affects the lane change transition path.

## 3.13.13

### Patch Changes

- Fix: Notify framework when count changes to update getTotalSize() ([#1085](https://github.com/TanStack/virtual/pull/1085))

  Fixed an issue where `getTotalSize()` would return stale values when the `count` option changed (e.g., during filtering or search operations). The virtualizer now automatically notifies the framework when measurement-affecting options change, ensuring the UI updates correctly without requiring manual `useMemo` workarounds.

  **Before**: When filtering items, the list container would maintain its previous height, causing excessive blank space (when count decreased) or inaccessible items (when count increased).

  **After**: Height updates automatically when count changes, providing the correct user experience.

  This fix applies to all framework adapters and has minimal performance impact (< 0.1ms per change).

- fix: stabilize lane assignments in masonry layout ([#1080](https://github.com/TanStack/virtual/pull/1080))

  Added lane assignment caching to prevent items from jumping between lanes when viewport is resized. Previously, items could shift to different lanes during resize due to recalculating "shortest lane" with slightly different heights.

  Changes:
  - Added `laneAssignments` cache (Map<index, lane>) to persist lane assignments
  - Lane cache is cleared when `lanes` option changes or `measure()` is called
  - Lane cache is cleaned up when `count` decreases (removes stale entries)
  - Lane cache is cleared when virtualizer is disabled

## 3.13.12

### Patch Changes

- fix(virtual-core): scroll to index doesn't scroll to bottom correctly ([#1029](https://github.com/TanStack/virtual/pull/1029))

## 3.13.11

### Patch Changes

- Revert "Adapt default logic to adjust scroll position only on backward scrolling (#1002)" ([#1026](https://github.com/TanStack/virtual/pull/1026))

## 3.13.10

### Patch Changes

- fix(virtual-core): Adapt default logic to adjust scroll position only on backward scrolling ([#1002](https://github.com/TanStack/virtual/pull/1002))

## 3.13.9

### Patch Changes

- fix(virtual-core): fix `Error: Unexpected undefined` ([#1004](https://github.com/TanStack/virtual/pull/1004))

## 3.13.8

### Patch Changes

- fix(virtual-core): loosen approxEqual to allow 1px difference ([#995](https://github.com/TanStack/virtual/pull/995))

## 3.13.7

### Patch Changes

- fix(virtual-core): prevent measurement jitter when scale is applied ([#986](https://github.com/TanStack/virtual/pull/986))

## 3.13.6

### Patch Changes

- fix(virtual-core): fix total size calculation for single item in multi-lane ([`042616f`](https://github.com/TanStack/virtual/commit/042616f39ced842470db0b4b40fca77f22454b7f))

## 3.13.5

### Patch Changes

- fix(core): handle case when item count is less than or equal to lanes ([#964](https://github.com/TanStack/virtual/pull/964))

## 3.13.4

### Patch Changes

- fix(virtual-core): update maybeNotify cache when deps change ([#957](https://github.com/TanStack/virtual/pull/957))

- fix(virtual-core): set `useScrollendEvent` default to false for bette… ([#951](https://github.com/TanStack/virtual/pull/951))

## 3.13.3

### Patch Changes

- fix(virtual-core): expand range in masonry layouts to catch items from all lanes ([#937](https://github.com/TanStack/virtual/pull/937))
