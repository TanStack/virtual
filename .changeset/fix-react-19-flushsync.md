---
"@tanstack/react-virtual": patch
---

fix: defer flushSync to microtask for React 19 compatibility

React 19 throws a warning when `flushSync` is called from inside a lifecycle method (`useLayoutEffect`). This change wraps the `flushSync` call in `queueMicrotask()` to defer it to a microtask, allowing React to complete its current render cycle before forcing the synchronous update.

Fixes #1094

This fixes the warning: "flushSync was called from inside a lifecycle method. React cannot flush when React is already rendering."
