---
'@tanstack/virtual-core': minor
---

feat: Add built-in scroll-scaling to bypass browser scroll height limits

Browsers cap `scrollHeight` at approximately 33.5 million pixels, making items at the end of very large lists unreachable. The virtualizer now automatically detects when the total virtual size exceeds the configurable `maxScrollSize` (default: 33,000,000 px) and applies a transparent scale transform to compress the scroll range.

**New option:**
- `maxScrollSize` — Maximum physical scroll container size in pixels. Set to `Infinity` to disable scaling. Default: `33_000_000`.

**New property:**
- `scale` — The current scale factor (1 when no scaling is active).

When scaling is active:
- `getTotalSize()` returns the capped physical size for use as the container's CSS height/width.
- `getVirtualItems()` returns items with physical coordinates — use `item.start` directly for positioning.
- `scrollToIndex()`, `scrollToOffset()`, and `scrollBy()` work transparently.
- Scroll anchoring (resize adjustments for items above the viewport) works correctly through the scale transform.

When scaling is **not** active (the vast majority of use cases), there is zero overhead — the existing code paths are unchanged.

This feature is implemented entirely in `virtual-core` and works across all framework adapters (React, Vue, Solid, Svelte, Angular, Lit) with no adapter changes required.
