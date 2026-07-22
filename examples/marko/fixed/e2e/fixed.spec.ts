// Browser gate for the fixed example: three fixed-size virtualizers on one page —
// rows, columns, and a 1000x1000 grid of two virtualizers sharing a scroll element.
import { expect, test } from '@playwright/test'

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
  page.on('pageerror', (error) => {
    consoleErrors.push(String(error))
  })
})

test.afterEach(() => {
  expect(consoleErrors).toEqual([])
})

test('rows: initial window renders and deep scroll re-windows', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.locator('.scroll-row-container .item', { hasText: /^Row 0$/ }),
  ).toBeVisible()
  await page.locator('.scroll-row-container').evaluate((el) => {
    el.scrollTop = 300 * 35
  })
  await expect(
    page.locator('.scroll-row-container .item', { hasText: /^Row 300$/ }),
  ).toBeVisible()
  await expect(
    page.locator('.scroll-row-container .item', { hasText: /^Row 0$/ }),
  ).toHaveCount(0)
})

test('columns: initial window renders and horizontal scroll re-windows', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.locator('.scroll-col-container .item', { hasText: /^Col 0$/ }),
  ).toBeVisible()
  await page.locator('.scroll-col-container').evaluate((el) => {
    el.scrollLeft = 50 * 100
  })
  await expect(
    page.locator('.scroll-col-container .item', { hasText: /^Col 50$/ }),
  ).toBeVisible()
  await expect(
    page.locator('.scroll-col-container .item', { hasText: /^Col 0$/ }),
  ).toHaveCount(0)
})

test('grid: two virtualizers share one scroller; 2D scroll re-windows both axes', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.locator('.scroll-grid-container .cell', { hasText: /^0,0$/ }),
  ).toBeVisible()
  await page.locator('.scroll-grid-container').evaluate((el) => {
    el.scrollTop = 100 * 35
    el.scrollLeft = 40 * 100
  })
  await expect(
    page.locator('.scroll-grid-container .cell', { hasText: /^100,40$/ }),
  ).toBeVisible()
  await expect(
    page.locator('.scroll-grid-container .cell', { hasText: /^0,0$/ }),
  ).toHaveCount(0)
})
