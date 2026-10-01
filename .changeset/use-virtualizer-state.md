---
'@tanstack/virtual-core': minor
'@tanstack/react-virtual': minor
---

Add a store interface to the `Virtualizer` and a `useVirtualizerState` hook for React.

- `virtualizer.subscribe(listener)` registers any number of change listeners, and `virtualizer.getState()` returns an immutable `{ virtualItems, totalSize, range, isScrolling, scrollDirection }` snapshot that keeps its identity until a field changes.
- `useVirtualizerState(virtualizer, selector?, isEqual?)` subscribes to that state through `useSyncExternalStore`. Values read through it stay live under the React Compiler, which can otherwise memoise `virtualizer.getVirtualItems()` on the stable instance. It works with both `useVirtualizer` and `useWindowVirtualizer`.
