# How TanStack Virtual got faster than the libraries claiming to be faster than it

A few weeks ago I started noticing the same thing showing up on Twitter, in Discord threads, in shadcn issue comments: someone would mention TanStack Virtual, and then someone else would chime in saying their library of choice was faster, or smaller, or handled dynamic sizes better, or didn't break on iOS. Sometimes it was virtua, sometimes virtuoso, sometimes react-window v2. The claims were specific enough that you couldn't dismiss them as taste, and vague enough that you couldn't verify them without doing the work yourself.

So I did the work. Three days, twenty-nine commits, two rewrites of the same fast path, one full cross-library benchmark suite that's checked into the repo and reproducible on your machine, and a documented list of every single thing the competition says we lose at. Some of those claims turned out to be true. Most of the rest don't survive measurement. And the ones that did, we just fixed.

This is the writeup of all of it: what I found in our code, what I found in theirs, how we closed the real gaps, and a few I decided not to chase.

## The competition's case against us

Every successful library positions itself against the others, and our competitors are no exception, but the framing matters more than the claim because most of what they say about us is either provably wrong or so contextual it doesn't survive a measurement script.

The aggressive end is virtua's comparison table, which marks TanStack Virtual as "🟠 needs customization" for vertical scroll, horizontal scroll, grid, table, masonry, and React Server Components, then flatly "❌" for reverse scroll, bi-directional infinite scroll, and scroll restoration. Most of that is the framing dispute you'd expect, since we're headless on purpose and they ship `<VList>` as a drop-in, but the three ❌s are real and worth taking seriously. Their v0.10.0 README also had a bundle size table where we came out as the smallest, at 2.3 kB to their 4.7 kB, which they quietly removed from the current README. Their "Benchmark" section has read "WIP" for three years across 49 releases.

react-cool-virtual is the bluntest, with a "Why" section that links us by name and calls our API "verbose and lacking many of the useful features." The project hasn't shipped a release since April 2022.

virtuoso bills itself as "the most powerful virtual list component for React" and "the most complete React virtualization rendering family of components." Their docs explicitly position Table Virtuoso as a replacement for `@tanstack/virtual`. The genuine win their messaging points at is auto-measurement: their items measure without any ref attachment, where we require `ref={virtualizer.measureElement}`. That's real, and it's a direct consequence of them owning the rendering and us being headless.

The community-side perception is more interesting than the official messaging, because it points at where we're actually losing. The recurring themes I pulled from issue trackers, Reddit, dev.to, and Stack Overflow:

- TanStack needs more setup and the docs don't cover the painful patterns (sticky table with virtualizer, dynamic + scroll restoration, chat-style reverse scroll, mobile-specific tips).
- virtuoso lands `scrollToIndex` more accurately on dynamic-height lists.
- virtua handles iOS Safari scroll without breaking momentum.
- TanStack "items jump while scrolling up" with dynamic heights, which has been complained about in five separate recurring issue threads spanning years and where users have independently rediscovered the same workaround at least five times.

Some of these survive verification, some don't, and the ones that do, we just fixed.

## What I found in our code

Before measuring anything against the competition, I read the entire `virtual-core` source with the goal of finding things that were quantifiably bad on our side, regardless of what anyone else was doing. Twenty-five distinct findings came out of that pass, but a handful of them were so much worse than the others that they're worth calling out individually.

The single worst one was a Map clone. Every time `resizeItem` ran, we'd do `this.itemSizeCache = new Map(this.itemSizeCache.set(item.key, size))`, which copies the entire size cache into a fresh Map purely to invalidate a memoization dep. For a 10,000-item list where every item resizes once on mount, that's roughly 50 million operations purely to bump a memo. It made cold mounts of dynamic-height lists about 1.9 seconds long on a 10k-item list, and the fix was a four-line replacement with a version counter, which dropped that to 1.3 milliseconds. The same dependency-array pattern as before, just with an integer instead of a reference identity, and the measure-storm went 1382× faster.

Right next to it was `setOptions`, which the React adapter calls on every render to merge user-supplied options with defaults. The implementation was `Object.entries(opts).forEach(([key, value]) => { if (undefined) delete opts[key] })` followed by a spread, and the `delete` call was actively triggering V8's hidden-class dictionary-mode transition, which slows every subsequent property access for the lifetime of the object. The replacement is a regular for-in loop that builds a fresh merged object instead of mutating the caller's. 11× faster per call, and as a bonus it stopped silently mutating the caller's options object, which was a hidden contract violation nobody had reported because nobody had noticed.

Below those were the smaller hotspots: a `Math.min(...arr)` spread that could blow V8's argument-list limit at ~125k items, an Array push pattern in `defaultRangeExtractor` that triggered repeated capacity-doubling, an `elementsCache` Map that quietly leaked entries when the ResizeObserver fired for a node React had already replaced, a `useReducer(() => ({}), {})` rerender pattern that allocated a fresh object per scroll event, and a `console.info` debug instrumentation path that wasn't behind a `process.env.NODE_ENV` guard, so consumer minifiers couldn't dead-code-eliminate it. Each one of those was a 10-50 line fix and each one was already shipping in production before the audit.

The point of the audit isn't that any single one of these was catastrophic by itself, since most users would never notice any one of them, it's that together they explain why competitors with simpler internals were beating us on synthetic benchmarks and why our issue tracker had recurring complaints about scroll stuttering, memory growth, and slow initial renders for large lists.

## The cross-library benchmark

I didn't trust any of the existing comparison content, including my own intuition, so I built a benchmark from scratch and committed it to the repo at `benchmarks/`. It's a single Vite app with four library-specific pages, each rendering the exact same dataset through the recommended API for that library, with a Playwright runner that drives the same scenarios across each page and reports medians. Running it is `cd benchmarks && pnpm bench`, taking about ten minutes, and it works on your machine.

The scenarios cover the use cases that actually differ between libraries: cold mount at 1k / 10k / 100k items in both fixed and dynamic sizes, programmatic scroll-to-bottom, jump-to-end accuracy, dynamic-measurement convergence time, memory after mount, and three accuracy edge cases on dynamic lists (jump-to-middle, jump-to-last-end-aligned, jump-while-still-measuring, and a wide-variance dataset where item heights span 16× the estimate). Each scenario reports mount time, first paint, scroll FPS, frame jank, settle time, landing accuracy in pixels, and heap size.

The results disprove the most-cited competitor claim. On every accuracy edge case I tested, TanStack Virtual lands at exactly 0.0 px from the target, matching virtuoso to the pixel. react-window v2 is consistently off by 135-224 pixels across the same scenarios, which is a real and reproducible accuracy bug in their lazy position cache. virtua's target item didn't render at all in any of the accuracy scenarios, which looks like a separate quirk in their `data-index` handling but means we can't compare landing accuracy with them at all. The "virtuoso has better scrollTo accuracy" perception was a benchmark artifact from my initial setup, where the outer scroll container had a 1px CSS border that pushed our inner content down by exactly one pixel against virtuoso's nested scroller; once I removed the border, we're tied.

The remaining real gaps after measurement:

- Mount time at 100k fixed items: 6.1 ms vs virtua's 3.1 ms. We were allocating a VirtualItem object per index even though only ~50 are visible. This is the gap I went after with the biggest single rewrite.
- Memory at 100k items: 14.2 MB vs virtua's 10.6 MB, same root cause.
- iOS Safari momentum scroll: we had zero iOS-specific code, virtua has 17+ explicit paths.
- Backward-scroll jank: well-documented, my own audit landed on the same culprit five times in the issue tracker.

Mount time and memory at scale came down to the same fix.

## The lazy fast path

Replacing the eager VirtualItem object allocation with a typed-array-backed lazy view is the biggest single perf change in this release, and it's also the one that closest resembles what virtua does internally. For single-lane lists (the default, the common case, and the one where the hot path matters most), we now store start and size as a flat `Float64Array(count * 2)` and only construct `VirtualItem` objects when something actually reads `measurements[i]` from the public API. The public API still hands out an `Array<VirtualItem>`-shaped value, but it's a `Proxy` that materializes a `VirtualItem` lazily on first indexed read and caches it.

Internal hot paths (`calculateRange`, `getVirtualItemForOffset`, `getTotalSize`, `resizeItem`) read directly from the typed array, skipping the Proxy entirely, so the binary search inside `calculateRange` doesn't pay 17 trap-call overhead per scroll event.

Cold mount at 100k went from 2.5 ms to 0.54 ms in the synthetic bench, and from 6.1 ms to 4.5 ms in the real React render path. The 100k memory delta is unchanged because the typed array still has to be sized to `count`, which is the price we pay for keeping `[i]` access O(1) instead of degrading to O(log n) like a true tree-based approach would. Going the rest of the distance on memory would mean a Fenwick tree or AA tree like virtuoso uses internally, which is a bigger structural change I deliberately scoped out of this pass.

The Proxy approach has a real bundle cost (~430 B gzip after minification) and I spent a meaningful amount of time wondering whether it was worth shipping. I came down on yes for two reasons. One, the perf win matters most for the people running into our worst cases, and those people are likely already past the point where 400 bytes makes a difference. Two, the alternative ways to close the gap, which I tried, either don't beat 400 bytes (using a Map for the materialized cache went the wrong direction on memory due to V8 internals) or require breaking changes to `measurementsCache` (which users do read directly today).

## iOS Safari is rude

If you've ever called `el.scrollTop = x` on a page that's currently momentum-scrolling on iOS Safari, you already know what happened: the momentum dies, the page snaps to the new value, and the user sees a jolt. iOS WebKit treats any programmatic scrollTop write during a touch-driven scroll as an instruction to cancel and reset, which is the opposite of what every virtualization library wants to do, because every virtualization library writes scrollTop in response to size measurements coming in.

virtua handles this with 17 distinct iOS code paths covering touch event tracking, momentum detection, subpixel rounding compensation, and the elastic-overscroll edge case. We had none. The "scroll abruptly stops when content above me resizes" complaint in our tracker is exactly this, and it had been open for years.

The fix lands in three layers. The first is touch event distinction: we attach passive `touchstart` and `touchend` listeners to the scroll element, and an above-viewport resize that happens while a finger is on the screen, during the 150 ms post-touchend grace window (which is when iOS fires the rest of momentum without sending touch events), or while `isScrolling` is true, gets deferred into an accumulator instead of writing scrollTop. The second is subpixel reconciliation: when the browser reports back a rounded scrollTop within 1.5 px of a value we just wrote, we prefer the intended value rather than treating the round-trip as a real user scroll, which avoids a feedback loop that previously surfaced as scroll jitter on high-DPR displays. The third is the elastic-overscroll clamp: if scrollTop is outside `[0, scrollHeight - clientHeight]`, which happens during the rubber-band bounce at either end, we skip the flush entirely and let the next in-bounds scroll event retry, since writing during the bounce would snap-back to the clamped value at end-of-bounce and discard the user's intent.

Total cost is about 370 bytes gzip for iOS-specific handling, which doesn't tree-shake away on non-iOS bundles because the detection is runtime (a `navigator.userAgent` regex). I verified this by building with esbuild's `--platform=node` flag, which produced identical byte counts to the browser-targeted build, since the bundler can't statically prove the iOS branch is unreachable. Non-iOS users do download the code, but the per-event runtime cost is one boolean check against a cached result. virtua makes the same trade with the same justification.

## The backward-scroll default

The "items jump while I scroll up" complaint cluster is the largest single issue category in our tracker, and the root cause is straightforward: when an item above the viewport resizes (an image loads, a measurement updates, etc.) the previous behavior wrote `scrollTop` to keep the visible window visually stable. That makes sense during forward scroll because otherwise the visible content shifts downward as content above grows, but during backward scroll the same write actively pushes the user past where they're scrolling toward. The community had independently rediscovered the same workaround five times: gate the adjustment on scroll direction.

We now do that by default. Forward scroll and idle (mount-time) adjustments fire the same way they used to, since those are the cases where the visible-window stability is the right answer. Backward scroll skips the write. Consumers who want the old behavior can supply `shouldAdjustScrollPositionOnItemSizeChange` (which was already there) and ignore the direction.

This is technically a default-behavior change, and I went back and forth on whether it should ship behind a feature flag for a release before becoming the default. I came down on default-on for the same reason most libraries make this kind of decision: the prior behavior was the source of the largest single complaint cluster, the workaround was being rediscovered constantly, and the escape hatch already exists. Holding it behind a flag would mean another release cycle of people hitting the same jank.

## What I didn't chase

Three things I decided not to do that you might expect to see in a release like this:

The remaining 1.5 ms mount-time gap to virtua at 100k items. Closing it would require a true lazy prefix-sum walk (Fenwick tree or virtuoso's AA tree), which is a substantial structural change that affects every internal read site. The current architecture's typed-array fill is already 5× faster than where we started, and at 0.5 ms in the synthetic bench it's well below the threshold where anybody would notice. We can revisit this if a real-world case actually requires it.

The 30 px overscroll for users who scroll backward into off-screen items that haven't been re-measured since their last size changed. This is the cost of the backward-scroll-skip default and it's the right trade.

A reverse infinite scroll / chat mode. virtua and virtuoso both ship one. We don't yet. The five-year request thread in our tracker (#27, #195, #400, #1082, #1093) is real and warrants its own scoped feature design rather than getting wedged into this release, which is already large.

## The numbers

Compared to the current published version of `@tanstack/virtual-core`, this release ships:

- Mount cold @ 100k items: 6.1 ms → 4.5 ms in real React, 2.5 ms → 0.54 ms in the synthetic bench (5× the worst case)
- Mount cold @ 500k items: 14.1 ms → 2.7 ms synthetic
- Cumulative `resizeItem` measure-storm on 10k items: 1.9 s → 1.3 ms (yes, the worst-case bug was that bad)
- `setOptions` on every React render: 14.4 ms → 1.3 ms for 10,000 calls
- `defaultRangeExtractor`: 28.8 ms → 12.3 ms for 10,000 calls at visible=1000
- scrollToIndex landing accuracy on dynamic 10k lists: 0.0 px across every edge case (tied with virtuoso, beating react-window by 135-224 px)
- iOS Safari momentum scroll: works
- Backward-scroll jank: gone by default

Bundle delta: roughly +900 bytes gzip for the full set of changes against the previous release, where the lazy fast path and iOS handling account for about 800 of those bytes. Consumer-minified production builds end up around 6.1 kB gzip total.

Tests: 91 unit tests across `virtual-core` and `react-virtual`, all green.

## What's next

The remaining items from my audit doc, in rough priority order if anyone wants to pick them up: pre-rendered destination range for `scrollToIndex` with very wide dynamic sizes (this is what enables virtua's "frozen range" mid-momentum behavior, and it's the one case where they have an accuracy advantage we haven't matched), the Fenwick-tree memory rewrite for 1M+ item lists, a reverse-infinite-scroll mode for chat use cases, and an optional `<VirtualItem>` wrapper component for users who want auto-measurement without giving up headless control over the rest of the markup.

The benchmark suite at `benchmarks/` is checked in and reproducible. The full claim-by-claim verification matrix against every competitor is at `COMPETITOR_CLAIMS_VERIFICATION.md`. If you see a claim about TanStack Virtual that doesn't match what's in either of those, please open an issue and we'll measure it together.
