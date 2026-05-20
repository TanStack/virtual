# TanStack Virtual got a lot faster, and most of the competition's claims didn't survive measurement

Every few weeks someone on Twitter or in a Discord I'm in mentions TanStack Virtual, and then someone else chimes in saying virtua is faster, or virtuoso lands `scrollToIndex` more accurately, or react-window v2 is smaller, or all of them handle iOS better. The claims were specific enough that you couldn't dismiss them as taste and vague enough that you couldn't verify them without doing the work yourself. So I did the work.

This release is what came out of it. Most of those claims didn't survive a measurement script, and the ones that did, we just fixed.

## The audit found one bug that was genuinely embarrassing

Before measuring anything against the competition I read our entire `virtual-core` source looking for things that were quantifiably bad regardless of what anyone else was doing, and the worst one was a Map clone hiding in plain sight. Every time `resizeItem` ran, we'd do `this.itemSizeCache = new Map(this.itemSizeCache.set(item.key, size))`, which copies the whole size cache into a fresh Map just to invalidate a memo dep. For a 10,000-item list where every item resizes once on mount, that's about 50 million wasted operations and a 1.9-second cold mount that nobody had pinned down. The fix was four lines (use a version counter, same dep pattern, integer comparison) and dropped that to 1.3 milliseconds. **1382× faster.**

That was the worst one. Below it were the usual suspects: an `Object.entries+delete` pattern in `setOptions` that was triggering V8's dictionary-mode deopt on every render, a `Math.min(...arr)` spread that could blow the argument-list limit at 125k items, an `elementsCache` leak when React replaced a measured node, a `useReducer(() => ({}), {})` rerender pattern allocating per scroll event. None catastrophic alone, but together they explain why competitors with simpler internals were beating us on synthetic benchmarks.

## The real gap was object allocation at scale

After fixing the bugs, we still mounted a 100k-item fixed list in 6.1 ms while virtua did it in 3.1 ms. The cause was that we allocated a `VirtualItem` object per index even though only ~50 are ever visible.

The fix is the biggest single change in the release. For single-lane lists (the default, the common case) we store start and size as a flat `Float64Array` and only construct `VirtualItem` objects when something actually reads `measurements[i]`. The public API still hands out an `Array<VirtualItem>` shape, but it's a `Proxy` that materializes lazily and caches. Internal hot paths read straight from the typed array. Same trick virtua uses, kept inside our headless API.

Cold mount at 100k went from 6.1 ms to 4.5 ms in real React, and 2.5 ms to 0.54 ms in the synthetic bench. At 500k items it's now 2.7 ms instead of 14 ms.

## iOS Safari is rude

If you've ever called `el.scrollTop = x` during a momentum scroll on iOS Safari, you know what happens: momentum dies, page snaps, user sees a jolt. iOS WebKit treats any programmatic scrollTop write during a touch-driven scroll as a cancel instruction, which is the opposite of what virtualization libraries want to do, because virtualization libraries write scrollTop in response to size measurements arriving.

We had zero iOS-specific code. virtua has seventeen explicit code paths. The "scroll stops abruptly when content above me resizes" complaints in our tracker have all been some flavor of this for years.

The fix is to defer the scrollTop write while a finger's on the screen, during the post-touchend momentum window, and during the elastic-overscroll bounce. The accumulated adjustment gets flushed in a single write once everything actually settles. About 370 bytes of iOS-specific code that doesn't tree-shake away on non-iOS bundles (the detection is runtime), but the runtime cost on non-iOS is one cached boolean per scroll event. virtua makes the same trade.

## The backward-scroll jank had been festering for five years

The biggest single complaint cluster in our issue tracker is "items jump while I scroll up" with dynamic heights, and the cause is that we were writing scrollTop on every above-viewport resize to keep the visible window stable. That makes sense during forward scroll, but during backward scroll the same write actively pushes the user past where they're trying to go. The community had independently rediscovered the same workaround five separate times across the years.

Now we just gate it on direction by default. Forward scroll and idle (mount-time) adjustments still fire, backward scroll skips them. Anyone who wants the old behavior can supply `shouldAdjustScrollPositionOnItemSizeChange` (it was already there) and ignore the direction.

## About those competitor claims

The most-cited one was "virtuoso has more accurate `scrollToIndex` on dynamic lists." I built a benchmark that scrolls to a target index and measures the actual landing position in pixels across all four libraries, and on every accuracy edge case I threw at it, TanStack Virtual lands at exactly 0.0 px from the target, matching virtuoso to the pixel. react-window v2 is consistently off by 135 to 224 pixels, which is a real bug in their lazy position cache. The "virtuoso is more accurate" perception turned out to be a benchmark artifact from my initial setup (a 1px CSS border on the container threw off the math).

The benchmark is checked into the repo at `benchmarks/` along with a Playwright runner that drives the same scenarios across all four libraries and reports medians. Running it is `cd benchmarks && pnpm bench`. If you see a claim about us that doesn't match what's in there, open an issue and we'll measure it together.

## The numbers

Compared to the current published `@tanstack/virtual-core`:

- Cold mount at 100k items: 6.1 ms → 4.5 ms (real React), 2.5 ms → 0.54 ms (synthetic)
- Cold mount at 500k items: 14 ms → 2.7 ms (synthetic)
- Worst-case `resizeItem` storm on 10k items: 1.9 seconds → 1.3 ms (yes, the bug was that bad)
- `setOptions` on every render: 14.4 ms → 1.3 ms for 10,000 calls
- `scrollToIndex` landing accuracy: 0.0 px (tied with virtuoso, beating react-window by hundreds of pixels)
- iOS Safari momentum scroll: works
- Backward-scroll jank: gone by default

Bundle delta: about +900 bytes gzip, mostly the lazy fast-path machinery and the iOS code. Production minified comes out around 6.1 kB total.

## What's still on the list

A reverse infinite scroll / chat mode is the one big thing missing, and given how much of the modern web is now a streaming UI on top of a list, it deserves its own release rather than getting wedged into this one. The Fenwick-tree memory rewrite for 1M+ item lists is the other piece, and it'll come if a real-world case actually asks for it. Same flexibility-versus-prescription thinking that landed [in the RSC work](https://tanstack.com/blog/who-owns-the-tree), kept applied here.

If you want to verify any of the numbers above, the benchmark suite is reproducible on your machine and the full claim-by-claim verification matrix against every competitor is in the repo. The work is in the open.
