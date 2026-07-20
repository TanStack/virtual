---
'@tanstack/virtual-core': patch
---

Stop the default scroll-adjustment heuristic from drifting the viewport when a viewport-spanning item grows. Previously any item whose top sat above the fold (`itemStart < scrollOffset`) had its size delta compensated on every re-measure — including a streaming chat message that spans the fold and grows at its bottom, dragging `scrollTop` downward token by token (#1218). Re-measurements now only compensate items that are *entirely* above the fold (`itemStart + itemSize <= scrollOffset`); growth below the anchor point leaves the scroll position untouched. First measurements (estimate→actual) still compensate any above-fold item, and a custom `shouldAdjustScrollPositionOnItemSizeChange` still overrides the default.
