import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Gate for the sticky example: rangeExtractor forces the active group header into the
// window past its natural position, and the v.range-derived active index pins exactly
// one header (position: sticky) at the top while all other rows stay absolute.

const consoleErrors: string[] = []

test.beforeEach(({ page }) => {
  consoleErrors.length = 0
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (text.includes('WebSocket') || text.includes('[vite]')) return
    if (message.location().url.endsWith('/favicon.ico')) return
    consoleErrors.push(text)
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))
})

test.afterEach(() => {
  expect(consoleErrors).toEqual([])
})

async function pinned(page: Page) {
  const active = page.locator('[data-active-sticky="true"]')
  await expect(active).toHaveCount(1)
  return active
}

test('loads with the first group header (A) active and pinned at the top', async ({
  page,
}) => {
  await page.goto('/')
  const active = await pinned(page)
  await expect(active).toHaveText('A')
  const list = await page.locator('[data-testid="list"]').boundingBox()
  const box = await active.boundingBox()
  expect(Math.abs(box!.y - list!.y)).toBeLessThanOrEqual(2)
})

test('deep inside a group, its header stays pinned though scrolled past', async ({
  page,
}) => {
  await page.goto('/')
  await pinned(page)
  // row 0 is header 'A'; 22 'Aaron NN' + 22 'Abby NN' follow. Scroll ~15 rows in:
  // well past the header's natural 0px position, still inside group A.
  await page.locator('[data-testid="list"]').evaluate((el) => { el.scrollTop = 750 })
  const active = await pinned(page)
  await expect(active).toHaveText('A')
  const list = await page.locator('[data-testid="list"]').boundingBox()
  const box = await active.boundingBox()
  expect(Math.abs(box!.y - list!.y)).toBeLessThanOrEqual(2) // pinned to the top edge
  // and the header row is rendered even though the window starts ~15 rows past it —
  // rangeExtractor forced index 0 in
  await expect(page.locator('[data-index="0"]')).toHaveCount(1)
  // visible plain rows around it belong to group A
  const firstName = page.locator('[data-index]:not([data-sticky])').first()
  await expect(firstName).toContainText(/^A/)
})

test('crossing into the next group hands the pin to its header', async ({ page }) => {
  await page.goto('/')
  await pinned(page)
  // group A spans header(1) + Aaron(22) + Abby(22) = 45 rows * 50px = 2250px.
  // Scroll past that boundary into group B.
  await page.locator('[data-testid="list"]').evaluate((el) => { el.scrollTop = 2400 })
  const active = await pinned(page)
  await expect(active).toHaveText('B')
  // exactly one active pin; the A header is no longer force-rendered
  await expect(page.locator('[data-index="0"]')).toHaveCount(0)
})

test('scrolling far and back returns the pin to A', async ({ page }) => {
  await page.goto('/')
  await pinned(page)
  await page.locator('[data-testid="list"]').evaluate((el) => { el.scrollTop = 20000 })
  const far = await pinned(page)
  await expect(far).not.toHaveText('A')
  await page.locator('[data-testid="list"]').evaluate((el) => { el.scrollTop = 0 })
  const back = await pinned(page)
  await expect(back).toHaveText('A')
})
