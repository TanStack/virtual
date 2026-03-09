---
'@tanstack/virtual-core': minor
'@tanstack/react-virtual': minor
'@tanstack/vue-virtual': minor
'@tanstack/solid-virtual': minor
'@tanstack/svelte-virtual': minor
'@tanstack/angular-virtual': minor
'@tanstack/lit-virtual': minor
---

Add `TKey` generic parameter to `VirtualItem`, `VirtualizerOptions`, and `Virtualizer` to allow narrowing the key type. This fixes a TypeScript error when using `virtualItem.key` as a React component key, since `bigint` in the default `Key` type is not assignable to React's `Key` type.
