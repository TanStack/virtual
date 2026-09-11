---
'@tanstack/virtual-core': patch
---

Keep a travelling smooth `scrollToIndex` alive when content is prepended. With `anchorTo: 'end'`, the prepend anchor sync wrote `scrollTop` instantly, which cancelled the browser's smooth animation and left the scroll stranded partway; Chromium drops a smooth request re-issued right after such a cancel, so it could not be resumed. The sync is now skipped while a smooth programmatic scroll is still in flight, and the animation continues to its recomputed target. A smooth scroll that has already landed still receives the anchor sync.
