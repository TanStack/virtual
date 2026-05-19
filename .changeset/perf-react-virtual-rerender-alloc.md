---
'@tanstack/react-virtual': patch
---

Replace the `useReducer(() => ({}), {})` force-rerender pattern with an
incrementing number counter. Same semantics (every dispatch changes the
reducer state, forcing a render); zero per-dispatch object allocation.
Trivial individual cost, but eliminates one steady-state GC source on
scroll-heavy apps.
