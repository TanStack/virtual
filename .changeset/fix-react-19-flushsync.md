---
"@tanstack/react-virtual": patch
"@tanstack/virtual-core": patch
---

feat: add `deferFlushSync` option for React 19 compatibility

React 19 throws a warning when `flushSync` is called from inside a lifecycle method (`useLayoutEffect`). This change adds a new `deferFlushSync` option that users can enable to defer `flushSync` to a microtask, suppressing the warning.

**Breaking Change Mitigation**: The default behavior remains unchanged (synchronous `flushSync`) to preserve scroll correction performance. Users experiencing the React 19 warning can opt-in to the deferred behavior by setting `deferFlushSync: true`.

> **Note**: Enabling `deferFlushSync` may cause visible white space gaps during fast scrolling with dynamic measurements.

Fixes #1094
