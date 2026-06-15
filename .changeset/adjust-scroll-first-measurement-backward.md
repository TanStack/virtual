---
'@tanstack/virtual-core': patch
---

Fix "items jump while scrolling up": the default scroll-adjustment predicate now compensates scrollTop on the first measurement of an above-viewport item even while scrolling backward (the estimate→actual delta must be absorbed), and only skips compensation for re-measurements during backward scroll to avoid the cascading jank
