---
'@tanstack/virtual-core': patch
---

refactor(virtual-core): simplify the scroll-correction state: a scroll write is tracked until its read-back as one record, the iOS touch gesture as one record, the pending prepend anchor as a tagged record, and every scroll command starts through one entry point (no behaviour change, with two exceptions: a second `touchend`/`touchcancel` inside the post-touch grace window now restarts the window instead of leaving the first timer to end it early, and after the scroll element is swapped or the virtualizer disabled, a write to the old element is no longer matched to the new element's first scroll report). `scrollAdjustments` becomes a read-only getter with the same value (assigning to it is no longer supported).
