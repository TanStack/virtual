---
'@tanstack/virtual-core': patch
---

fix(virtual-core): on iOS 27 and later, a scroll command issued during a fling takes effect at once

A `scrollToIndex`, `scrollToOffset` or `scrollToEnd` issued during a fling waited for the fling to end, so a button outside the list (such as "jump to latest") did nothing until the list stopped. The command now stops the fling by hiding the scroll element's overflow for two frames, then restores the element's own inline value and writes. The user taking over before the write still cancels the command.
