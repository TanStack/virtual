---
'@tanstack/virtual-core': patch
---

Keep the reading anchor when only `paddingStart` or `scrollMargin` changes under `anchorTo: 'end'`. Content above the items living in the padding (for example a chat's "load earlier messages" header) no longer shifts the reader's rows when its own height changes.
