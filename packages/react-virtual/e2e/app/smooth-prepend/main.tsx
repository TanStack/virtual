import React from 'react'
import { createRoot } from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'

// End-anchored list built for one scenario: a long smooth scrollToIndex that is
// still in flight when history is prepended. The list is deliberately tall
// (200 x 50px against a 300px viewport) so the animation lasts long enough for
// the test to reliably observe it mid-flight and prepend into that window.

type Message = {
  id: string
  text: string
}

const makeMessage = (index: number): Message => ({
  id: `m-${index}`,
  text: `Message ${index}`,
})

const initialMessages = Array.from({ length: 200 }, (_, index) =>
  makeMessage(index),
)

function App() {
  const [messages, setMessages] = React.useState(initialMessages)
  const [didInitialScroll, setDidInitialScroll] = React.useState(false)
  const parentRef = React.useRef<HTMLDivElement>(null)
  const firstMessageIndexRef = React.useRef(0)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    getItemKey: (index) => messages[index]!.id,
    anchorTo: 'end',
    followOnAppend: true,
    overscan: 4,
  })

  React.useLayoutEffect(() => {
    if (didInitialScroll) return
    virtualizer.scrollToEnd()
    setDidInitialScroll(true)
  }, [didInitialScroll, virtualizer])

  return (
    <div>
      <button
        id="smooth-to-0"
        onClick={() => virtualizer.scrollToIndex(0, { behavior: 'smooth' })}
      >
        Smooth to 0
      </button>
      <button
        id="prepend"
        onClick={() => {
          const start = firstMessageIndexRef.current - 5
          firstMessageIndexRef.current = start
          setMessages((current) => [
            ...Array.from({ length: 5 }, (_, offset) =>
              makeMessage(start + offset),
            ),
            ...current,
          ])
        }}
      >
        Prepend
      </button>

      <div
        ref={parentRef}
        id="scroll-container"
        style={{
          height: 300,
          overflow: 'auto',
          width: 420,
          border: '1px solid #ddd',
        }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const message = messages[item.index]!

            return (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={item.index}
                data-message-id={message.id}
                data-testid={`message-${message.id}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `translateY(${item.start}px)`,
                  width: '100%',
                }}
              >
                <div
                  style={{
                    boxSizing: 'border-box',
                    height: 50,
                    padding: 8,
                    borderBottom: '1px solid #eee',
                  }}
                >
                  {message.text}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
