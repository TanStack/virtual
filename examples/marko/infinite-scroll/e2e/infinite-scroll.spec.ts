// Browser gate for the infinite-scroll example: 500 slots reserved upfront,
// pages of 20 fetched (400ms simulated latency) as the window nears the end of
// the loaded rows.
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

test('reserves all 500 slots upfront while the first page loads', async ({
  page,
}) => {
  await page.goto('/')
  // Total size is fixed from the start: 500 x 52 regardless of what is loaded.
  const wrapperHeight = await page
    .locator('.scroll-container > div')
    .evaluate((el) => (el as HTMLElement).style.height)
  expect(wrapperHeight).toBe('26000px')
  // First page (simulated 400ms fetch) arrives.
  await expect(
    page.locator('.item', { hasText: /Row #1\b/ }).first(),
  ).toBeVisible()
  await expect(page.getByText('20 of 500 rows loaded')).toBeVisible()
})

test('scrolling to the edge of loaded rows fetches the next page', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByText('20 of 500 rows loaded')).toBeVisible()
  await page.locator('.scroll-container').evaluate((el) => {
    el.scrollTop = 18 * 52 // bring the last loaded rows into the window
  })
  await expect(page.getByText('40 of 500 rows loaded')).toBeVisible()
  await expect(
    page.locator('.item', { hasText: /Row #21\b/ }).first(),
  ).toBeVisible()
})

test('a deep jump shows placeholders, then pages load continuously until the region catches up', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByText('20 of 500 rows loaded')).toBeVisible()
  // Jump far past the loaded region. Unloaded slots render as placeholders
  // immediately; the edge-trigger then RE-FIRES after every load while the window
  // is still past the loaded rows, so pages stream in back-to-back (the counter
  // climbs 40, 60, 80, ... too fast to pin a single value) until the jumped-to
  // region is materialized.
  await page.locator('.scroll-container').evaluate((el) => {
    el.scrollTop = 400 * 52
  })
  await expect(page.locator('.item', { hasText: '—' }).first()).toBeVisible()
  // Catch-up completes: a real row in the jumped-to region replaces its
  // placeholder (~20 pages x 400ms simulated latency — generous timeout).
  await expect(
    page.locator('.item', { hasText: /Row #401\b/ }).first(),
  ).toBeVisible({
    timeout: 20_000,
  })
})
