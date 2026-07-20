---
'@tanstack/virtual-core': patch
---

Stop iOS-deferred scroll adjustments from replaying stale deltas after the position is already correct (#1233). On iOS WebKit the end-anchored virtualizer defers scroll compensation while the scroller is live and replays it once settled, but two cases replayed a delta whose premise no longer held:

- Absolute scroll commands (`scrollToOffset` / `scrollToIndex` / `scrollToEnd`) derive their target from current measurements, so a pending deferred delta is already stale — it now invalidates the deferral instead of letting it replay and shift the list off the just-established position. Relative commands (`scrollBy`) keep the deferral.
- At the end clamp with `anchorTo: 'end'`, a row above the viewport re-measuring smaller lets the browser clamp `scrollTop` onto the new bottom (already the correct position); the flush now drops the stale negative compensation instead of replaying it and lifting the view off the bottom. Positive deltas still replay, since content growth above does not clamp.
