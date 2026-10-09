---
'@tanstack/react-virtual': patch
---

fix(react-virtual): position `directDomUpdates` rows that mount without the owner re-rendering

Rows were only positioned by the owner's layout effect or the next `onChange`. A row mounted by a child that re-renders on its own (local state, context, a resolved Suspense boundary) skipped both when it was fixed-size, and stayed unpositioned until the range changed. Rows are now positioned as they register through `measureElement`, and `containerRef` positions the rows that mounted together with the container.
