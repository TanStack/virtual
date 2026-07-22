// Browser gate for the window example — including the scrollMargin behavior
// added in session 5: the list's offsetTop is measured on mount and passed as
// scrollMargin; rows subtract it; totalSize is margin-free.
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

test('rows are positioned after the heading (measured scrollMargin applied)', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.item', { hasText: /^Row 0$/ })).toBeVisible()
  // The prose above pushes the list down; row 0 must sit exactly at the list
  // wrapper's top, not at the page top.
  const wrapper = await page
    .locator('div[style*="position: relative"]')
    .first()
    .boundingBox()
  const row0 = await page.locator('.item', { hasText: /^Row 0$/ }).boundingBox()
  expect(wrapper!.y).toBeGreaterThan(50)
  expect(Math.abs(row0!.y - wrapper!.y)).toBeLessThanOrEqual(1)
})

test('wrapper height is the margin-free totalSize (10000 x 35)', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.item', { hasText: /^Row 0$/ })).toBeVisible()
  const wrapperHeight = await page
    .locator('div[style*="position: relative"]')
    .first()
    .evaluate((el) => (el as HTMLElement).style.height)
  // getTotalSize subtracts scrollMargin — the wrapper carries the list's own
  // height, NOT height + listOffset.
  expect(wrapperHeight).toBe('350000px')
})

test('deep window scroll re-windows relative to the LIST, not the page top', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.item', { hasText: /^Row 0$/ })).toBeVisible()
  const listTop = await page.evaluate(() => {
    const el = document.querySelector(
      'div[style*="position: relative"]',
    ) as HTMLElement
    return el.getBoundingClientRect().top + window.scrollY
  })
  await page.evaluate((y) => window.scrollTo(0, y), listTop + 500 * 35)
  await expect(page.locator('.item', { hasText: /^Row 500$/ })).toBeVisible()
  await expect(page.locator('.item', { hasText: /^Row 0$/ })).toHaveCount(0)
})
