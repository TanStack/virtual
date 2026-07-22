import { expect, test } from '@playwright/test'

// Browser gate for the ssr example (Mode A baseline): the server renders an EMPTY
// container — no seed, no <if=mounted> guard — and the client fills it on mount.
//
// View-source assertions follow the raw-HTML rules: Marko renders attributes
// unquoted and splits text interpolations with placeholder markers, so raw-HTML
// checks avoid interpolated text and use stable style/class fragments instead.
// Live-DOM locators are unaffected (textContent joins the split chunks).

const consoleErrors: string[] = []

test.beforeEach(({ page }) => {
  consoleErrors.length = 0
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // Vite dev-server websocket noise only; everything else counts.
    if (text.includes('WebSocket') || text.includes('[vite]')) return
    // Chromium requests /favicon.ico unconditionally; the example ships none.
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

test('server HTML has an empty container with the trivial (0px) size — no rows painted', async ({
  request,
}) => {
  const res = await request.get('/')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  // No rows in the server HTML (row divs carry the item-even/item-odd classes)...
  expect(html).not.toContain('item-even')
  expect(html).not.toContain('item-odd')
  // ...and the wrapper renders the trivial pre-mount size (renderSlice without
  // initialRect returns size 0; the client computes the real total on mount).
  expect(html).toContain('height: 0px')
})

test('client fills the window on mount and the virtualizer is live (scroll re-windows)', async ({
  page,
}) => {
  await page.goto('/')
  // Mount fills the empty container.
  await expect(page.locator('.item', { hasText: /^Row 0$/ })).toBeVisible()
  const initialCount = await page.locator('.item').count()
  expect(initialCount).toBeGreaterThan(10)
  // The wrapper's height is now the real total (10000 x 35), not the trivial 0.
  const wrapperHeight = await page
    .locator('.scroll-container > div')
    .evaluate((el) => (el as HTMLElement).style.height)
  expect(wrapperHeight).toBe('350000px')

  // Liveness after resume: scrolling re-windows. Assert within a row, not
  // pixel-exact scrollTop.
  await page.locator('.scroll-container').evaluate((el) => {
    el.scrollTop = 200 * 35
  })
  await expect(page.locator('.item', { hasText: /^Row 200$/ })).toBeVisible()
  await expect(page.locator('.item', { hasText: /^Row 0$/ })).toHaveCount(0)
})
