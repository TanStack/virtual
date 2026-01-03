---
'@tanstack/virtual-core': patch
---

fix(virtual-core): improve scrollToIndex reliability in dynamic mode

- Wait extra frame for ResizeObserver measurements before verifying position
- Abort pending scroll operations when new scrollToIndex is called
  
