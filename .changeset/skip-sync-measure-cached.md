---
'@tanstack/virtual-core': patch
---

Skip synchronous DOM read (offsetWidth/offsetHeight) in default measureElement when a cached size already exists, reducing layout reflow on re-renders
