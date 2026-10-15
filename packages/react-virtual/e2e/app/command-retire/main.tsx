import React from 'react'
import ReactDOM from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'

// Scroll commands that must finish without the user's help (#1307 step 5,
// #1310):
// - `index-shrink`: scrollToIndex, then rows above the target shrink in the
//   same click handler. The re-render shrinks the sizer before the scroll
//   event, so the browser clamps the write; the command must still land on
//   the fresh target.
// - scrollToOffset, then a row above grows as its read-back arrives (driven
//   from the spec through `window.__v`). The compensation moves the element
//   past the target; the command must retire rather than reconcile until the
//   5s safety valve.

const COUNT = 100
const EST = 50

const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [sizes, setSizes] = React.useState(() =>
    Array.from({ length: COUNT }, () => EST),
  )

  const virtualizer = useVirtualizer({
    count: COUNT,
    getScrollElement: () => parentRef.current,
    estimateSize: () => EST,
    overscan: 2,
  })
  ;(window as any).__v = virtualizer

  return (
    <div>
      <button
        data-testid="index-shrink"
        onClick={() => {
          virtualizer.scrollToIndex(90, { align: 'start' })
          // Rows 0–19 shrink to 20px, measured in this handler.
          for (let i = 0; i < 20; i++) virtualizer.resizeItem(i, 20)
          setSizes((s) => s.map((size, i) => (i < 20 ? 20 : size)))
        }}
      >
        index + shrink
      </button>
      <div
        ref={parentRef}
        data-testid="scroll-container"
        style={{ height: 400, overflow: 'auto' }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${item.start}px)`,
              }}
            >
              <div style={{ height: sizes[item.index] }}>Row {item.index}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
