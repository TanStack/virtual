// Exact reproduction of #1266, adapted from PR #1265 by @tigerBeA: an
// end-anchored direct-DOM chat where a row ABOVE the last one grows. The last
// row is exactly the viewport height and keeps its size, so its overflow cannot
// extend the scroll range before the sizer is updated, and with `useFlushSync:
// false` and an unchanged range nothing re-renders after the resize.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'

const VIEWPORT_HEIGHT = 300
const initialMessages = Array.from({ length: 8 }, (_, index) => ({
  id: `m-${index}`,
  height: index === 7 ? VIEWPORT_HEIGHT : 50,
}))

function App() {
  const [messages, setMessages] = React.useState(initialMessages)
  const parentRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => messages[index]!.id,
    estimateSize: (index) => initialMessages[index]!.height,
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: 4,
    overscan: 4,
    directDomUpdates: true,
    useFlushSync: false,
  })

  React.useLayoutEffect(() => {
    virtualizer.scrollToEnd()
  }, [virtualizer])

  return (
    <div>
      <button
        id="grow-previous"
        onClick={() => {
          setMessages((current) =>
            current.map((message, index) =>
              index === current.length - 2
                ? { ...message, height: message.height + 24 }
                : message,
            ),
          )
        }}
      >
        Grow previous
      </button>
      <div
        ref={parentRef}
        id="scroll-container"
        style={{
          height: VIEWPORT_HEIGHT,
          width: 420,
          overflow: 'auto',
          overflowAnchor: 'none',
        }}
      >
        <div
          ref={virtualizer.containerRef}
          style={{ position: 'relative', width: '100%' }}
        >
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
              }}
            >
              <div style={{ height: messages[item.index]!.height }}>
                Message {messages[item.index]!.id}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
