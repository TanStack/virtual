---
'@tanstack/virtual-core': patch
---

fix(virtual-core): keep an instant scroll command clamped at a max the sizer committed outside a row resize

Before an instant scroll command's write is reported, the browser can clamp it at a smaller scroll max that the sizer moves to without a row resize: an append or prepend, `measure()`, or a resize the sizer had not committed when the command was written. The virtualizer now also records the max at each commit, so such an event is read as its own clamped write and the command lands. A clamped write reported with `isScrolling` false is now written again too.
