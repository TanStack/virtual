---
'@tanstack/virtual-core': patch
---

`scrollToIndex(N, { behavior: 'smooth' })` on a dynamic-height list no
longer snaps to `behavior: 'auto'` the moment a measurement shifts the
computed target offset. While the scroll is still more than a viewport
away from the new target, smooth scroll continues with the updated
endpoint; only on the final approach do we fall back to 'auto' for
precise landing. The user-visible effect is one continuous smooth
motion that subtly adjusts its endpoint as measurements arrive,
instead of the prior animation-then-snap pattern.

Also: once `reconcileScroll` reaches its stable-frames threshold, it
writes the exact target offset one final time. This is a no-op when
`scrollTop` already equals the target (the common case) but corrects
the rare subpixel-rounding case where smooth scroll undershoots by
less than 1 px.
