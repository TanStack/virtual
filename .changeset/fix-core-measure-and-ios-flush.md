---
'@tanstack/virtual-core': patch
---

Two correctness fixes in the new code:

- `measure()` now resets `pendingMin` so a prior `resizeItem()` that left
  it non-null can't preserve stale `measurementsCache` entries before that
  index. The next rebuild is guaranteed to start at 0.
- The iOS deferred-adjustment flush now rolls its accumulated delta into
  `scrollAdjustments`. Without this, a resize landing between the flush
  and the resulting scroll event would compute the next correction from
  the stale pre-flush offset.
