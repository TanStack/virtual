---
'@tanstack/virtual-core': patch
---

refactor(virtual-core): simplify the scroll-correction state (no behaviour change)

- A scroll event is classified once (spurious re-emit, our own write's read-back, a clamped read-back or echo, or external) before the handler acts on it, a scroll command waiting for the iOS 27 momentum tail is a phase of its own, and the iOS touch gesture tracks a single `moved` flag.
- `scrollAdjustments` is deprecated: a correction is folded into `scrollOffset` at once, so it is always 0. Read `scrollOffset` alone; the getter stays.
- One edge case changes: corrections made while `enabled: false` used to accumulate, and a correction made after re-enabling but before the next update was added on top of them. They are no longer carried over.
