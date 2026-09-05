---
'@tanstack/lit-virtual': minor
---

Re-export `@tanstack/virtual-core` from `@tanstack/lit-virtual`, so the core API (`Virtualizer`, `defaultRangeExtractor`, `measureElement`, the scroll observers and the shared types) can be imported from the adapter without adding `@tanstack/virtual-core` as a second dependency. Every other framework adapter already does this.
