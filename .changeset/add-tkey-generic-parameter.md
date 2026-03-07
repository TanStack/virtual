---
'@tanstack/virtual-core': patch
'@tanstack/react-virtual': patch
'@tanstack/vue-virtual': patch
'@tanstack/solid-virtual': patch
'@tanstack/svelte-virtual': patch
'@tanstack/angular-virtual': patch
'@tanstack/lit-virtual': patch
---

Add `TKey` generic parameter to `VirtualItem`, `VirtualizerOptions`, and `Virtualizer` to allow narrowing the key type. This fixes a TypeScript error when using `virtualItem.key` as a React component key, since `bigint` in the default `Key` type is not assignable to React's `Key` type.
