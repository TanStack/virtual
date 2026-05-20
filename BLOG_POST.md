# TanStack Virtual just got a lot faster, and finally handles iOS

I spent three days last week auditing TanStack Virtual end to end, and what came out of it is the biggest single perf release the library has shipped in years. Cold mount on a 100k-item list dropped from 6.1 ms to 4.5 ms in real React. A worst-case `resizeItem` storm on 10k items went from nearly two seconds to 1.3 milliseconds. iOS Safari momentum scroll, which had been broken for years on dynamic-height lists, now actually works. Scroll-up jank with dynamic items, the single largest complaint cluster in our tracker, is gone by default.

The work was a mix of bug fixes, a substantial internal rewrite for the hot path, and a new iOS-specific code path. Most of it landed in `virtual-core` so every framework adapter benefits. Here's what changed and why.

## One bug was genuinely embarrassing

Before measuring anything I read the entire `virtual-core` source looking for things that were quantifiably bad, and the worst one was a Map clone hiding in plain sight. Every time `resizeItem` ran, we'd do `this.itemSizeCache = new Map(this.itemSizeCache.set(item.key, size))`, which copies the whole size cache into a fresh Map just to invalidate a memo dep. For a 10k-item list where every item resizes once on mount, that's about 50 million wasted operations and a 1.9-second cold mount that nobody had pinned down. The fix was four lines (use a version counter, same dep pattern, integer comparison) and dropped that to 1.3 milliseconds. **1382× faster.**

Below it were the usual smaller suspects: an `Object.entries+delete` pattern in `setOptions` that was triggering V8's dictionary-mode deopt on every render, a `Math.min(...arr)` spread that could blow the argument-list limit at 125k items, an `elementsCache` leak when React replaced a measured node, a `useReducer(() => ({}), {})` rerender pattern allocating per scroll event. None catastrophic alone, but together they explain why our issue tracker had recurring complaints about scroll stutter and slow initial renders on large lists.

## The real ceiling was object allocation at scale

After the audit fixes we still mounted a 100k-item list slower than we should have, and the cause was that we were allocating a `VirtualItem` object per index even though only ~50 are ever visible. The fix is the biggest single change in the release.

For single-lane lists (the default and the common case) we now store start and size as a flat `Float64Array` and only construct `VirtualItem` objects when something actually reads `measurements[i]`. The public API still hands out an `Array<VirtualItem>` shape, but it's a `Proxy` that materializes lazily and caches. Internal hot paths read straight from the typed array, skipping the Proxy.

Cold mount at 100k went from 6.1 ms to 4.5 ms in real React, and 2.5 ms to 0.54 ms in the synthetic bench. At 500k items it's now 2.7 ms instead of 14. The work is fully backward compatible: `measurementsCache` still satisfies its `Array<VirtualItem>` contract, internal consumers continue to read `[i].start` and `[i].end` the same way they used to, and only the lanes>1 path keeps the old eager allocation because lane assignment is order-dependent and harder to defer cleanly.

## iOS Safari is rude

If you've ever called `el.scrollTop = x` during a momentum scroll on iOS Safari, you know what happens: momentum dies, page snaps, user sees a jolt. iOS WebKit treats any programmatic scrollTop write during a touch-driven scroll as a cancel instruction, which is the opposite of what virtualization libraries want to do, because virtualization libraries write scrollTop in response to size measurements arriving.

We had no iOS-specific handling at all. The "scroll stops abruptly when content above me resizes" complaints in our tracker have been some flavor of this for years.

The fix defers the scrollTop write while a finger's on the screen, during the 150 ms post-touchend momentum window, and during the elastic-overscroll bounce. The accumulated adjustment flushes in a single write once everything actually settles, and the user keeps their momentum. About 370 bytes of iOS-specific code that doesn't tree-shake away on non-iOS bundles since the detection is runtime, but the per-event cost on non-iOS is one cached boolean check. That's an acceptable trade given how much of mobile traffic is iOS.

## The backward-scroll jank had been festering for five years

The biggest single complaint cluster in our issue tracker is "items jump while I scroll up" with dynamic heights, and the cause is that we were writing scrollTop on every above-viewport resize to keep the visible window stable. That makes sense during forward scroll, but during backward scroll the same write actively pushes the user past where they're trying to go. The community had independently rediscovered the same workaround five separate times across the years.

We just gate it on direction now. Forward scroll and mount-time adjustments still fire, backward scroll skips them. Anyone who wants the old behavior can supply `shouldAdjustScrollPositionOnItemSizeChange` (it was already there) and ignore the direction.

## A new method for scroll restoration

`virtualizer.takeSnapshot()` returns the currently-measured items as plain `VirtualItem` objects, suitable for persisting through state storage and feeding back as `initialMeasurementsCache` on remount. Pair with the current `scrollOffset` and you get exact scroll restoration after route navigation:

```tsx
// On unmount
const snapshot = virtualizer.takeSnapshot()
const offset = virtualizer.scrollOffset
sessionStorage.setItem('myList', JSON.stringify({ snapshot, offset }))

// On remount
const saved = JSON.parse(sessionStorage.getItem('myList') ?? 'null')
useVirtualizer({
  count: items.length,
  estimateSize: () => 50,
  getScrollElement: () => parentRef.current,
  initialMeasurementsCache: saved?.snapshot,
  initialOffset: saved?.offset,
})
```

Only items the consumer actually rendered show up in the snapshot, since unmeasured items can fall back to `estimateSize` on restore.

## The numbers

Compared to the current published version:

| Metric                                                | Before      | After           |
| ----------------------------------------------------- | ----------- | --------------- |
| Cold mount @ 100k items (real React)                  | 6.1 ms      | 4.5 ms          |
| Cold mount @ 100k items (synthetic)                   | 2.5 ms      | 0.54 ms         |
| Cold mount @ 500k items (synthetic)                   | 14 ms       | 2.7 ms          |
| `resizeItem` storm on 10k items                       | 1.9 s       | 1.3 ms          |
| `setOptions` × 10,000 (per render)                    | 14.4 ms     | 1.3 ms          |
| `scrollToIndex` landing accuracy on dynamic 10k lists | within 1 px | 0.0 px          |
| iOS Safari momentum scroll                            | broken      | works           |
| Backward-scroll jank with dynamic items               | recurring   | gone by default |

Bundle delta is about +900 bytes gzip, mostly the lazy fast-path machinery and the iOS code. Production minified comes out around 6.1 kB total. 91 unit tests, all green.

## What's still on the list

Reverse infinite scroll for chat use cases is the one big thing missing, and given how much of the modern web is now a streaming UI on top of a list, it deserves its own release with its own design pass rather than getting wedged into this one. A Fenwick-tree memory rewrite for 1M+ item lists is the other piece; it'll come if a real-world case actually asks for it.

I also built a cross-library benchmark suite at `benchmarks/` while I was at it, since I wanted to verify my own changes didn't regress anything and the existing comparison content online is either stale or contradictory. It runs the same scenarios across every major virtualization library via Playwright, reports medians across runs, and is fully reproducible: `cd benchmarks && pnpm bench`. Same flexibility-versus-prescription thinking that landed [in the RSC work](https://tanstack.com/blog/who-owns-the-tree), kept applied here. The bench is in the repo if you want to see it.
