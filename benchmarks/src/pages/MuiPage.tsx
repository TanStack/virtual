import * as React from 'react'
import { useEffect, useMemo, useRef } from 'react'
import {
  LayoutList,
  useVirtualizer,
  type Virtualizer,
} from '@mui/x-virtualizer'
import {
  markFirstPaint,
  markMountEnd,
  markMountStart,
  registerHarness,
} from '../lib/harness'
import { makeDataset, type Item } from '../lib/dataset'
import type { ScenarioInput } from '../scenarios/types'

interface Props {
  scenario: ScenarioInput
}

// @mui/x-virtualizer is a grid-oriented engine. We adapt it to a single-column
// list by setting columns to its default 1-column placeholder and rendering
// each row as a plain block element. The engine still pays for column /
// dimensions bookkeeping that the other libs don't — see README.

const VirtualizerContext = React.createContext<Virtualizer | null>(null)
const ObserveRowHeightContext = React.createContext<
  ((node: HTMLElement, id: number) => (() => void) | undefined) | null
>(null)

export function MuiPage({ scenario }: Props) {
  const items = useMemo(
    () =>
      makeDataset(
        scenario.count,
        scenario.dynamic,
        scenario.action === 'jump-wide-variance-accuracy',
      ),
    [scenario.count, scenario.dynamic, scenario.action],
  )

  const rows = useMemo(
    () => items.map((it, i) => ({ id: i, model: it })),
    [items],
  )
  const range = useMemo(
    () => ({ firstRowIndex: 0, lastRowIndex: rows.length }),
    [rows.length],
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const refs = useMemo(
    () => ({ container: containerRef, scroller: scrollerRef }),
    [],
  )

  const layoutRef = useRef<LayoutList | null>(null)
  if (layoutRef.current === null) {
    layoutRef.current = new LayoutList(refs)
  }
  const layout = layoutRef.current

  // The virtualizer treats these as dependencies of internal effects (notably
  // dimensions.useRowsMeta), so unstable references trigger an infinite update
  // loop in dynamic mode and React unmounts the tree.
  const dimensions = useMemo(
    () => ({ rowHeight: scenario.itemSize }),
    [scenario.itemSize],
  )
  const virtualization = useMemo(() => ({}), [])
  const getRowHeight = React.useCallback(
    () => 'auto' as const,
    [],
  )
  const renderRow = React.useCallback(
    (params: { id: unknown; rowIndex: number; model: unknown }) => (
      <MuiRow
        key={params.id as number}
        id={params.id as number}
        index={params.rowIndex}
        model={params.model as Item}
        dynamic={scenario.dynamic}
        itemSize={scenario.itemSize}
      />
    ),
    [scenario.dynamic, scenario.itemSize],
  )

  const virtualizer = useVirtualizer({
    layout,
    dimensions,
    virtualization,
    rows,
    range,
    rowCount: rows.length,
    getRowHeight: scenario.dynamic ? getRowHeight : undefined,
    renderRow,
  })

  // virtualizer.api is rebuilt every render, so wrap the observer in a stable
  // callback backed by a ref. Rows depend on this callback in a useEffect — an
  // unstable observer would re-observe every render and storm storeRowHeightMeasurement.
  const apiRef = useRef(virtualizer.api)
  apiRef.current = virtualizer.api
  const observeRowHeight = React.useCallback(
    (node: HTMLElement, id: number) =>
      apiRef.current.rowsMeta.observeRowHeight(node, id),
    [],
  )

  useEffect(() => {
    registerHarness({
      getScrollContainer: () => scrollerRef.current,
      scrollToIndex: (i, opts) => {
        const scroller = scrollerRef.current
        if (!scroller) return
        const state = virtualizer.store.state
        const positions = state.rowsMeta.positions
        const targetTop = positions[i] ?? i * scenario.itemSize
        if (opts?.align === 'end') {
          const entry = state.rowHeights.get(i)
          const rowH = entry?.content ?? scenario.itemSize
          scroller.scrollTop = Math.max(
            0,
            targetTop + rowH - scroller.clientHeight,
          )
        } else {
          scroller.scrollTop = targetTop
        }
      },
      getTotalSize: () =>
        virtualizer.store.state.dimensions.contentSize.height ?? 0,
      isFullyMeasured: () => {
        if (!scenario.dynamic) return true
        // ResizeObserver populates rowHeights as items enter the viewport.
        return virtualizer.store.state.rowHeights.size >= 10
      },
    })
    markMountEnd()
    markFirstPaint()
  }, [virtualizer, scenario.dynamic, scenario.itemSize])

  const containerProps = virtualizer.store.use(
    LayoutList.selectors.containerProps,
  )
  const contentProps = virtualizer.store.use(LayoutList.selectors.contentProps)
  const positionerProps = virtualizer.store.use(
    LayoutList.selectors.positionerProps,
  )

  return (
    <div
      {...containerProps}
      className="scroll-host"
      data-bench-scroll-host="mui-x"
    >
      <div {...contentProps} />
      <div {...positionerProps} />
      <VirtualizerContext.Provider value={virtualizer}>
        <ObserveRowHeightContext.Provider value={observeRowHeight}>
          <MuiListContent />
        </ObserveRowHeightContext.Provider>
      </VirtualizerContext.Provider>
    </div>
  )
}

const MuiListContent = React.memo(function MuiListContent() {
  const virtualizer = React.useContext(VirtualizerContext)!
  const { getRows } = virtualizer.api.getters
  return <>{getRows()}</>
})

interface RowProps {
  id: number
  index: number
  model: Item
  dynamic: boolean
  itemSize: number
}

function MuiRow({ id, index, model, dynamic, itemSize }: RowProps) {
  const observeRowHeight = React.useContext(ObserveRowHeightContext)
  const nodeRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!dynamic || !nodeRef.current || !observeRowHeight) return undefined
    return observeRowHeight(nodeRef.current, id)
  }, [observeRowHeight, dynamic, id])
  return (
    <div
      ref={nodeRef}
      data-index={index}
      className={'item ' + (index % 2 === 0 ? 'even' : '')}
      style={{ minHeight: dynamic ? undefined : itemSize }}
    >
      {model.text}
    </div>
  )
}

export function MuiPageRoot({ scenario }: Props) {
  markMountStart()
  return <MuiPage scenario={scenario} />
}
