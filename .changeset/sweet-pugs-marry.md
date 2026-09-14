---
'@tanstack/react-virtual': patch
---

Skip `flushSync` for the synchronous notify raised from `measureElement`. React calls `measureElement` from a ref callback, i.e. while it is committing, and `flushSync` cannot flush there — it warns in development instead. The commit phase already runs at discrete (sync) priority, so the update lands in the same lane and the same frame without `flushSync`. Notifies from every other path (ResizeObserver re-measures, scroll adjustments) still flush synchronously.
