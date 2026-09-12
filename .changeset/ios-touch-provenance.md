---
'@tanstack/virtual-core': patch
---

Gate the iOS scroll-adjustment deferral on touch provenance instead of `isScrolling`. The deferral exists to keep `scrollTop` writes from cancelling touch momentum (#884), but `isScrolling` is set by any scroll event, including the echo of the virtualizer's own programmatic write, so a `scrollToIndex` / `scrollToOffset` landing had its measurement compensation deferred past a paint and snapped a beat later (#1250). Adjustments are now deferred only while a finger is down or inside a timer-bounded post-touchend tail that momentum scroll events keep re-arming, so it spans the whole fling and self-terminates 150 ms after the last frame. Absolute scroll commands close that tail (their write cancels momentum anyway), so a landing triggered from a tap handler compensates synchronously too. `touchcancel` is handled like `touchend`, so a system gesture stealing the touch no longer leaves the deferral gate stuck.
