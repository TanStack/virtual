---
'@tanstack/virtual-core': patch
---

Fix an end-anchored list losing the reader's place in WebKit when rows are prepended during wheel or trackpad scrolling. The anchor write is now made two frames later, where WebKit keeps it.
