// Browser gate for the grid example: a 1000x1000 grid — two virtualizers with
// variable formula sizes sharing one scroll element.
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

test('renders the top-left window of the grid', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.cell', { hasText: /^0,0$/ })).toBeVisible()
  const cells = await page.locator('.cell').count()
  expect(cells).toBeGreaterThan(20)
  expect(cells).toBeLessThan(2000) // a window, not a million cells
})

test('2D scroll re-windows both axes at once', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.cell', { hasText: /^0,0$/ })).toBeVisible()
  await page.locator('.scroll-grid').evaluate((el) => {
    el.scrollTop = 200 * 40 // mean row size ~40
    el.scrollLeft = 100 * 120 // mean col size ~120
  })
  await expect(page.locator('.cell', { hasText: /^0,0$/ })).toHaveCount(0)
  const sample = await page.locator('.cell').first().textContent()
  const [r, c] = sample!.split(',').map(Number)
  expect(r).toBeGreaterThan(150)
  expect(c).toBeGreaterThan(70)
})
