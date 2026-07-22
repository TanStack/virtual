// Browser gate for the smooth-scroll example: scrollToIndex with
// behavior 'smooth' via the three buttons.
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

test('Bottom smooth-scrolls all the way to row 9999', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.item', { hasText: /^Row 0$/ })).toBeVisible()
  await page.getByRole('button', { name: /Bottom/ }).click()
  // Smooth scrolling over 350000px takes a moment; assert within a row, generously.
  await expect(page.locator('.item', { hasText: /^Row 9999$/ })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.locator('.item', { hasText: /^Row 0$/ })).toHaveCount(0)
})

test('Top returns smoothly to row 0', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.item', { hasText: /^Row 0$/ })).toBeVisible()
  await page.getByRole('button', { name: /Bottom/ }).click()
  await expect(page.locator('.item', { hasText: /^Row 9999$/ })).toBeVisible({
    timeout: 20_000,
  })
  await page.getByRole('button', { name: /Top/ }).click()
  await expect(page.locator('.item', { hasText: /^Row 0$/ })).toBeVisible({
    timeout: 20_000,
  })
})
