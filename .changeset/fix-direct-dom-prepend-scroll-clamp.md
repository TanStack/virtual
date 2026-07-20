---
'@tanstack/react-virtual': patch
---

Fix a gap at the top of the list after an end-anchored prepend in `directDomUpdates` mode. The prepend grows the total size and bumps `scrollOffset` to the new bottom in the same pass, but the size container's height was written _after_ `_willUpdate` synced the scroll position — so the browser clamped the `scrollTop` write to the stale (shorter) `scrollHeight`, leaving whitespace at the top until the next scroll. The container is now grown before the scroll sync. Only affected `directDomUpdates` mode (React-rendered sizers receive their height during render).
