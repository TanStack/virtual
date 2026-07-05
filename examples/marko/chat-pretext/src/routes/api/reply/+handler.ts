import type { HandlerLike } from '@marko/run'

// Streams an assistant reply as plain-text chunks, the way an LLM API would.
// The response body is a ReadableStream; each chunk is flushed as it is enqueued,
// so the client receives (and renders) the reply progressively over one request.

const CHUNKS = [
  'Thinking through the failure mode.',
  ' The list should follow only when it was already pinned.',
  ' Prepends should keep the reader anchored to the same message.',
  ' Streaming output should grow without drifting off the bottom.',
]

const CHUNK_INTERVAL_MS = 280

export const POST: HandlerLike = async (context) => {
  // The prompt is accepted (and could shape the reply); this demo reply is fixed.
  await context.request.text()

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of CHUNKS) {
        controller.enqueue(encoder.encode(chunk))
        await new Promise((resolve) => setTimeout(resolve, CHUNK_INTERVAL_MS))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
