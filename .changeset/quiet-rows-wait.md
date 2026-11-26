---
'@tanstack/virtual-core': patch
---

Reattach observers when a scroll element's window changes, so Solid lists created inside a suspended `<Suspense>` or with a signal ref render their rows after insertion.
