---
'@tanstack/virtual-core': patch
---

Fix wheel and trackpad scrolling in WebKit losing distance, or the reader's place, when rows are measured or prepended on the way. Scroll corrections are now held while wheel input drives the scroll and written when it rests, or when the element reaches either edge.
