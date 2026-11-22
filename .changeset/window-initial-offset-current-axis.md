---
'@tanstack/virtual-core': patch
'@tanstack/lit-virtual': patch
'@tanstack/svelte-virtual': patch
---

Pass the virtualizer to `initialOffset` when it is a function. The Lit and Svelte window virtualizers use it to read the current `horizontal` option, so a list whose axis changed while `enabled: false` starts from the correct window scroll position when it is enabled again.
