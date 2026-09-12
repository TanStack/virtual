import { expect, test, vi } from 'vitest'
import { For } from 'solid-js'
import { render } from 'solid-js/web'

import { createVirtualizer } from '../src/index'
import type { Virtualizer } from '../src/index'

const ROW = 50
const TALL_ROW = 5000
const VIEWPORT = 200
const COUNT = 200

// A row measures itself from its ref, which shrinks the rendered range while
// <For> is still iterating the store. The ref writes `data-index` first
// because Solid runs refs before it applies reactive attributes (#930).
function renderList(container: HTMLElement) {
  const rowsRendered: Array<number> = []
  let virtualizer!: Virtualizer<HTMLDivElement, HTMLDivElement>
  let scrollEl!: HTMLDivElement

  function List() {
    virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
      count: COUNT,
      getScrollElement: () => scrollEl,
      estimateSize: () => ROW,
      initialRect: { width: VIEWPORT, height: VIEWPORT },
      observeElementRect: (_, cb) => {
        cb({ width: VIEWPORT, height: VIEWPORT })
        return () => {}
      },
      observeElementOffset: (_, cb) => {
        cb(0, false)
        return () => {}
      },
      // jsdom has no layout; the oversized first row is what shrinks the range.
      measureElement: (el) =>
        el.getAttribute('data-index') === '0' ? TALL_ROW : ROW,
    })

    return (
      <div ref={scrollEl} style={{ height: `${VIEWPORT}px`, overflow: 'auto' }}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
        >
          <For each={virtualizer.getVirtualItems()}>
            {(item) => {
              // Unguarded on purpose: a hole in the array throws here.
              const index = item.index
              rowsRendered.push(index)
              return (
                <div
                  data-index={index}
                  ref={(el) => {
                    el.dataset.index = String(index)
                    virtualizer.measureElement(el)
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  Row {index}
                </div>
              )
            }}
          </For>
        </div>
      </div>
    )
  }

  const dispose = render(() => <List />, container)
  return { dispose, rowsRendered, virtualizer: virtualizer! }
}

const renderedIndexes = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-index]')).map(
    (el) => Number(el.dataset.index),
  )

test('measuring a row from its ref does not corrupt the <For> pass', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const container = document.createElement('div')
  document.body.appendChild(container)

  const { dispose, rowsRendered, virtualizer } = renderList(container)

  const initial = renderedIndexes(container)
  expect(initial.length).toBeGreaterThan(2)
  expect(rowsRendered).toEqual(initial)
  // The measurement was taken (data-index was readable), just not applied yet.
  expect(warn).not.toHaveBeenCalled()
  expect(virtualizer.itemSizeCache.get(0)).toBe(TALL_ROW)

  await Promise.resolve()

  const settled = renderedIndexes(container)
  expect(settled.length).toBeLessThan(initial.length)
  expect(settled).toEqual(virtualizer.getVirtualItems().map((i) => i.index))
  expect(virtualizer.getTotalSize()).toBe(TALL_ROW + (COUNT - 1) * ROW)

  dispose()
  container.remove()
  warn.mockRestore()
})
