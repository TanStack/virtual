---
'@tanstack/virtual-core': patch
---

Cancel the pending `isScrolling` reset when a scroll observer is torn down, so a virtualizer unmounted within `isScrollingResetDelay` of a scroll no longer emits one late `onChange`.
