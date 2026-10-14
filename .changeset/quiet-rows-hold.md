---
'@tanstack/virtual-core': patch
---

fix(virtual-core): hold a scroll correction the element cannot take instead of writing it (#1287)

A prepend's anchor delta or an above-viewport size change that lands while a `scrollTop` write is impossible (iOS during a touch gesture or its momentum tail, any WebKit while the element is rubber-banding past an edge) is now held: `scrollOffset` carries the corrected position, the rows and the total size are exposed shifted back by the held amount so every adapter keeps the reader's row where it is, and one write moves the element once a write is possible. Before, the write was discarded during the bounce on desktop Safari (the bounce stalled with the new rows and a blank top on screen), and on iOS the new rows showed through the bounce and snapped back at the flush.
