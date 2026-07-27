---
'@tanstack/react-virtual': minor
---

Add `useVirtualizerSnapshot` and `useWindowVirtualizerSnapshot`: variants of the existing hooks that return `virtualItems` / `totalSize` as immutable snapshot data via `useSyncExternalStore`, with the stable `virtualizer` instance alongside for imperative APIs. Components consuming the snapshot hooks are compatible with React Compiler — the compiler skips components calling `useVirtualizer` as a known-incompatible API (#736, #743, #1119), while snapshot consumers compile and memoize correctly.
