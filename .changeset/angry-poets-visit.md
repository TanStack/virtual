---
'@tanstack/react-virtual': patch
---

feat(react-virtual): add `useFlushSync` option

Adds a React-specific `useFlushSync` option to control whether `flushSync` is used for synchronous scroll correction during measurement.

The default behavior remains unchanged (`useFlushSync: true`) to preserve the best scrolling experience.
Disabling it avoids the React 19 warning about calling `flushSync` during render, at the cost of potentially increased visible whitespace during fast scrolling with dynamically sized items.
