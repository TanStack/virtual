---
'@tanstack/virtual-core': minor
---

Add end-anchored virtualization support for chat, logs, and reverse feeds.

New `anchorTo: 'end'` mode keeps the current visible item stable when older items are prepended, while preserving the existing start-anchored behavior by default. It also keeps an end-pinned viewport pinned when the last item grows during streaming output.

Add `followOnAppend` so new items scroll into view only when the viewport was already at the end, plus `scrollEndThreshold`, `scrollToEnd()`, `getDistanceFromEnd()`, and `isAtEnd()` helpers for chat-style integrations.
