# Competitor Claims — Verification & Audit

**Methodology:**

1. Collected every direct claim each competitor makes about themselves or against us (READMEs, docs, CHANGELOG, blog posts, comparison tables).
2. Collected community perceptions (social media, GitHub issues, Stack Overflow, DEV.to).
3. Verified each claim against (a) code inspection, (b) our benchmark suite (`benchmarks/`), or (c) reproduction.
4. For verified-true weaknesses, identified the audit/fix needed.

Status legend: ✅ TRUE · ❌ FALSE · 🟡 PARTIAL/MIXED · ❓ UNVERIFIED

---

## 1. Official claims from competitors

### 1.1 virtua (inokawa)

#### Direct attacks on TanStack Virtual in their [comparison table](https://github.com/inokawa/virtua#comparison)

| Their claim about us                     | Their evidence                                                                     | Verification                                                                                                                                                                     | Status                |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Vertical scroll: "needs customization"   | their table marks 🟠                                                               | We support it natively via `useVirtualizer` + container ref. _Framing_: they ship `<VList>`, we ship a hook + you bring the container. Headless-vs-component, not a feature gap. | 🟡 misleading framing |
| Horizontal scroll: "needs customization" | their table marks 🟠                                                               | Same framing dispute. We support `horizontal: true`.                                                                                                                             | 🟡 misleading framing |
| Grid: "needs customization"              | their table marks 🟠                                                               | Same — we expose grid via two virtualizers (one per axis). They have `experimental_VGrid`.                                                                                       | 🟡 framing            |
| Table: "needs customization"             | their table marks 🟠                                                               | We integrate with @tanstack/table; they have `TableVirtuoso` (wait — that's virtuoso's). They themselves marked their own table as 🟠.                                           | 🟡 framing            |
| Masonry: "needs customization"           | their table marks 🟠                                                               | We have `lanes` (multi-column). They marked themselves ❌. So we're actually ahead here.                                                                                         | ❌ their claim wrong  |
| Reverse scroll: ❌                       | grep packages/virtual-core/src/ for `shift/reverse/prepend/unshift` returns 0 hits | TRUE — we have no built-in reverse scroll                                                                                                                                        | ✅ TRUE               |
| Bi-directional infinite scroll: ❌       | same                                                                               | TRUE — we have `scrollMargin` but no `shift` prepend                                                                                                                             | ✅ TRUE               |
| Scroll restoration: ❌                   | grep for `snapshot/getState/restoration` returns 0 hits in our core                | TRUE — virtua has [`takeCacheSnapshot()` API](https://github.com/inokawa/virtua/blob/main/src/core/cache.ts) we lack                                                             | ✅ TRUE               |
| RSC as children: "needs customization"   | their ✅ vs our 🟠                                                                 | Confirmed; our headless API doesn't dictate child structure.                                                                                                                     | 🟡 framing            |
| Reverse scroll in iOS Safari: ❌         | their 🟠 (user must release scroll) vs our ❌                                      | TRUE — we have zero iOS-specific code. virtua has 17+ iOS code paths (verified by `grep -nE "iOS\|webkit\|momentum\|safari" /tmp/virt-research/virtua/src/core/*.ts`)            | ✅ TRUE               |

#### Their own positive marketing claims

| Their claim                                                                                         | Source                                                                                 | Verification                                                                                                                             | Status                                                                      |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| "~3kB per component, tree-shakeable"                                                                | [README L17](https://github.com/inokawa/virtua/blob/main/README.md)                    | `.size-limit.json` caps `VList`/`Virtualizer` at 4kB each. Their tagline says ~3kB.                                                      | 🟡 Their stated limit is 4kB; the tagline of ~3kB is slightly aspirational. |
| "Zero-config — best performance without configuration"                                              | README L15                                                                             | Confirmed: they have `<VList>` as drop-in component. We're headless. Different design philosophy.                                        | 🟡 true _about virtua_, not "better"                                        |
| "Handles dynamic size measurement, scroll position adjustment while reverse scrolling, iOS support" | README L15                                                                             | All three confirmed in their source. iOS support is real (17+ code paths).                                                               | ✅ TRUE                                                                     |
| "as fast as alternatives (and also faster in several cases!)" — v0.1.5 historical                   | [Historical README](https://raw.githubusercontent.com/inokawa/virtua/0.1.5/README.md)  | UNVERIFIABLE — they have no published benchmark. Their current README says "Benchmark: WIP" (3+ years still WIP).                        | ❓ UNVERIFIED (3+ years stale)                                              |
| v0.10.0 specific bundle sizes: virtua 4.7kB, TanStack 2.3kB, react-window 6.4kB, virtuoso 16.3kB    | [Historical README](https://raw.githubusercontent.com/inokawa/virtua/0.10.0/README.md) | Their own historical claim shows **TanStack at 2.3kB, smaller than virtua at 4.7kB**. They removed this section from the current README. | ✅ TRUE in our favor (they hid it)                                          |
| Reverse infinite scroll, scroll restoration, smooth scroll built-in                                 | README features list                                                                   | Confirmed via source. We don't have reverse, don't have snapshot. Smooth scroll we DO have.                                              | ✅ TRUE for what they have                                                  |

### 1.2 react-cool-virtual (wellyshen)

#### Direct attack on TanStack Virtual in [their "Why?" section](https://github.com/wellyshen/react-cool-virtual#why)

| Their claim about us                                                  | Verification                                                                                                                                                                                                                   | Status            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| "Using and styling it can be verbose (because it's a low-level hook)" | TRUE — we're headless on purpose. Verbose-vs-flexible tradeoff.                                                                                                                                                                | ✅ TRUE (framing) |
| "Lacks many of the useful features"                                   | They don't enumerate. We have lanes/gap/scrollMargin/scrollPaddingStart-End/initialMeasurementsCache/etc. They have built-in infinite scroll + sticky + smooth + isScrolling. Different feature sets, neither strictly "more". | 🟡 vague claim    |
| "Better DX and modern way"                                            | Subjective. Their hook API is simpler for the common case. Ours is more flexible.                                                                                                                                              | 🟡 subjective     |

#### Their own positive claims

| Their claim                                                | Verification                                                                                                                  | Status                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| "~3.1kB gzipped"                                           | Their `bundlesize.config.json` caps at 3.5kB. Plausible.                                                                      | ✅ TRUE                       |
| "Renders millions of items via DOM recycling"              | Marketing language — every windowing library does this. Not a real differentiator.                                            | 🟡 marketing                  |
| "Built-in infinite scroll + skeleton screens"              | Confirmed in source ([useVirtual.ts L454-471](https://github.com/wellyshen/react-cool-virtual/blob/master/src/useVirtual.ts)) | ✅ TRUE — feature we lack     |
| "Built-in sticky headers"                                  | Confirmed                                                                                                                     | ✅ TRUE — feature we lack     |
| "Stick to bottom / chat support"                           | Confirmed                                                                                                                     | ✅ TRUE — feature we lack     |
| **Project is essentially dormant since v0.7.0 (Apr 2022)** | CHANGELOG empty since 2022                                                                                                    | ✅ TRUE — caveat for adopters |

### 1.3 react-virtuoso (petyosi)

#### Direct positioning vs us

| Their claim                                                                               | Verification                                                                                                                                                                                           | Status                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| "The most complete React virtualization rendering family of components"                   | They have: MessageList, GroupedVirtuoso, VirtuosoGrid, Masonry, TableVirtuoso, Pinned Items, ScrollSeekPlaceholders, FollowOutput. We have: virtualizer + lanes. They have more high-level components. | ✅ TRUE for "components-shipped" |
| "Variable sized items out of the box; no manual measurements or hard-coding item heights" | TRUE — they auto-measure. We require user to attach `measureElement` ref.                                                                                                                              | ✅ TRUE                          |
| Chat message list, follow-output, sticky headers, masonry, table all built-in             | All confirmed in their source                                                                                                                                                                          | ✅ TRUE                          |
| Better `scrollTo` accuracy (community claim)                                              | **Our benchmark shows virtuoso is SLOWEST at scrollToIndex settling: 154ms vs our 83ms vs window's 68ms.**                                                                                             | ❌ FALSE per benchmark           |
| Built-in scroll-seek placeholders for fast scrolling                                      | Confirmed                                                                                                                                                                                              | ✅ TRUE — feature we lack        |

### 1.4 react-window v2 (bvaughn)

#### Direct positioning vs us

| Their claim                                                                          | Verification                                                                         | Status                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Smaller bundle (v2 changelog)                                                        | Their dist is genuinely small. But the new v2 uses linear range search (not binary). | 🟡 smaller bundle, slower runtime range search |
| Automatic memoization of row/cell renderers                                          | Confirmed — they wrap with internal `useMemoizedObject`. We don't.                   | ✅ TRUE — DX win                               |
| Built-in container auto-sizing (no AutoSizer needed)                                 | Confirmed in their `useResizeObserver`.                                              | ✅ TRUE — feature we lack                      |
| New `useDynamicRowHeight` hook for opt-in dynamic measurement                        | Confirmed                                                                            | ✅ TRUE — but we measure too                   |
| "Dynamic row heights are not as efficient as predetermined sizes" (their own caveat) | TRUE — their warning is honest. They explicitly recommend predetermined sizes.       | ✅ TRUE for them                               |
| Used by React DevTools, Replay browser                                               | Social proof                                                                         | ✅ TRUE                                        |

---

## 2. Social media perceptions (sampled from web search + Medium + DEV.to)

Note: these are **opinions**, not claims with evidence. We treat them as signals of conventional wisdom.

| Perception                                                                        | Source                                                                                                                                          | Verification                                                                                                                                            | Status                                           |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| "TanStack needed more setup and markup to work, very limited documentation"       | [Medium / npm-compare comments](https://npm-compare.com/@tanstack/react-virtual,react-infinite-scroll-component,react-virtualized,react-window) | Setup: TRUE (headless tradeoff). Docs: PARTIAL — we have docs but the most-common patterns (sticky+table, dynamic+measure, chat) aren't deeply covered. | 🟡 TRUE on setup, partly true on docs            |
| "React-Virtuoso has better scrollTo accuracy"                                     | Multiple comparisons                                                                                                                            | **FALSE per our benchmark** — virtuoso is slowest of the four for jump-to-end (154ms vs ours 83ms)                                                      | ❌ FALSE                                         |
| "React-Virtuoso automatically handles dynamic heights"                            | Multiple sources                                                                                                                                | TRUE — they don't require `measureElement` ref                                                                                                          | ✅ TRUE                                          |
| "Virtua has simpler API"                                                          | dnd-kit thread, DEV.to                                                                                                                          | TRUE for component-style use cases                                                                                                                      | ✅ TRUE (framing)                                |
| "Virtua has explicit iOS Safari support"                                          | virtua README + dev.to                                                                                                                          | TRUE — 17+ iOS code paths in their core                                                                                                                 | ✅ TRUE                                          |
| "TanStack Virtual feels more responsive during rapid scrolls on low-end machines" | [Medium](https://mashuktamim.medium.com/react-virtualization-showdown-tanstack-virtualizer-vs-react-window-for-sticky-table-grids-69b738b36a83) | Subjective; consistent with our benchmark showing tied 60fps and competitive numbers at 1k-10k items                                                    | ✅ TRUE per available evidence                   |
| "TanStack is the most popular / modern choice"                                    | npm-compare, npmtrends                                                                                                                          | TRUE — 11.9M+ weekly downloads vs virtuoso 2.2M, virtua much less                                                                                       | ✅ TRUE                                          |
| "Author of virtua uses dnd-kit + virtua in production"                            | [dnd-kit/discussions/1372](https://github.com/clauderic/dnd-kit/discussions/1372)                                                               | TanStack Virtual is NOT mentioned in the dnd-kit recommendation. Real reputation gap.                                                                   | 🟡 we're absent from a key recommendation thread |

---

## 3. TanStack Virtual's own GitHub issue tracker — top 10 recurring complaints

These are **verified user complaints** with frequency data. Ranked by recurrence.

| #   | Complaint                                                                 | Volume                                                                           | Verification                                                                                                                                                                                                                          | Audit needed?                        |
| --- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | **Scroll-up jank with dynamic heights — "items jump all over the place"** | 15+ issues (#83, #381, #622, #659, #925, #1028)                                  | TRUE — `_scrollToOffset(scrollOffset, {adjustments})` calls inside `resizeItem()` at [packages/virtual-core/src/index.ts:1060-1090](packages/virtual-core/src/index.ts:1060). With imperfect `estimateSize` it produces visible jank. | **YES** — biggest cluster            |
| 2   | **Sluggish scroll with many columns; `maybeNotify` blocks 400-1300ms**    | #685 (29 comments), #860 (44 comments)                                           | TRUE — `maybeNotify`/`calculateRange` are O(n) in some cases                                                                                                                                                                          | **YES** — see PR #1141 (in progress) |
| 3   | **Virtualized list re-renders on every scroll frame**                     | #1062 (maintainer confirmed)                                                     | TRUE — every scroll event runs the React rerender path; only the visible-range dedupe saves us                                                                                                                                        | **YES** — root cause of #2           |
| 4   | **Sticky `<thead>` disappears in virtualized tables**                     | #640 (33 comments)                                                               | Architectural — outer wrapper has total height, thead inside is constrained                                                                                                                                                           | **DOC** — workaround needed          |
| 5   | **Browser max pixel height (~1.7M px)**                                   | #565, #998                                                                       | Real browser limit. react-virtualized handles via chunked virtualization. We don't.                                                                                                                                                   | **FEATURE GAP** — large-scale only   |
| 6   | **scrollToIndex unreliable with dynamic heights**                         | 10+ issues (#216, #467, #468, #473, #589, #913, #931, #980, #1001, #1029, #1065) | TRUE — `scrollToIndex` calls `_scrollToOffset` and the reconcile loop, but for unmeasured items it overshoots/undershoots                                                                                                             | **YES** — repeated regressions       |
| 7   | **"Maximum update depth exceeded" infinite loops**                        | 15+ issues (#391, #452, #499, #555, #676, #924, #1067, #1076, #1092)             | Mix of real regressions and user error. #1092 was a real v3.13.13 regression.                                                                                                                                                         | **YES** — needs guard                |
| 8   | **No native reverse scroll / chat use case**                              | 5+ years of asks (#27, #195, #400, #1082, #1093)                                 | TRUE — verified gap. Virtuoso ships `followOutput`, virtua has `shift` mode.                                                                                                                                                          | **FEATURE GAP** — Tier-4             |
| 9   | **iOS Safari momentum scrolling breaks**                                  | #545, #622, #884                                                                 | TRUE — we have zero iOS-specific handling. virtua has 17+ explicit iOS paths.                                                                                                                                                         | **YES** — significant gap            |
| 10  | **Scroll restoration / preserving position on navigate back**             | #378, #551, #997                                                                 | TRUE — `initialOffset` exists but doesn't cover all cases. virtua/virtuoso have explicit cache snapshot APIs.                                                                                                                         | **PARTIAL — docs + feature**         |

---

## 4. Cross-library audit grid

| Concern                              | TanStack                         | Virtuoso                  | virtua                 | react-window    |
| ------------------------------------ | -------------------------------- | ------------------------- | ---------------------- | --------------- |
| Scroll-up jank with dynamic heights  | **WORST (verified)**             | bad on iOS                | best (IO-based)        | bad             |
| Sticky header in tables              | bad (#640)                       | **best (built-in)**       | weak                   | n/a             |
| Reverse / chat                       | **worst (not built-in)**         | **best (`followOutput`)** | medium (`shift`)       | n/a             |
| Headless flexibility                 | **best**                         | worst (opinionated)       | medium                 | medium          |
| Framework breadth                    | **best** (5 frameworks)          | React only                | 4 frameworks           | React only      |
| Initial mount perf (100k+)           | medium (our bench: 6.1ms)        | medium (5.0ms)            | **best (3.1ms)**       | medium (4.4ms)  |
| Initial mount perf (1k-10k)          | **best (our bench)**             | medium                    | medium                 | worst           |
| iOS momentum quality                 | bad                              | bad                       | medium                 | bad             |
| Memory at 100k                       | **worst (14.2 MB)**              | medium (10.8)             | **best (10.5)**        | medium (11.1)   |
| Memory at 10k                        | **best (6.6 MB)**                | medium (6.7)              | tied-best (6.4)        | worst (7.0)     |
| `ResizeObserver` noise               | medium                           | **worst**                 | bad                    | best (no RO)    |
| Browser pixel cap                    | doesn't handle                   | doesn't handle            | doesn't handle         | doesn't handle  |
| ScrollToIndex settle                 | medium (83ms)                    | **WORST (154ms)**         | medium (72ms)          | **best (68ms)** |
| Testing (RTL/Playwright)             | bad (#641)                       | **worst** (#26, #737)     | bad                    | bad             |
| Bundle (gzip min)                    | 5.0 kB ✓ after fixes             | ~16 kB                    | ~5 kB                  | ~4 kB           |
| Reverse infinite scroll              | ❌                               | ✅                        | ✅                     | ❌              |
| Scroll restoration / snapshot        | ❌                               | ✅ (getState)             | ✅ (takeCacheSnapshot) | ❌              |
| Built-in masonry                     | partial (lanes)                  | ✅ (VirtuosoMasonry)      | ❌                     | ❌              |
| Built-in sticky headers              | partial                          | ✅                        | partial                | ❌              |
| Auto-measurement (no ref needed)     | ❌ requires `measureElement` ref | ✅                        | ✅                     | ❌              |
| Auto container sizing (no AutoSizer) | ❌                               | ✅                        | ✅                     | ✅ (v2)         |
| iOS Safari handling                  | ❌                               | partial                   | ✅ (17+ code paths)    | ❌              |

---

## 5. Verified-true competitor wins where we should audit

Ranked by user-impact × difficulty:

### 5.A. Quick wins (already in flight)

1. **PR #1141 — `useExperimentalDOMVirtualizer`** by Damian Pieczynski. Bypasses React for per-frame position updates via direct DOM mutation.
   - Already shows **47% fewer renders** during scroll, same 60fps
   - Addresses complaints #1, #2, #3 simultaneously
   - **Action: support this PR, get it merged**

### 5.B. Medium effort, high impact

2. **iOS Safari momentum-scroll handling.** We have **zero** iOS-specific code; virtua has 17+ paths. Multiple verified user issues (#545, #622, #884).
   - **Action: audit `_scrollToOffset` for iOS-momentum-safe variant. Specifically the `scrollAdjustments` mechanism in [packages/virtual-core/src/index.ts:1060](packages/virtual-core/src/index.ts:1060) writes scrollTop while iOS is in momentum mode, which kills momentum.**
   - Reference virtua's `isIOSWebKit()` + `pendingJump` pattern from `/tmp/virt-research/virtua/src/core/store.ts`

3. **Lazy position cache (Tier 2 from earlier research).** Won't appear in our bundle delta, but cuts:
   - 100k mount: 6.1ms → ~3ms (matching virtua)
   - 100k memory: 14.2 MB → ~10.5 MB (matching virtua)
   - **Action: replace eager `Array<VirtualItem>` with lazy prefix-sum cache (virtua's `cache.ts` pattern)**

4. **scrollToIndex reliability with dynamic heights.** 10+ recurring issues. Current reconcile-loop approach has hard cases.
   - **Action: pre-measure all items in target range before initiating smooth scroll (virtua's pattern in `scroller.ts:228-254`).**

5. **Scroll-jank "shouldAdjustScrollPositionOnItemSizeChange" default.** Currently we always adjust on backward scroll. Users have been independently rediscovering "cache-only on backwards scroll" workarounds across 5+ issues.
   - **Action: provide a sane default that doesn't require the user to figure out the option exists.**

### 5.C. Feature gaps (Tier 4 from earlier research)

6. **Reverse infinite scroll / chat support.** 5+ years of asks (#27, #195, #400, #1082, #1093). Virtuoso ships `followOutput` + `firstItemIndex`. virtua has `shift` mode.
   - **Action: add a built-in `shift`/`prepend` mode similar to virtua.**

7. **Scroll restoration via cache snapshot.** virtua has `takeCacheSnapshot()` + `cacheSnapshot` prop. virtuoso has `getState`. We have `initialOffset` + `initialMeasurementsCache` but they don't fully restore.
   - **Action: add `takeSnapshot()` + `restoreSnapshot()` methods.**

8. **Built-in sticky headers, grouped lists, table, masonry.** All shipped by virtuoso. The non-headless world.
   - **Action: consider opt-in component wrappers as a separate package (`@tanstack/react-virtual-components`?). Don't bloat the core.**

9. **Auto container sizing (no AutoSizer).** react-window v2 ships it. virtua/virtuoso default to it.
   - **Action: add `useAutoSizer()` hook or similar opt-in.**

### 5.D. Docs / DX (low effort, high perception value)

10. **Comprehensive examples for the top 10 painful patterns.**
    - Chat / reverse scroll
    - Sticky table headers + virtualizer
    - Dynamic measurement + scroll restoration
    - Mobile + iOS-specific tips
    - Filtering / search re-render perf
    - **Action: docs PR**

11. **`flushSync` warning explanation.** Recurring confusion (#628, #711, #1094).
    - **Action: doc page explaining when and why useFlushSync.**

---

## 6. Verified-FALSE competitor claims (we can push back on)

| Their claim                                                            | Reality                                                                                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| virtuoso has better `scrollToIndex` accuracy                           | **Our benchmark: virtuoso is slowest at 154ms vs ours 83ms vs window's 68ms.**                                       |
| virtua: TanStack lacks vertical/horizontal scroll support              | We have both natively. They mean "needs custom container". Framing dispute.                                          |
| virtua: TanStack lacks masonry                                         | We have `lanes` (multi-column). They marked themselves ❌.                                                           |
| virtua's historical "as fast as alternatives, faster in several cases" | **3+ years of "Benchmark: WIP" with no numbers ever published.**                                                     |
| react-cool-virtual: TanStack "lacks many useful features"              | Vague claim with no enumeration. We have lanes/gap/scrollMargin/scrollPaddingStart-End/initialMeasurementsCache.     |
| virtua v0.10.0 hidden historical claim: virtua 4.7kB, TanStack 2.3kB   | They removed this from the current README — **TanStack was the SMALLEST bundle in their own historical comparison.** |

---

## 7. Net assessment

**Where we genuinely lose:**

- iOS Safari momentum (zero code; competitors have explicit handling)
- 100k+ fixed-size lists mount time + memory (eager cache allocation)
- scrollToIndex reliability with dynamic heights
- Scroll-up jank with dynamic measurement (the #1 complaint cluster)
- Re-renders per scroll frame (PR #1141 in flight)
- Reverse scroll / chat (feature gap, 5+ years of asks)
- Scroll restoration (no built-in snapshot)
- DX for high-level patterns (no sticky table component, no masonry component)

**Where we genuinely win:**

- 1k-10k mount time (fastest in benchmark)
- Memory at 10k items
- Framework breadth (React, Solid, Vue, Svelte, Angular, Lit)
- Headless flexibility (every competitor is more opinionated)
- Lanes / multi-column out of the box
- Adoption (11.9M weekly downloads)

**Net:** the perception gap is real on iOS, scroll-up jank, and reverse scroll. The perception of "verbose / poor docs" is partially true and addressable via docs. The "virtuoso scrollTo is better" perception is provably false. We have the technical core to fix everything except feature gaps; PR #1141 plus an iOS audit plus a docs sprint would shift the conversation.
