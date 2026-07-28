---
'@tanstack/marko-virtual': patch
---

Stop publishing the tags build's incremental state: `marko-type-check` writes
`dist/tsconfig.tags.tsbuildinfo`, which the `files` field shipped to npm and nx
cached as part of `dist`. Because `@marko/type-check` always runs incrementally, a
`dist` that carried that file but not `dist/tags` (which `marko.json` points at)
made every subsequent build a silent no-op — exit 0, nothing emitted — and any
consumer then failed to compile with
`ENOENT: no such file or directory, scandir '.../dist/tags'`. The build now removes
the file after emitting, so a build always produces `dist/tags`.
