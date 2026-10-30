---
'@tanstack/virtual-core': patch
---

Keep a full viewport of rows in the range when the scroll offset is past the end of the list, as it is after the list shrinks and before the element reports its clamped position.
