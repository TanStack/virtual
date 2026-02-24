# @tanstack/react-virtual

## 3.13.19

### Patch Changes

- Updated dependencies [[`843109c`](https://github.com/TanStack/virtual/commit/843109c5bf780591a762f9767f3808fd15e3f94e)]:
  - @tanstack/virtual-core@3.13.19

## 3.13.18

### Patch Changes

- Updated dependencies [[`9067574`](https://github.com/TanStack/virtual/commit/9067574f1a0178d30e27bcac70853bdcbf437fec)]:
  - @tanstack/virtual-core@3.13.18

## 3.13.17

### Patch Changes

- Updated dependencies [[`21d9a46`](https://github.com/TanStack/virtual/commit/21d9a46eac034cb4299872891694965bceed526d)]:
  - @tanstack/virtual-core@3.13.17

## 3.13.16

### Patch Changes

- Updated dependencies [[`db6df21`](https://github.com/TanStack/virtual/commit/db6df212ed83dd7e4eb6450d1340c95475667b7b)]:
  - @tanstack/virtual-core@3.13.16

## 3.13.15

### Patch Changes

- feat(react-virtual): add `useFlushSync` option ([#1100](https://github.com/TanStack/virtual/pull/1100))

  Adds a React-specific `useFlushSync` option to control whether `flushSync` is used for synchronous scroll correction during measurement.

  The default behavior remains unchanged (`useFlushSync: true`) to preserve the best scrolling experience.
  Disabling it avoids the React 19 warning about calling `flushSync` during render, at the cost of potentially increased visible whitespace during fast scrolling with dynamically sized items.

- Updated dependencies [[`5a273bf`](https://github.com/TanStack/virtual/commit/5a273bf0c0bc0255ca172929f021c3b6e50cb69d)]:
  - @tanstack/virtual-core@3.13.15

## 3.13.14

### Patch Changes

- Updated dependencies [[`6d9274c`](https://github.com/TanStack/virtual/commit/6d9274c3f0a9e64450b5829872079a65277bc654)]:
  - @tanstack/virtual-core@3.13.14

## 3.13.13

### Patch Changes

- Fix: Notify framework when count changes to update getTotalSize() ([#1085](https://github.com/TanStack/virtual/pull/1085))

  Fixed an issue where `getTotalSize()` would return stale values when the `count` option changed (e.g., during filtering or search operations). The virtualizer now automatically notifies the framework when measurement-affecting options change, ensuring the UI updates correctly without requiring manual `useMemo` workarounds.

  **Before**: When filtering items, the list container would maintain its previous height, causing excessive blank space (when count decreased) or inaccessible items (when count increased).

  **After**: Height updates automatically when count changes, providing the correct user experience.

  This fix applies to all framework adapters and has minimal performance impact (< 0.1ms per change).

- Updated dependencies [[`2542c5a`](https://github.com/TanStack/virtual/commit/2542c5a3d6820cea956fa3b4f94c42e3526a8d68), [`96e32a6`](https://github.com/TanStack/virtual/commit/96e32a6ffc125743a0172ea4e0fe37ac29c4187b)]:
  - @tanstack/virtual-core@3.13.13

## 3.13.12

### Patch Changes

- chore(react-virtual): fix vite e2e build ([#1030](https://github.com/TanStack/virtual/pull/1030))

- Updated dependencies [[`d21ed98`](https://github.com/TanStack/virtual/commit/d21ed98da3470b9986c9a028ed70fdf0d6189ab4)]:
  - @tanstack/virtual-core@3.13.12

## 3.13.11

### Patch Changes

- Updated dependencies [[`73fa867`](https://github.com/TanStack/virtual/commit/73fa86752599a4bffba51ec8e4ff2f8cb8283010)]:
  - @tanstack/virtual-core@3.13.11

## 3.13.10

### Patch Changes

- Updated dependencies [[`b3b7e7d`](https://github.com/TanStack/virtual/commit/b3b7e7dc8b25daeebbd2da61b3b7ae3448babbdb)]:
  - @tanstack/virtual-core@3.13.10

## 3.13.9

### Patch Changes

- Updated dependencies [[`9e33cdb`](https://github.com/TanStack/virtual/commit/9e33cdb1c8780c2f455aafc11a0aeea58b71fc69)]:
  - @tanstack/virtual-core@3.13.9

## 3.13.8

### Patch Changes

- Updated dependencies [[`60719f6`](https://github.com/TanStack/virtual/commit/60719f61b589d6f9d886e4f7c093217f6d693faf)]:
  - @tanstack/virtual-core@3.13.8

## 3.13.7

### Patch Changes

- Updated dependencies [[`e2d93c2`](https://github.com/TanStack/virtual/commit/e2d93c2dcde9ccf60f658e56edccd8d05aefeee6)]:
  - @tanstack/virtual-core@3.13.7

## 3.13.6

### Patch Changes

- Updated dependencies [[`042616f`](https://github.com/TanStack/virtual/commit/042616f39ced842470db0b4b40fca77f22454b7f)]:
  - @tanstack/virtual-core@3.13.6

## 3.13.5

### Patch Changes

- Updated dependencies [[`51656d9`](https://github.com/TanStack/virtual/commit/51656d94a2469a065e631f25ffc8ec0288d9f5ec)]:
  - @tanstack/virtual-core@3.13.5

## 3.13.4

### Patch Changes

- Updated dependencies [[`514b62d`](https://github.com/TanStack/virtual/commit/514b62d04974c2fd59fc8a68ed40f4c1a1547dd2), [`f03d814`](https://github.com/TanStack/virtual/commit/f03d8142c03ea0f5816161a4dad38ca35469841c)]:
  - @tanstack/virtual-core@3.13.4

## 3.13.3

### Patch Changes

- Updated dependencies [[`02ef309`](https://github.com/TanStack/virtual/commit/02ef3097de4a14ed4077ace2ca901dc411bf81c1)]:
  - @tanstack/virtual-core@3.13.3
