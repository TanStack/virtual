# iOS Support — Phase 1 & 2 Plan

**Context**: Experiment 2 already shipped MVP iOS handling — detect WebKit, defer scrollTop writes during `isScrolling`, flush on transition to `!isScrolling`. This plan extends it to match virtua's depth on the most-cited iOS scroll bugs.

**Reference impl**: `/tmp/virt-research/virtua/src/core/scroller.ts` + `store.ts`. virtua has ~17 iOS-specific code paths; this plan picks the ones with the largest user impact.

**No code changes here — design only.** Each phase ends with a discrete commit that ships independently.

---

## Phase 1 — Touch event distinction (active drag vs momentum decay)

### Why it matters

`isScrolling` doesn't distinguish three different scroll states:

1. **Active drag** — finger on screen, user actively dragging
2. **Momentum decay** — finger lifted, inertial scrolling
3. **Programmatic** — `scrollTo`/`scrollBy` from JS

Currently Experiment 2 defers scrollTop writes during _any_ `isScrolling=true` and flushes when it transitions false. That works for case 2, but is overly conservative for cases 1 and 3. virtua tracks `touching` and `justTouchEnded` separately so it can:

- During active drag: never write scrollTop (writes are silently dropped by iOS anyway, but tracking lets us know to defer)
- During momentum decay: also defer (this is what we already do)
- After both: flush (this is what we already do)

The new value comes from one specific case: **resize during active drag**. Today we defer that until momentum decay starts and then trigger the flush. With touch tracking we flush sooner (immediately on `touchend`), which closes a small visible-jolt window.

### Mechanism

Three new fields on `Virtualizer`:

```ts
private _iosTouching = false        // touch is currently down
private _iosJustTouchEnded = false  // touchend fired; we're in early-momentum
private _iosTouchEndTimer: number | null = null  // window for justTouchEnded
```

Listeners attached in `_willUpdate` alongside the existing observers:

```ts
const onTouchStart = () => {
  this._iosTouching = true
  this._iosJustTouchEnded = false
  if (this._iosTouchEndTimer != null) {
    targetWindow.clearTimeout(this._iosTouchEndTimer)
    this._iosTouchEndTimer = null
  }
}
const onTouchEnd = () => {
  this._iosTouching = false
  this._iosJustTouchEnded = true
  // After ~150 ms with no scroll/touch events, we're done with iOS
  // momentum-tracking and can clear justTouchEnded.
  this._iosTouchEndTimer = targetWindow.setTimeout(() => {
    this._iosJustTouchEnded = false
    this._iosTouchEndTimer = null
  }, 150)
}
element.addEventListener('touchstart', onTouchStart, addEventListenerOptions)
element.addEventListener('touchend', onTouchEnd, addEventListenerOptions)

// Cleanup
unsubs.push(() => {
  element.removeEventListener('touchstart', onTouchStart)
  element.removeEventListener('touchend', onTouchEnd)
  if (this._iosTouchEndTimer != null) {
    targetWindow.clearTimeout(this._iosTouchEndTimer)
    this._iosTouchEndTimer = null
  }
})
```

Then the flush condition (today in the `observeElementOffset` callback) tightens:

```ts
// Was: flush when isScrolling becomes false
if (wasScrolling && !isScrolling && this._iosDeferredAdjustment !== 0) {
  flush
}

// New: flush when truly settled — not scrolling, not touching, not in early-momentum
if (
  this._iosDeferredAdjustment !== 0 &&
  !isScrolling &&
  !this._iosTouching &&
  !this._iosJustTouchEnded
) {
  flush
}
```

The flush is also wired into the touchend timer's expiration, so we don't sit on a deferred adjustment forever if no scroll event fires afterward.

### Test plan

1. **iOS touchstart sets `_iosTouching=true`** — mock touchstart, assert field
2. **iOS touchend sets `_iosJustTouchEnded=true` and starts timer** — mock touchend, assert field + timer
3. **timer expires → `_iosJustTouchEnded=false`** — fast-forward jest timers
4. **Resize during touchstart→touchend window: no scrollTop write** — mock touchstart, fire resizeItem, assert scrollToFn not called
5. **Resize accumulates during touch session** — multiple resizes, single deferred sum
6. **Flush happens on touchend (after momentum decay timer)** — touchend fires, advance time, assert scrollToFn called once with accumulated delta
7. **Non-iOS: zero change in behavior** — regression guard, all existing tests still pass

Existing 72 tests must still pass.

### Risk

**Low.** All changes are additive; the only flow change is _when_ the deferred adjustment flushes (touch-aware instead of scroll-event-aware). If touch events aren't fired (non-touch device), `_iosTouching` and `_iosJustTouchEnded` stay false and we fall back to the current Experiment-2 behavior.

### Effort estimate

**4–6 hours**:

- 1 h: implement the three fields, listeners, and flush gate
- 1 h: write 7 regression tests with mocked touch events
- 1 h: verify in a real iOS browser via Playwright (manual)
- 1–3 h: shake out edge cases (multi-touch, touch cancel, scroll element swap mid-touch)

### Bundle impact

**~+150 B gzip.** Two listeners, three fields, a 150 ms timer, conditional flush.

---

## Phase 2 — Safari subpixel + elastic-overscroll handling

Two narrower fixes that address known Safari quirks not covered by Phase 1.

### 2a. Subpixel reconciliation on scrollTop writes

#### Why it matters

Safari (and Chrome/Firefox in 2023+) round `scrollTop`/`scrollLeft` writes to integer pixels under some DPR settings. If we write `el.scrollTop = 12345.5`, the actual scrollTop is 12345 or 12346. Subsequent `el.scrollTop` reads can disagree with the value we wrote by up to 1 px.

This currently shows up as:

- Our `reconcileScroll` sees `getScrollOffset() !== targetOffset` even after a clean write → believes target shifted → re-fires `_scrollToOffset` → infinite ping-pong
- The existing `approxEqual(a, b) < 1.01` tolerance is what protects us, but it's a workaround, not a fix

#### Mechanism

Track the _intended_ scrollTop separately from the browser's reported value:

```ts
// New field
private _intendedScrollOffset: number | null = null

// In _scrollToOffset, record what we asked for
this.options.scrollToFn(toOffset, ..., this)
this._intendedScrollOffset = toOffset

// In the observeElementOffset callback, distinguish browser-driven from self-driven scrolls
const isFromOurWrite =
  this._intendedScrollOffset !== null &&
  Math.abs(offset - this._intendedScrollOffset) < 1.5

if (isFromOurWrite) {
  // The browser rounded our write; trust the intended value for our internal
  // bookkeeping while reporting the actual scroll offset to the user.
  this.scrollOffset = this._intendedScrollOffset
  this._intendedScrollOffset = null
} else {
  this.scrollOffset = offset
}
```

#### Test plan

1. **scrollTo(123.5) then observeElementOffset fires with 123: scrollOffset stays at 123.5** — pin the subpixel-rounding contract
2. **User scroll → observeElementOffset fires with arbitrary value: scrollOffset matches the browser value** — non-self-driven path unchanged
3. **Two consecutive writes track separately** — second write resets intended

#### Risk

**Low–medium.** The 1.5 px tolerance is the trickiest knob. Too tight and we miss browser-rounded writes; too loose and we misattribute user scrolls to ours. virtua uses `abs(flushedJump) + 1` for the same purpose; the +1 absorbs rounding.

#### Effort estimate

**3–4 hours.**

#### Bundle impact

**~+80 B.**

---

### 2b. scrollTopMax clamp for Safari elastic-overscroll

#### Why it matters

Safari's elastic scrolling (rubber-band) lets the user drag past the top or bottom of the content. During that overscroll period, `scrollTop` is negative or greater than `scrollHeight - clientHeight`. Our `resizeItem` adjustments don't check this and can write scrollTop _into_ the elastic-overscroll zone, which on touchend snaps back to a different position than the user expected.

#### Mechanism

Skip the deferred-flush write if the current scrollTop is outside the valid range:

```ts
const max = this.getMaxScrollOffset()
const cur = this.getScrollOffset()
const inElasticZone = cur < 0 || cur > max

if (!inElasticZone) {
  this._scrollToOffset(currentOffset, {
    adjustments: deferred,
    behavior: undefined,
  })
}
// else: leave the adjustment deferred; it gets re-attempted on the next
// scroll event, by which time the elastic-bounce has resolved
```

#### Test plan

1. **scrollTop negative (overscroll): flush is skipped** — mock negative scrollTop, fire deferred flush, assert scrollToFn not called
2. **scrollTop within bounds: flush fires normally** — regression
3. **scrollTop > max (overscroll-bottom): flush is skipped**
4. **Subsequent in-bounds scroll event re-attempts the flush** — multi-step state machine

#### Risk

**Low.** Adds a guard; nothing changes when the user isn't overscrolling.

#### Effort estimate

**2–3 hours.**

#### Bundle impact

**~+50 B.**

---

## Combined Phase 2 totals

| Item                       |    Effort |     Bundle |
| -------------------------- | --------: | ---------: |
| 2a subpixel reconciliation |     3–4 h |      +80 B |
| 2b scrollTopMax clamp      |     2–3 h |      +50 B |
| **Phase 2 total**          | **5–7 h** | **+130 B** |

## Combined Phase 1 + 2

|                             |     Effort |     Bundle | New tests | Closes / addresses                              |
| --------------------------- | ---------: | ---------: | --------: | ----------------------------------------------- |
| Phase 1 (touch distinction) |      4–6 h |     +150 B |         7 | #884 (mostly), #622, #545 cleanly               |
| Phase 2a (subpixel)         |      3–4 h |      +80 B |         3 | scrollToIndex precision on subpixel DPRs        |
| Phase 2b (scrollTopMax)     |      2–3 h |      +50 B |         4 | iOS overscroll → resize snap-back bugs          |
| **Total**                   | **9–13 h** | **+280 B** |    **14** | All three open iOS issues + several subtle ones |

After this, our iOS code-path count goes from 0 → ~10 (vs virtua's 17+). The remaining 7-ish are: the overflow:hidden momentum-break hack, dual-direction wheel handling, RTL-on-iOS quirks, and edge-case scroll-snap interactions. Those have diminishing returns; would only revisit if specific issues come in.

---

## Sequencing recommendation

1. **Land Phase 1 first** as a single PR (it's the most impactful and self-contained). Soak for a couple weeks; see if any new iOS issues come in.
2. **Phase 2a** as a follow-up; it's the subtlest piece because of the 1.5 px tolerance.
3. **Phase 2b** last, behind a feature flag (`useElasticOverscrollClamp: false` default for one release) since "iOS elastic overscroll behaves differently" is the kind of change that could surprise apps relying on quirks.

## Bundle impact

Measured against the current shipped bundle (5,847 B gzip):

| Item                                | Source size | Gzip impact | Notes                                                                        |
| ----------------------------------- | ----------: | ----------: | ---------------------------------------------------------------------------- |
| Exp 2 (already shipped)             |      ~250 B |   **103 B** | The `isIOSWebKit()` detection + `_iosDeferredAdjustment` field + flush logic |
| Phase 1 (touch distinction)         |      ~280 B |  **~150 B** | 3 fields + 2 listeners + 150ms timer + flush gate                            |
| Phase 2a (subpixel reconciliation)  |      ~120 B |   **~80 B** | 1 field + tracking logic in `_scrollToOffset` + callback                     |
| Phase 2b (scrollTopMax clamp)       |       ~80 B |   **~50 B** | `inElasticZone` guard around the flush write                                 |
| **Total iOS cost (post Phase 1+2)** |  **~730 B** |  **~383 B** | ~6.5% of total bundle                                                        |

### Does it tree-shake?

**No.** The iOS gate is runtime (`navigator.userAgent` check), so the source ships in every bundle. Verified by building with `--platform=node`: same byte count, meaning bundlers can't statically eliminate the iOS branches even when there's no DOM at all.

What this means in practice:

| Consumer               | Downloads  | First-time runtime                                | Per-event cost     |
| ---------------------- | ---------- | ------------------------------------------------- | ------------------ |
| Chrome/Firefox desktop | All ~390 B | One UA-regex call (cached)                        | One bool check     |
| iOS Safari             | All ~390 B | One UA-regex call (cached)                        | Activates deferral |
| Next.js SSR (Node)     | All ~390 B | `typeof navigator === 'undefined'` → early-return | Never executes     |

### Could we make it shake out?

Three options if bundle weight ever becomes a real complaint:

1. **Build-time flag `process.env.TANSTACK_NO_IOS`** — wrap iOS code in `if (process.env.TANSTACK_NO_IOS !== 'true') { … }` so consumer minifiers DCE when defined. Adds opt-out story to docs.
2. **Separate `@tanstack/virtual-core/no-ios` entry** — two builds, two doc paths. High DX cost, low practical uptake.
3. **Status quo (chosen)** — ship to all, runtime-skip on non-iOS. Matches virtua's choice; virtua doesn't separate iOS code either.

### Why ship default-on anyway

iOS Safari is 25-30% of US mobile traffic and even higher for the consumer apps that use virtualization heavily (chats, feeds, message lists). The bundle cost (~390 B / 6.5%) buys correct momentum-scroll behavior for that entire population. The non-iOS runtime cost is one boolean check per scroll/resize event — well below noise.

## Things explicitly out of scope

- **The `overflow:hidden` momentum-break hack** (virtua's `scroller.ts:339-346`). Effective but spooky; consider only if a Phase-1-fixable case slips through.
- **Phase 3 / `<VirtualItem>` wrapper**. You called this petty competition messaging — leaving aside per your direction.
- **`visibilitychange` re-observe**. virtua doesn't do this; not seeing a real complaint that needs it.
