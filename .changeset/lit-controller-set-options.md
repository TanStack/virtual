---
'@tanstack/lit-virtual': minor
---

Add `setOptions` to `VirtualizerController` and `WindowVirtualizerController` so virtualizer options can be updated after construction.

Previously the controller only accepted options once, in its constructor, so options derived from reactive Lit properties (`count`, `estimateSize`, `horizontal`, …) could never be re-applied. `getVirtualizer().setOptions(...)` is not a substitute: it replaces options wholesale and drops the controller's `onChange` wrapper, which is what asks the host to re-render.

`setOptions` takes a partial set of options, merges them over the options the controller already holds (skipping `undefined`, so an omitted value does not wipe a stored one), re-applies the host `requestUpdate` wrapper around `onChange`, and flushes the change:

```ts
willUpdate(changed: PropertyValues<this>) {
  if (changed.has('count')) {
    this.virtualizerController.setOptions({ count: this.count })
  }
}
```
