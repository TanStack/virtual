import React from 'react'
import ReactDOM from 'react-dom/client'
import { useVirtualizerSnapshot } from '@tanstack/react-virtual'

const ITEM_SIZE = 40
const COUNT = 1000

/**
 * Regression page for https://github.com/TanStack/virtual/issues/736 using
 * `useVirtualizerSnapshot` under React Compiler.
 *
 * Unlike `useVirtualizer` — which the compiler skips as a known-incompatible
 * API — components calling the snapshot hook ARE compiled. The snapshot's
 * identity changes whenever the computed items change, so the compiler's
 * memoized output stays fresh: item-500 must appear after scrolling. This
 * page must stay free of patterns that make the compiler bail (no ref
 * mutation during render, etc.), or it silently stops guarding the compiled
 * path.
 */
const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const { virtualItems, totalSize, virtualizer } = useVirtualizerSnapshot({
    count: COUNT,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_SIZE,
    overscan: 2,
  })

  // Commit counter for the spec, kept outside React-managed content so the
  // component stays compiler-clean (no ref/global mutation during render).
  const commitCountRef = React.useRef(0)
  React.useEffect(() => {
    commitCountRef.current += 1
    const el = document.getElementById('commit-count')
    if (el) el.textContent = String(commitCountRef.current)
  })

  return (
    <div>
      <div id="commit-count" data-testid="commit-count" />
      <button id="scroll-to-500" onClick={() => virtualizer.scrollToIndex(500)}>
        Scroll to 500
      </button>

      <div
        ref={parentRef}
        id="scroll-container"
        style={{ height: 400, overflow: 'auto' }}
      >
        <div
          id="inner"
          style={{
            position: 'relative',
            width: '100%',
            height: totalSize,
          }}
        >
          {virtualItems.map((v) => (
            <div
              key={v.key}
              data-testid={`item-${v.index}`}
              ref={virtualizer.measureElement}
              data-index={v.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ITEM_SIZE,
                transform: `translateY(${v.start}px)`,
              }}
            >
              Row {v.index}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
