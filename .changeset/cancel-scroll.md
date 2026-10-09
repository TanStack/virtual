---
'@tanstack/virtual-core': minor
'@tanstack/angular-virtual': minor
'@tanstack/marko-virtual': minor
---

feat(virtual-core): add `cancelScroll()` to stop an in-flight `scrollToIndex` / `scrollToOffset` / `scrollBy` / `scrollToEnd` from correcting toward its target, so a user gesture can take over the viewport (#1285)
