---
'@tanstack/virtual-core': patch
---

Render only the last rows of a list that is above the viewport in a shared scroll element. The scroll offset is capped at the end of the list only while it is stale (the list shrank, the element is past an edge, or a write of ours has not been reported back yet), not where the element has reported it.
