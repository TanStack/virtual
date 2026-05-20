---
'@tanstack/virtual-core': minor
---

iOS Safari momentum-scroll handling. Writing `scrollTop` while a finger
is on the screen, during momentum decay, or while the page is in the
elastic-overscroll bounce zone all cancel the in-flight scroll in iOS
WebKit. The virtualizer previously had no iOS-specific handling, which
manifested as the recurring "scroll abruptly stops when content above
resizes" complaints on Safari mobile.

Adds three layers of protection, default-on, all transparent to
consumers:

- **Touch event distinction.** A touchstart→touchend window plus a
  150 ms grace timer for the early-momentum phase. Scroll-position
  adjustments triggered during any of these states accumulate into a
  `_iosDeferredAdjustment` field instead of writing `scrollTop`.
- **Subpixel reconciliation.** When the browser reports back a rounded
  `scrollTop` within 1.5 px of a value we just wrote, the virtualizer
  prefers the intended value rather than treating the round-trip as a
  user scroll.
- **Elastic-overscroll clamp.** The deferred-adjustment flush is skipped
  when `scrollTop` is outside `[0, scrollHeight - clientHeight]`,
  preventing a snap-back jolt at end-of-bounce. The next in-bounds
  scroll event retries.

Non-iOS code paths are unchanged. iOS detection is SSR-safe and cached
after first call. Bundle cost is ~370 B gzip in the consumer-minified
production build — kept default-on because iOS Safari is a large share
of mobile traffic for the apps that use virtualization heavily.
