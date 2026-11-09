---
'@tanstack/virtual-core': patch
---

Render only the last rows of a list that is above the viewport in a shared scroll element. The scroll offset is capped at the end of the scroll element, the list's end plus the content after it, rather than at the list's end, so a list that has the element to itself is capped as before.
