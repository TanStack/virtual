---
'@tanstack/solid-virtual': major
---

Support Solid 2. `@tanstack/solid-virtual` now requires `solid-js` 2 (`>=2.0.0-rc.19 <3.0.0`); stay on 3.x for Solid 1.

- `createVirtualizer` and `createWindowVirtualizer` keep their API. Option changes are tracked by a render effect, and the virtualizer mounts in `onSettled`.
- `getVirtualItems()` returns a store reconciled by `index`, so rows keep their identity while scrolling and measuring, and `getTotalSize()` stays a reactive read.
- As with every Solid 2 signal, values read right after a write outside a reactive scope update after the next flush (`flush()` from `solid-js`, or the next microtask).
