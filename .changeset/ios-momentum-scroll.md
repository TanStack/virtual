---
'@tanstack/virtual-core': minor
---

feat: iOS momentum-safe scroll adjustments via CSS offset

On iOS WebKit, writing `scrollTop` during momentum scroll cancels the in-flight scroll. Instead of writing `scrollTop`, we now apply a negative `marginTop` on the container element to visually compensate for above-viewport size changes. The CSS offset is flushed to a real `scrollTop` write once momentum fully settles.

- Defer scroll adjustments during iOS touch and momentum phases using CSS offset (`marginTop`/`marginLeft`)
- Force-flush CSS offset before programmatic scroll operations (`scrollToIndex`, `scrollToOffset`, `scrollBy`)
- Compensate `scrollOffset` for active CSS offset in range calculations
- Guard against Safari elastic overscroll (rubber-band) during flush
- Clean up CSS offset on unmount
- Refine backward-scroll suppression: first measurements always adjust regardless of direction; re-measurements skip during backward scroll to avoid the `scrollTop` cascade jank
