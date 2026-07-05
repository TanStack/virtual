// Browser gate for the variable example: sizes come from a deterministic
// estimateSize formula (no DOM measurement) — assert real rendered heights
// match the formula, at the top and deep in the list.
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

const rowSize = (i: number) => 25 + ((i * 17 + 31) % 100)

test('row heights follow the estimateSize formula exactly', async ({ page }) => {
  await page.goto('/')
  const row0 = page.locator('.scroll-row .item', {
    hasText: new RegExp(`^Row 0 — ${rowSize(0)}px$`),
  })
  await expect(row0).toBeVisible()
  const h0 = await row0.evaluate((el) => (el as HTMLElement).offsetHeight)
  expect(h0).toBe(rowSize(0))
})

test('deep scroll re-windows and the formula still holds at index 500', async ({
  page,
}) => {
  await page.goto('/')
  // Offset of index 500 = sum of sizes 0..499; compute it the same way core does.
  let offset = 0
  for (let i = 0; i < 500; i++) offset += rowSize(i)
  await page.locator('.scroll-row').evaluate((el, y) => {
    el.scrollTop = y
  }, offset)
  const row500 = page.locator('.scroll-row .item', {
    hasText: new RegExp(`^Row 500 — ${rowSize(500)}px$`),
  })
  await expect(row500).toBeVisible()
  const h = await row500.evaluate((el) => (el as HTMLElement).offsetHeight)
  expect(h).toBe(rowSize(500))
  await expect(
    page.locator('.scroll-row .item', { hasText: /^Row 0 — / }),
  ).toHaveCount(0)
})

test('columns re-window horizontally', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.locator('.scroll-col .item', { hasText: /^Col 0$/ }),
  ).toBeVisible()
  await page.locator('.scroll-col').evaluate((el) => {
    el.scrollLeft = 60 * 125 // mean column size is 75 + ~50
  })
  await expect(
    page.locator('.scroll-col .item', { hasText: /^Col 0$/ }),
  ).toHaveCount(0)
})
