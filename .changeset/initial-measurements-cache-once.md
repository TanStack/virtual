---
'@tanstack/virtual-core': patch
---

Apply `initialMeasurementsCache` only once. A list whose `count` went to 0 and back re-applied the snapshot's sizes over the sizes its rows had been measured at since mount.
