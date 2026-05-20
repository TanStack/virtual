---
'@tanstack/virtual-core': patch
---

Don't call `getItemKey` with a possibly-stale index when cleaning up
`elementsCache` for a disconnected node. The cleanup now finds the
matching entry by node identity, so removing items from the end of
the list while a `ResizeObserver` still has the now-detached node
queued no longer throws (regression of #1148).
