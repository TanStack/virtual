---
'@tanstack/virtual-core': minor
---

feat: add skipRemeasurementOnBackwardScroll option to reduce stuttering

Adds new option to skip re-measuring already-cached items during backward scrolling. 
This prevents scroll adjustments that conflict with the user's scroll direction, reducing stuttering in dynamic content like social feeds or chat messages.

When enabled, cached measurements are reused during backward scroll while `isScrolling` is true. Layout settles correctly once scrolling stops.

**Changes:**
- Added `skipRemeasurementOnBackwardScroll` option (default: `false`)
- Skip re-measurement in `_measureElement` when scrolling backward with cached items