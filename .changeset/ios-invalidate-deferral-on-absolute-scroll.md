---
'@tanstack/virtual-core': patch
---

Invalidate any pending iOS-deferred scroll compensation when an absolute scroll command runs. On iOS WebKit, `scrollToOffset`/`scrollToIndex` (and therefore `scrollToEnd`) derive their target from current measurements, so a deferred adjustment still queued from an earlier resize is stale — the command already accounts for it. Previously the deferral survived the command and replayed ~150 ms later (once `isScrolling` reset), shifting an `anchorTo: 'end'` list off the just-established position by the accumulated delta. Relative commands (`scrollBy`) intentionally keep the deferral.
