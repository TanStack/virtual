---
'@tanstack/virtual-core': patch
'@tanstack/marko-virtual': patch
---

Keep an end-anchored Marko list at the bottom when a prepend lands right after `scrollToEnd()`. The prepend's anchor write is made before Marko commits the grown sizer, so the browser clamped it to the old end; core now records that clamp and the Marko tags retry the write once the new total size is rendered.
