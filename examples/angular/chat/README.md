# TanStack Virtual Angular Chat Example

Demonstrates end-anchored virtualization for chat-style UIs:

- starts at the newest message
- keeps the visible message stable when older history is prepended
- follows appended messages only while the reader is already at the end
- remains pinned while a dynamically measured reply streams in

Run it from the repository root with:

```sh
pnpm --filter @tanstack/virtual-example-angular-chat start
```
