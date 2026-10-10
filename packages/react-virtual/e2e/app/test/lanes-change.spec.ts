import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Layout of the rendered cells. `measured` is true once every rendered cell's
// virtual size (the wrapper height) matches the real height of its square
// content, i.e. the virtualizer has measured everything on screen.
// `misaligned` lists rows (index / lanes) whose cells don't share one start,
// meaning a lane drifted away from the others.
const layout = (page: Page) =>
  page.evaluate(() => {
    const lanes = (window as any).virtualizer.options.lanes as number
    const rows = new Map<number, Set<number>>()
    let measured = true
    for (const el of document.querySelectorAll<HTMLElement>('.cell')) {
      const content = el.firstElementChild as HTMLElement
      if (el.offsetHeight !== content.offsetHeight) measured = false
      const row = Math.floor(Number(content.dataset.index) / lanes)
      if (!rows.has(row)) rows.set(row, new Set())
      rows.get(row)!.add(Number(el.dataset.start))
    }
    const misaligned = [...rows]
      .filter(([, starts]) => starts.size > 1)
      .map(([row, starts]) => `row ${row}: ${[...starts].join(', ')}`)
    return { lanes, measured, misaligned }
  })

test('rows stay aligned after changing lanes while scrolled to the end (#1036)', async ({
  page,
}) => {
  await page.goto('/lanes-change/')

  // Scroll to the end until it settles: measurements can grow the list.
  await expect(async () => {
    const atEnd = await page.evaluate(() => {
      const c = document.querySelector('#scroll-container')!
      c.scrollTop = c.scrollHeight
      return c.scrollTop + c.clientHeight >= c.scrollHeight - 1
    })
    expect(atEnd).toBe(true)
    expect((await layout(page)).measured).toBe(true)
  }).toPass()

  await page.click('[data-testid="toggle"]')

  // Right after the toggle every cell still has the same estimate, so rows
  // are trivially aligned. Wait until the 5-lane sizes are measured.
  await expect
    .poll(async () => {
      const { lanes, measured } = await layout(page)
      return lanes === 5 && measured
    })
    .toBe(true)
  expect((await layout(page)).misaligned).toEqual([])
})
