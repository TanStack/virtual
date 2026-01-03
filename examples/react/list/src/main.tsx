import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { faker } from '@faker-js/faker'
import { useVirtualizer } from '@tanstack/react-virtual'

import './index.css'

type SizingMode = 'dynamic' | 'fixed' | 'variable'

const randomNumber = (min: number, max: number) =>
  faker.number.int({ min, max })

// Generate data for the list
const sentences = new Array(10000)
  .fill(true)
  .map(() => faker.lorem.sentence(randomNumber(20, 70)))

// Pre-computed variable sizes for "variable" mode
const variableSizes = new Array(10000)
  .fill(true)
  .map(() => 25 + Math.round(Math.random() * 100))

function List() {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [sizingMode, setSizingMode] = React.useState<SizingMode>('dynamic')

  const count = sentences.length

  // Configure virtualizer based on sizing mode
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: React.useCallback(
      (index: number) => {
        switch (sizingMode) {
          case 'fixed':
            return 35
          case 'variable':
            return variableSizes[index]
          case 'dynamic':
          default:
            return 45
        }
      },
      [sizingMode],
    ),
    overscan: 5,
  })

  const items = virtualizer.getVirtualItems()

  // For dynamic mode, we need to measure elements
  const measureElement = sizingMode === 'dynamic' ? virtualizer.measureElement : undefined

  return (
    <div>
      <div className="controls">
        <div className="mode-selector">
          <strong>Sizing Mode:</strong>
          {(['dynamic', 'fixed', 'variable'] as const).map((mode) => (
            <label key={mode}>
              <input
                type="radio"
                name="sizingMode"
                value={mode}
                checked={sizingMode === mode}
                onChange={() => setSizingMode(mode)}
                style={{ display: 'none' }}
              />
              <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="controls">
        <button onClick={() => virtualizer.scrollToIndex(0)}>
          Scroll to top
        </button>
        <button onClick={() => virtualizer.scrollToIndex(Math.floor(count / 2))}>
          Scroll to middle
        </button>
        <button onClick={() => virtualizer.scrollToIndex(count - 1)}>
          Scroll to end
        </button>
      </div>

      <p style={{ fontSize: '12px', color: '#666' }}>
        {sizingMode === 'dynamic' && (
          <>
            <strong>Dynamic mode:</strong> Each item's height is measured at render time.
            Content can vary and the virtualizer adapts automatically.
          </>
        )}
        {sizingMode === 'fixed' && (
          <>
            <strong>Fixed mode:</strong> All items have the same fixed height (35px).
            Best performance, use when all items are identical height.
          </>
        )}
        {sizingMode === 'variable' && (
          <>
            <strong>Variable mode:</strong> Each item has a known but different height.
            Heights are pre-computed, not measured at runtime.
          </>
        )}
      </p>

      <div
        ref={parentRef}
        className="List"
        style={{
          height: 400,
          width: '100%',
          maxWidth: 600,
          overflowY: 'auto',
          contain: 'strict',
        }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${items[0]?.start ?? 0}px)`,
            }}
          >
            {items.map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={measureElement}
                className={
                  virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'
                }
                style={
                  sizingMode === 'dynamic'
                    ? undefined
                    : {
                        height:
                          sizingMode === 'fixed'
                            ? 35
                            : variableSizes[virtualRow.index],
                      }
                }
              >
                {sizingMode === 'dynamic' ? (
                  <div style={{ padding: '10px' }}>
                    <div>Row {virtualRow.index}</div>
                    <div>{sentences[virtualRow.index]}</div>
                  </div>
                ) : (
                  <div>Row {virtualRow.index}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p style={{ marginTop: '1rem', fontSize: '12px', color: '#666' }}>
        Rendering {items.length} of {count.toLocaleString()} items
      </p>
    </div>
  )
}

function App() {
  return (
    <div>
      <h1>List Virtualization</h1>
      <p>
        Efficiently render large vertical lists by only rendering visible items.
        Try different sizing modes to see how they affect behavior.
      </p>
      <List />
      {process.env.NODE_ENV === 'development' && (
        <p style={{ marginTop: '2rem', fontSize: '12px', color: '#999' }}>
          <strong>Note:</strong> Running in development mode. Performance will
          improve in production builds.
        </p>
      )}
    </div>
  )
}

const container = document.getElementById('root')!
const root = createRoot(container)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
