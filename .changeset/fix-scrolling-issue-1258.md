---
'@tanstack/virtual-core': patch
---

Fix end-anchored streaming growth with `paddingEnd`: re-issue the scroll compensation write when the browser clamped it because the sizer had not grown yet (#1258).
