---
'@tanstack/marko-virtual': minor
---

Post-release follow-ups for the Marko adapter: full option parity for both tags
(scrollMargin, enabled, isRtl, isScrollingResetDelay, useScrollendEvent,
useAnimationFrameWithResizeObserver, laneAssignmentMode, useCachedMeasurements,
debug, custom measureElement; window tag adds horizontal and initialOffset),
named handle types (VirtualizerHandle / WindowVirtualizerHandle) whose .d.marko
declarations are generated into dist/tags at build time (via marko-type-check)
and type-checked in CI, a new Chat + Pretext example (calculated row heights via
@chenglou/pretext; streamed replies grow through resizeItem), browser e2e suites
for every example plus option-gate behavioral proofs, TypeScript-strict cleanups
across examples, and chat example improvements (accurate size estimate,
load-ahead history trigger, overflow-anchor handling).
