# Chat + Pretext example — browser tests

In the monorepo: install at the repo root as usual (`pnpm install` — the workspace
brings in this example's `@playwright/test` and `@chenglou/pretext` too). Then, from
this directory (examples/marko/chat-pretext):

    npx playwright install chromium   # one-time browser download
    npm run test:e2e                  # starts the dev server itself, runs 9 tests, tears down

Standalone (this folder copied out of the monorepo): run `pnpm install` (or
`npm install`) inside the folder first, then the same two commands.

The suite carries the Chat example's seven scroll-behavior gates (calculated heights
must not regress any of them) plus this example's two headline assertions: prepending
history produces NO measurement-correction kick (at most the single intended anchor
compensation), and the streamed reply's growth is delivered through v.resizeItem with
a calculated height that matches the rendered DOM within a pixel.
