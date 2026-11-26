---
'@tanstack/svelte-virtual': patch
---

Read the scroll element again after Svelte updates the DOM, so a virtualizer whose scroll element is assigned with `bind:this` after the store is subscribed renders its rows.
