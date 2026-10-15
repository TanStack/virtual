---
'@tanstack/virtual-core': patch
---

fix(virtual-core): keep an instant scroll command when the browser clamps its write before rows grow back

Rows measured right after an instant `scrollToEnd()` (or `scrollToIndex`) can first shrink the sizer below the written position and then grow it again in the same task. The browser clamps the write to the smaller max, and the scroll event reports that position. It was read as the user scrolling away, so the command was cancelled and the list stopped short of the end (a chat opened with `estimateSize` larger than its rows). The virtualizer now follows the scroll max through those measurements and reads such an event as its own clamped write, so the command retargets and lands at the end.
