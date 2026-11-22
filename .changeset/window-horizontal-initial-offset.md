---
'@tanstack/react-virtual': patch
'@tanstack/vue-virtual': patch
'@tanstack/svelte-virtual': patch
'@tanstack/solid-virtual': patch
'@tanstack/lit-virtual': patch
'@tanstack/angular-virtual': patch
---

Seed a horizontal window virtualizer's default `initialOffset` from `window.scrollX` instead of `window.scrollY`, matching `observeWindowOffset` and the Marko adapter. A horizontal list mounted on a page that was scrolled down no longer renders the columns at the vertical scroll position until the first scroll event.
