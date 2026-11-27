---
'@tanstack/virtual-core': patch
---

Fix wheel scrolling in WebKit losing distance, or the reader's place, when rows are measured or prepended on the way. Scroll corrections are now held for 150ms after a wheel event and written when the wheel rests, or when the element reaches the top of the list.
