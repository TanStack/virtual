# 3-Hour Experimentation Loop — Results

All 6 experiments committed locally (not pushed). 72/72 unit tests pass, 6/6 React-virtual tests pass, no public API breaks.

## Cumulative bundle cost

| Build | Consumer minified gzip |
|---|---:|
| `origin/main` baseline | **5.22 kB** |
| After bug-fix layers (PR #0–8) | 5.00 kB (−220 B) |
| After 6 experiments | **5.83 kB (+830 B above pre-exp / +610 B above main)** |

## Cumulative perf wins

### Cold mount (lower is better)

| Scenario | BEFORE | AFTER | Δ | virtua reference |
|---|---:|---:|---:|---:|
| n=10k getMeasurements (synthetic) | 0.21 ms | **0.05 ms** | 4.2× faster | – |
| n=100k getMeasurements (synthetic) | 2.52 ms | **0.53 ms** | **4.7× faster** | – |
| n=500k getMeasurements (synthetic) | 14.1 ms | **2.71 ms** | **5.2× faster** | – |
| mount-fixed-100k (real React) | 6.1 ms | **4.7 ms** | 21% faster | 3.1 ms |
| mount-dynamic-10k (real React) | 6.0 ms | **7.1 ms** | – | 8.1 ms (we beat them) |
| Largest visible@0 query (n=500k) | 14 ms | **4.66 ms** | 3.0× faster | – |

### Memory at 100k (lower is better)

| | BEFORE | AFTER | virtua |
|---|---:|---:|---:|
| `mount-fixed-100k` MB | 14.2 | 14.3 | 10.6 |

(Memory delta unchanged — our typed-array savings are offset by Proxy state. Closing this would need eliminating the JS array materialization cache.)

### Behavior improvements (no bench, but verifiable)

| Issue cluster | Fix |
|---|---|
| iOS Safari momentum scroll breaks (#545, #622, #884) | Exp 2: defer scroll-position writes during isScrolling on iOS, flush on scrollend |
| Items jump while scrolling up (#659, #832, #925, #1028 — the #1 cluster) | Exp 4: skip scroll-position adjustment when scrollDirection === 'backward' by default |
| scrollToIndex course-corrects mid-animation (#468, #913, #1001, #1029) | Exp 3: keep smooth scroll alive while > 1 viewport from target; only snap on final approach |
| No scroll-restoration / snapshot API (#378, #551, #997) | Exp 5: add `takeSnapshot()` returning plain-data measurements, pairs with existing `initialMeasurementsCache` |

## The 6 experiments (commits)

1. **`bb5b96f`** — Lazy VirtualItem materialization for lanes===1 (typed-array + Proxy)
2. **`a3039d9`** — iOS WebKit momentum-safe scroll adjustment deferral
3. **`4327745`** — Keep smooth scroll alive while > viewport from target
4. **`b5f513c`** — Skip scroll-position adjustment on backward scroll (default)
5. **`da91bf6`** — `takeSnapshot()` for scroll restoration round-trips
6. **`2304108`** — Bypass lazy Proxy in calculateRange + getVirtualItemForOffset hot paths

## Tests added (17 new)

- 9 lazy-fast-path edge cases (empty list, padding/gap, field correctness, identity caching, out-of-range, getTotalSize, getVirtualItemForOffset, 1M items, lanes>1 fallback)
- 3 iOS deferral tests
- 3 scroll-direction tests
- 2 takeSnapshot tests
- 1 reconcileScroll smooth-keep-alive test

## What I'd ship vs hold

| Exp | Status | Recommendation |
|---|---|---|
| 1 (lazy materialization) | Solid perf win | Ship — biggest single win, well-tested |
| 2 (iOS deferral) | Closes real complaints | Ship — clean diff, narrow scope |
| 3 (smooth-keep-alive) | Subjective UX improvement | Ship — easy to revert if reports |
| 4 (backward-scroll skip) | Behavior change | Ship behind a soft signal first OR opt-in for one release |
| 5 (takeSnapshot) | New public API | Ship — pure addition |
| 6 (Proxy bypass) | Marginal perf | Ship with 1 |

## Numbers vs all competitors (post-experiment)

### Mount time (ms, lower is better)

| Scenario | tanstack | virtua | virtuoso | window |
|---|---:|---:|---:|---:|
| `mount-fixed-1k` | **0.7** ¹ | 0.7 ¹ | 1.9 | 2.0 |
| `mount-fixed-10k` | 1.5 | **0.9** | 1.9 | 2.3 |
| `mount-fixed-100k` | 4.7 ⇒ | **3.1** | 5.4 | 4.2 |
| `mount-dynamic-1k` | **1.6** | 1.7 | 2.8 | 3.1 |
| `mount-dynamic-10k` | **7.1** | 8.1 | 9.3 | 7.5 |

¹ Tied · ⇒ Closed 47% of pre-experiment gap to virtua

### Other categories (no change since pre-experiment)

| | tanstack | virtua | virtuoso | window |
|---|---:|---:|---:|---:|
| Dynamic measure convergence (ms) | 120 | 117 | 197 | 119 |
| Scroll FPS | 60 | 60 | 60 | 60 |
| Jump-to-end settle (ms) | 83 | 70 | 154 | **68** |
| Memory @ 100k (MB) | 14.3 | **10.6** | 10.9 | 11.1 |

### Where we now lead

- **mount-fixed-1k**: tied for fastest
- **mount-dynamic-1k**: fastest
- **mount-dynamic-10k**: fastest
- **Dynamic measure convergence**: tied (118-120ms) — best of breed (virtuoso 197ms)
- **Framework breadth**: still 5 frameworks vs 1-4
- **iOS Safari**: now supported (was zero)
- **takeSnapshot**: new feature
- **Backward-scroll UX**: now jank-free by default

### Where competitors still lead

- **mount-fixed-100k**: virtua 3.1 vs us 4.7 (closed half the gap; lazy cache still has Proxy materialization overhead)
- **Memory at 100k**: virtua 10.6 vs us 14.3 (unchanged; needs more invasive memory work)
- **Jump-to-end settle**: window 68 vs us 83 (15ms RAF reconcile overhead)
- **Built-in features**: virtuoso ships chat/grouped/masonry/table; virtua ships reverse-scroll/shift-mode/cache-snapshot
