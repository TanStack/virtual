---
'@tanstack/virtual-core': patch
---

Keep an end-pinned virtualizer following appended items when older items are trimmed in the same update and the item count does not increase. Recognize ordered, overlapping windows while preserving reading anchors for users who have scrolled away from the end.

Preserve item keys in the lazy measurement cache so a stable `getItemKey` callback reading mutable data cannot change the identity of previously measured rows.
