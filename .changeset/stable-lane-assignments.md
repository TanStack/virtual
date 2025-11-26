---
'@tanstack/virtual-core': patch
---

fix: stabilize lane assignments in masonry layout

Added lane assignment caching to prevent items from jumping between lanes when viewport is resized. Previously, items could shift to different lanes during resize due to recalculating "shortest lane" with slightly different heights.

Changes:

- Added `laneAssignments` cache (Map<index, lane>) to persist lane assignments
- Lane cache is cleared when `lanes` option changes or `measure()` is called
- Lane cache is cleaned up when `count` decreases (removes stale entries)
- Lane cache is cleared when virtualizer is disabled
