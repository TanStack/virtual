---
'@tanstack/react-virtual': patch
---

Update the direct DOM size container before applying scroll adjustments, so resizing an earlier item keeps an end-anchored list pinned even when the last item does not resize.
