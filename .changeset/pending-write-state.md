---
'@tanstack/virtual-core': patch
---

refactor(virtual-core): track a scroll write until its read-back as one record instead of three fields (no behaviour change); `scrollAdjustments` becomes a read-only getter with the same value
