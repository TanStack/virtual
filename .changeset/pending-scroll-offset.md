---
'@tanstack/virtual-core': minor
---

Add `isScrollPending()`. It is `true` while a scroll command has written a position that no scroll event has reported back yet.

Until that read-back, `scrollOffset`, `range` and `getVirtualItems()` still describe the position before the command. A consumer that acts on the position in `onChange` can use this to tell those notifies apart, and wait for the one the read-back brings.

If the element never reports a command's write, the virtualizer now notifies when reconcile gives up on the command or `cancelScroll` ends it. A consumer waiting for the read-back is not left waiting.

Two corrections that the browser clamps without a scroll event no longer leave `scrollOffset` wrong:

- A correction past the top. The recorded write now matches the clamp, as `scrollOffset` already did.
- A correction on a list that fits its viewport, where the only position is 0. `scrollOffset` used to keep the clamped target until an unrelated scroll event. A later command to 0 also looked unreported for its whole lifetime.
