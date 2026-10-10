import { expect, test } from '@playwright/test'

// Rendered cells grouped by row (index / lanes), each with the set of
// distinct starts in that row. A row whose cells don't share a start means
// one lane drifted away from the others.
const misalignedRows = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const lanes = (window as any).virtualizer.options.lanes as number
    const rows = new Map<number, Set<number>>()
    for (const el of document.querySelectorAll<HTMLElement>('.cell')) {
      const index = Number((el.firstElementChild as HTMLElement).dataset.index)
      const row = Math.floor(index / lanes)
      if (!rows.has(row)) rows.set(row, new Set())
      rows.get(row)!.add(Number(el.dataset.start))
    }
    return [...rows]
      .filter(([, starts]) => starts.size > 1)
      .map(([row, starts]) => `row ${row}: ${[...starts].join(', ')}`)
  })

test('rows stay aligned after changing lanes while scrolled to the end (#1036)', async ({
  page,
}) => {
  await page.goto('/lanes-change/')

  // Scroll to the end until it settles (measurements can grow the list).
  await expect(async () => {
    const atEnd = await page.evaluate(() => {
      const c = document.querySelector('#scroll-container')!
      c.scrollTop = c.scrollHeight
      return c.scrollTop + c.clientHeight >= c.scrollHeight - 1
    })
    expect(atEnd).toBe(true)
  }).toPass()

  await page.click('[data-testid="toggle"]')
  await expect.poll(() => misalignedRows(page)).toEqual([])
  // Let any trailing ResizeObserver work land, then check again.
  await page.waitForTimeout(300)
  expect(await misalignedRows(page)).toEqual([])
})
