---
'@tanstack/virtual-core': patch
---

Fix two corrections that the browser clamps without a scroll event leaving `scrollOffset` wrong:

- A correction past the top. The recorded write now matches the clamp, as `scrollOffset` already did, so a command in flight is no longer treated as waiting for a scroll event that will not come.
- A correction on a list that fits its viewport, where the only position is 0. `scrollOffset` used to keep the clamped target until an unrelated scroll event. It is now set to 0 once the sizer is committed, with a notify, and a later command to 0 no longer waits for a scroll event that cannot come.
