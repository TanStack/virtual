import { beforeEach, expect, test } from 'vitest'
import { For, Suspense, createResource } from 'solid-js'
import { render } from 'solid-js/web'

import { createVirtualizer } from '../src/index'

beforeEach(() => {
  Object.defineProperties(HTMLElement.prototype, {
    clientHeight: {
      configurable: true,
      get: () => 200,
    },
  })
})

test('renders rows once a suspended list resolves', async () => {
  let resolve!: (count: number) => void
  const pending = new Promise<number>((r) => (resolve = r))

  function List() {
    const [count] = createResource(() => pending)
    let parentRef!: HTMLDivElement

    const virtualizer = createVirtualizer({
      get count() {
        return count() ?? 0
      },
      getScrollElement: () => parentRef,
      estimateSize: () => 50,
      overscan: 0,
    })

    return (
      <div ref={parentRef}>
        <For each={virtualizer.getVirtualItems()}>
          {(row) => <div>Row {row.index}</div>}
        </For>
      </div>
    )
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const dispose = render(
    () => (
      <Suspense fallback="Loading...">
        <List />
      </Suspense>
    ),
    container,
  )

  expect(container.textContent).toBe('Loading...')

  resolve(100)
  await pending
  await Promise.resolve()

  expect(
    Array.from(container.firstElementChild!.children, (el) => el.textContent),
  ).toEqual(['Row 0', 'Row 1', 'Row 2', 'Row 3'])

  dispose()
  container.remove()
})
