---
'@tanstack/virtual-core': minor
---

Skip the scroll-position adjustment while the user is scrolling backward
by default. When an above-viewport item resizes during backward scroll
(images load, content reflows, etc.) the prior behavior wrote `scrollTop`
to keep the visible window stable — but on backward scroll that write
fights the user's direction and produces visible "items jump up while I
scroll up" jank. This was the largest single complaint cluster in the
issue tracker (multiple recurring threads spanning years; users had
independently rediscovered the same workaround at least five times).

Forward-scroll and idle (mount-time) adjustments still fire as before
to preserve visual stability of the visible window. Consumers who want
the old behavior — adjusting on every above-viewport resize regardless
of direction — can supply `shouldAdjustScrollPositionOnItemSizeChange`
which is checked before the default branch.
