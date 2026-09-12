---
'@tanstack/react-virtual': patch
---

Subscribe to virtualizer updates with `useSyncExternalStore` (via the official `use-sync-external-store` shim, keeping the `>=16.8` React peer range) instead of bumping a reducer. `useVirtualizer` and `useWindowVirtualizer` keep the same API and the same render timing — synchronous re-render before paint on mount and inside `useFlushSync` scroll handlers — but React now tracks the virtualizer as an external store: when it changes during a concurrent render (transitions, Suspense) React re-renders synchronously instead of committing a torn, stale range.
