---
'@tanstack/virtual-core': patch
---

fix(virtual-core): scroll commands and corrections that stalled or were lost (#1307)

- On iOS 27 and later a `scrollTop` write no longer stops a fling but is overridden by it within a frame. A `scrollToIndex`, `scrollToOffset` or `scrollToEnd` issued during a fling now waits for the fling to end instead of being lost. The user taking over before then cancels it: a drag, a second flick, or a finger stopping the fling (iOS reports none of these with touch events while the fling runs). Corrections keep being held through the gesture as on every version.
- `scrollToOffset` / `scrollBy`: a row above the viewport growing after the write's read-back moved the element off the fixed target, and the command kept reconciling until the 5s safety valve. The target now moves with the correction.
- A prepend (`anchorTo: 'end'`) before the read-back of a scroll command was anchored against the stale offset and written over the command. It is now left to reconcile, like a resize in that window.
- A scroll event between the prepend's options change and the adapter's commit no longer loses the anchor (one blank frame when the element could not be written by commit time).
- A command's write clamped by a sizer that shrank below it before the read-back no longer reads as a user scroll; the command reaches its fresh target.
