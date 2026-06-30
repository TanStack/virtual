---
'@tanstack/virtual-core': patch
---

Don't latch a scroll direction from the read-back of the virtualizer's own adjustment write

`applyScrollAdjustment` folds the pending adjustment into `scrollOffset` eagerly, so the browser's scroll event for that write arrives at exactly the held offset. The scroll-direction computation treated that equality as `'backward'`, which made the default `shouldAdjustScrollPositionOnItemSizeChange` skip above-viewport re-measure compensation for the rest of the `isScrollingResetDelay` window — so during multi-frame reflows (e.g. a side pane's width animation re-wrapping rows while scrolled up) most frames went uncompensated and the viewport drifted. An event at the held offset carries no direction information, so the direction now stays unchanged in that case; real gestures always move the offset and still latch normally.
