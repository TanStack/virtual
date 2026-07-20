// Browser gate for the dynamic example: sizes unknown at render time, each row
// measured via measureElement. Estimate is 80; real heights vary with text length.
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

// At Playwright's default 1280px viewport every row fits on one line and all
// heights coincide — the measuring story only shows once text wraps. Run the
// whole file at a phone-ish width so the idx % 5 text-length cycle produces
// genuinely different line counts.
test.use({ viewport: { width: 480, height: 800 } })

test('rows render and get real measured heights (not the flat 80px estimate)', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-index="0"]')).toBeVisible()
  // Text length cycles with idx % 5, so among the first five rows at least two
  // measured heights must differ — and measured rows should not all sit at the
  // 80px estimate.
  const heights = await page.$$eval('[data-index]', (els) =>
    els.slice(0, 5).map((el) => (el as HTMLElement).offsetHeight),
  )
  expect(new Set(heights).size).toBeGreaterThan(1)
})

test('measured positions stay contiguous: each row starts where the previous ends', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-index="0"]')).toBeVisible()
  const rows = await page.$$eval('[data-index]', (els) =>
    els
      .map((el) => {
        const r = (el as HTMLElement).getBoundingClientRect()
        return {
          index: Number(el.getAttribute('data-index')),
          top: r.top,
          bottom: r.bottom,
        }
      })
      .sort((a, b) => a.index - b.index),
  )
  for (let i = 1; i < rows.length; i++) {
    expect(Math.abs(rows[i]!.top - rows[i - 1]!.bottom)).toBeLessThanOrEqual(1)
  }
})

test('deep scroll re-windows with measured sizes', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-index="0"]')).toBeVisible()
  await page.locator('.scroll-container').evaluate((el) => {
    el.scrollTop = 500 * 80
  })
  await page.waitForFunction(() => !document.querySelector('[data-index="0"]'))
  // Landing index depends on measured (viewport-dependent) heights; the point
  // here is re-windowing, not the exact landing row.
  const indexes = await page.$$eval('[data-index]', (els) =>
    els.map((el) => Number(el.getAttribute('data-index'))),
  )
  expect(Math.min(...indexes)).toBeGreaterThan(100)
})
