---
'@tanstack/virtual-core': patch
---

Cut per-scroll-frame allocations on the default `lanes === 1` path. Range computation previously allocated an options object and two closures on every scroll event; it now does the same work allocation-free, reducing GC pressure during continuous scroll.
