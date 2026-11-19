import React from 'react'
import ReactDOM from 'react-dom/client'
import { useVirtualizer, useVirtualizerState } from '@tanstack/react-virtual'

const ITEM_SIZE = 40
const COUNT = 1000

/**
 * Regression test for https://github.com/TanStack/virtual/issues/736
 *
 * React Compiler caches `virtualizer.getVirtualItems()` because the
 * virtualizer reference is stable, so virtual items never update on scroll.
 * Enabling `directDomUpdates` solves this: item positions are written
 * directly to the DOM, and React only re-renders when the visible index
 * range changes.
 */
const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const params = new URLSearchParams(window.location.search)
  const mode = (params.get('mode') ?? 'transform') as 'position' | 'transform'
  const directDom = params.get('directDomUpdates') !== 'false'

  const renderCount = React.useRef(0)
  renderCount.current += 1

  const rowVirtualizer = useVirtualizer({
    count: COUNT,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_SIZE,
    overscan: 2,
    directDomUpdates: directDom,
    directDomUpdatesMode: mode,
  })

  return (
    <div>
      <div data-testid="render-count">{renderCount.current}</div>
      <div data-testid="mode">{mode}</div>
      <div data-testid="direct-dom">{String(directDom)}</div>
      <button
        id="scroll-to-500"
        onClick={() => rowVirtualizer.scrollToIndex(500)}
      >
        Scroll to 500
      </button>

      <div
        ref={parentRef}
        id="scroll-container"
        style={{ height: 400, overflow: 'auto' }}
      >
        <div
          ref={directDom ? rowVirtualizer.containerRef : undefined}
          id="inner"
          style={{
            position: 'relative',
            width: '100%',
            ...(directDom ? {} : { height: rowVirtualizer.getTotalSize() }),
          }}
        >
          {rowVirtualizer.getVirtualItems().map((v) => (
            <div
              key={v.key}
              data-testid={`item-${v.index}`}
              ref={rowVirtualizer.measureElement}
              data-index={v.index}
              style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                height: ITEM_SIZE,
                ...(directDom
                  ? mode === 'transform'
                    ? { top: 0 }
                    : {}
                  : { top: 0, transform: `translateY(${v.start}px)` }),
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

/**
 * React Compiler skips any component that calls `useVirtualizer` (it is on the
 * compiler's list of known-incompatible APIs), but it does compile components
 * the virtualizer is passed to. `Rows` is such a component: reading
 * `virtualizer.getVirtualItems()` there is memoised on the stable instance
 * and goes stale (`?api=instance`), while `useVirtualizerState` stays live
 * (`?api=state`).
 */
type RowsProps = {
  virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, HTMLDivElement>>
}

const StateRows = ({ virtualizer }: RowsProps) => {
  const { virtualItems, totalSize } = useVirtualizerState(virtualizer)
  return (
    <RowList
      virtualizer={virtualizer}
      items={virtualItems}
      totalSize={totalSize}
    />
  )
}

const InstanceRows = ({ virtualizer }: RowsProps) => {
  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()
  return (
    <RowList
      virtualizer={virtualizer}
      items={virtualItems}
      totalSize={totalSize}
    />
  )
}

const RowList = ({
  virtualizer,
  items,
  totalSize,
}: RowsProps & {
  items: ReturnType<RowsProps['virtualizer']['getVirtualItems']>
  totalSize: number
}) => (
  <div
    id="inner"
    style={{ position: 'relative', width: '100%', height: totalSize }}
  >
    {items.map((v) => (
      <div
        key={v.key}
        data-testid={`item-${v.index}`}
        data-index={v.index}
        ref={virtualizer.measureElement}
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
)

const StateApp = ({ api }: { api: 'state' | 'instance' }) => {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: COUNT,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_SIZE,
    overscan: 2,
  })

  const Rows = api === 'state' ? StateRows : InstanceRows

  return (
    <div>
      <button
        id="scroll-to-500"
        onClick={() => rowVirtualizer.scrollToIndex(500)}
      >
        Scroll to 500
      </button>

      <div
        ref={parentRef}
        id="scroll-container"
        style={{ height: 400, overflow: 'auto' }}
      >
        <Rows virtualizer={rowVirtualizer} />
      </div>
    </div>
  )
}

const api = new URLSearchParams(window.location.search).get('api')

ReactDOM.createRoot(document.getElementById('root')!).render(
  api === 'state' || api === 'instance' ? <StateApp api={api} /> : <App />,
)
