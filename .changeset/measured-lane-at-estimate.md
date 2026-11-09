---
'@tanstack/virtual-core': patch
---

Keep the lane of a row measured at exactly its estimate in `laneAssignmentMode: 'measured'`. Such a row never had its lane cached, so a row growing above it could move it to another lane.
