---
'@tanstack/virtual-core': patch
---

With `anchorTo: 'end'`, keep an end-pinned viewport pinned when the scroll element shrinks, for example when the window is resized or the app changes its height. Previously the browser kept `scrollTop`, leaving the last items below the fold.
