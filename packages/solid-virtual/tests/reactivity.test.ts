import { describe, expect, it } from 'vitest'
import { createRoot, createSignal } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { createVirtualizer } from '../src/index'

describe('reactivity: unaffected slots keep stable references', () => {
  it('does not recreate VirtualItem objects for slots whose data did not change', () => {
    createRoot((dispose) => {
      const data = Array.from({ length: 50 }, (_, i) => `item-${i}`)
      const [filtered, setFiltered] = createSignal(data)

      const virtualizer = createVirtualizer({
        get count() {
          return filtered().length
        },
        getScrollElement: () => document.createElement('div'),
        estimateSize: () => 30,
        overscan: 0,
      })

      const before = virtualizer.getVirtualItems()
      const beforeRefs = before.map((item) => unwrap(item))

      // Shrink the array; leaves the first visible rows' index/start/end/size untouched.
      setFiltered(data.slice(0, 40))

      const after = virtualizer.getVirtualItems()
      const afterRefs = after.map((item) => unwrap(item))

      const unaffectedCount = Math.min(beforeRefs.length, afterRefs.length)
      for (let i = 0; i < unaffectedCount; i++) {
        if (
          beforeRefs[i].start === afterRefs[i].start &&
          beforeRefs[i].end === afterRefs[i].end &&
          beforeRefs[i].index === afterRefs[i].index
        ) {
          expect(afterRefs[i]).toBe(beforeRefs[i])
        }
      }

      dispose()
    })
  })
})
