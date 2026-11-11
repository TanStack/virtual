---
'@tanstack/react-virtual': patch
---

Fix virtualized lists freezing when hovering their elements in the browser's Elements panel with React DevTools' "Record why each component rendered while profiling" setting enabled, even without starting a profiling recording ([#682](https://github.com/TanStack/virtual/issues/682)). Preserve the original reducer dispatch during hook inspection so scrolling continues to render new rows.
