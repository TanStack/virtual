---
'@tanstack/virtual-core': patch
---

Fix `scrollToIndex(last, { align: 'end' })` overshooting the last item by `paddingEnd`; it now respects `scrollPaddingEnd` like other end-aligned items. To scroll to the very bottom including `paddingEnd`, use `scrollToEnd()`.
