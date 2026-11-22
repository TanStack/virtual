import '@testing-library/jest-dom/vitest'
import * as React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useVirtualizer } from '../src/index'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>()
  return { ...actual, useReducer: vi.fn(actual.useReducer) }
})

test.each([true, false])(
  'keeps rendering after a DevTools no-op dispatch (useFlushSync: %s)',
  async (useFlushSync) => {
    function List() {
      const parentRef = React.useRef<HTMLDivElement>(null)
      const virtualizer = useVirtualizer({
        count: 200,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 50,
        initialRect: { height: 200, width: 200 },
        observeElementRect: () => undefined,
        useFlushSync,
      })

      return (
        <div ref={parentRef} data-testid="scroller">
          {virtualizer.getVirtualItems().map((item) => (
            <div key={item.key}>Row {item.index}</div>
          ))}
        </div>
      )
    }

    const { rerender } = render(<List />)
    expect(screen.getByText('Row 0')).toBeInTheDocument()

    // Regression for #682, reproduced with React DevTools' "Record why each
    // component rendered while profiling" setting enabled while hovering rows
    // in Elements, without starting a profiling recording.
    // DevTools inspects hooks by replaying the component with its existing hook
    // state but a no-op dispatch, so inspection cannot trigger state updates.
    // setOptions runs during that replay and could save an onChange closure
    // that captures the no-op, preventing subsequent scrolls from re-rendering.
    // Simulate that dispatch substitution for one render; this unit test does
    // not automate the extension UI or the Elements hover interaction.
    const useReducer = vi.mocked(React.useReducer).getMockImplementation()!
    const spy = vi.mocked(React.useReducer).mockImplementation((...args) => {
      const [state] = useReducer(...args)
      return [state, () => {}]
    })
    try {
      rerender(<List />)
    } finally {
      spy.mockImplementation(useReducer)
    }

    await act(async () => {
      const scroller = screen.getByTestId('scroller')
      scroller.scrollTop = 1000
      fireEvent.scroll(scroller)
    })

    expect(screen.getByText('Row 20')).toBeInTheDocument()
    expect(screen.queryByText('Row 0')).not.toBeInTheDocument()
  },
)
