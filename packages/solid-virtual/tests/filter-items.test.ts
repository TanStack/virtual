import { expect, test } from 'vitest'
import { createRoot, createSignal } from 'solid-js'

import { createVirtualizer } from '../src/index'

test('virtual items correctly index into filtered data after reactive shrink', () => {
  createRoot((dispose) => {
    const all = ['apple', 'banana', 'cherry', 'date', 'fig', 'grape']
    const [query, setQuery] = createSignal('')

    const filtered = () => {
      const q = query()
      if (!q) return all
      return all.filter(s => s.includes(q))
    }

    const virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
      get count() {
        return filtered().length
      },
      getScrollElement: () => null,
      estimateSize: () => 60,
      initialRect: { width: 800, height: 600 },
    })

    expect(virtualizer.getVirtualItems().length).toBe(6)
    expect(virtualizer.getVirtualItems().map(v => filtered()[v.index]))
      .toEqual(['apple', 'banana', 'cherry', 'date', 'fig', 'grape'])

    setQuery('e')

    expect(virtualizer.getVirtualItems().length).toBe(4)
    const items = virtualizer.getVirtualItems()
    expect(items.map(v => filtered()[v.index]))
      .toEqual(['apple', 'cherry', 'date', 'grape'])

    setQuery('zz')

    expect(virtualizer.getVirtualItems().length).toBe(0)
    expect(virtualizer.getVirtualItems().map(v => filtered()[v.index]))
      .toEqual([])

    setQuery('cherry')

    expect(virtualizer.getVirtualItems().length).toBe(1)
    expect(virtualizer.getVirtualItems().map(v => filtered()[v.index]))
      .toEqual(['cherry'])

    dispose()
  })
})
