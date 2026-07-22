import { expect, test } from '@playwright/test'

// Browser gate for the window-ssr-slice example: the window counterpart of ssr-slice.
// The PAGE scrolls; <window-virtualizer> paints its initial rows on the server from
// initialRect ({ width: 1280, height: 800 }, 48px rows -> roughly ids 1..22 with
// overscan). fetchPeople() runs on the server; rows serialize and resume.

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

test('server HTML contains the painted window slice with the real total size', async ({
  request,
}) => {
  const res = await request.get('/')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toContain('item-even')
  expect(html).toContain('person1@example.com')
  expect(html).toContain('person10@example.com')
  // A slice, not the whole list, in the painted rows (unpainted people live only
  // in the serialized payload, so absence is asserted on row markup, with a
  // positive control proving the pattern matches painted rows).
  expect(html).toMatch(/class="?email"?[^<]*>[^<]*person1@example\.com/)
  expect(html).not.toMatch(/class="?email"?[^<]*>[^<]*person500@example\.com/)
  expect(html).toContain('height: 48000px')
})

test('with JavaScript disabled the painted rows exist in the DOM (streaming swap is JS-dependent)', async ({
  browser,
}) => {
  // Same platform contract as ssr-slice: <await> content streams out-of-order in a
  // hidden wrapper and an inline script swaps it in; with JS disabled the painted
  // rows are in the DOM but the page renders visibly blank (placeholder hidden by
  // the streamed markup as well).
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/')
  expect(
    await page.locator('.email', { hasText: 'person1@example.com' }).count(),
  ).toBe(1)
  expect(await page.locator('.item').count()).toBeGreaterThan(5)
  await context.close()
})

test('client resumes and the window virtualizer is live: page scroll re-windows', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.locator('.email', { hasText: 'person1@example.com' }),
  ).toBeVisible()

  // Scroll the WINDOW (not a container) deep into the list.
  await page.evaluate(() => window.scrollTo(0, 600 * 48))
  await expect(
    page.locator('.email', { hasText: 'person601@example.com' }),
  ).toBeVisible()
  await expect(
    page.locator('.email', { hasText: 'person1@example.com' }),
  ).toHaveCount(0)

  // Round trip to the top: the original slice re-renders.
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(
    page.locator('.email', { hasText: 'person1@example.com' }),
  ).toBeVisible()
})
