# TanStack Virtual React Chat Example

Demonstrates end-anchored virtualization for chat-style UIs:

- starts at the latest message
- keeps the visible message stable when older history is prepended
- follows appended output only when the viewport is already at the latest message
- keeps streaming bottom output pinned as the last row grows

The UI is a simple ChatGPT-style layout: a sidebar with chat history and a
message pane with a composer. Data comes from an in-memory mock API
(`src/api.ts`) through TanStack Query, and assistant replies are generated and
streamed word by word, so the example needs no server or API key.

```bash
npm install
npm run dev
```
