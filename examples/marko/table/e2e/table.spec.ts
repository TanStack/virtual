import { expect, test } from '@playwright/test'

// Gate for the table example: semantic-table virtualization (tr/tbody + the
// translateY(start - loopIndex*size) trick), hand-rolled header sorting, and the
// index-vs-data lesson: sorting swaps the data under a stationary window.

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

test('renders a window of 50k semantic rows with correct flow-compensated positioning', async ({
  page,
}) => {
  await page.goto('/')
  const first = page.locator('tbody tr[data-index="0"]')
  await expect(first).toBeVisible()
  // far more data than DOM
  const rendered = await page.locator('tbody tr').count()
  expect(rendered).toBeLessThan(80)
  // rows are real tr elements inside a tbody under a sticky thead
  await expect(page.locator('thead th[data-col="age"]')).toBeVisible()
  // flow compensation: rendered row K carries translateY(start - K*34); with no scroll,
  // start = index*34, so every rendered row's translateY is 0 at the top
  const transform = await first.evaluate((el) => el.style.transform)
  expect(transform).toBe('translateY(0px)')
})

test('deep scroll re-windows and compensation keeps rows visually contiguous', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('tbody tr[data-index="0"]')).toBeVisible()
  await page.locator('[data-testid="container"]').evaluate((el) => {
    el.scrollTop = 34 * 25000
  })
  await expect(page.locator('tbody tr[data-index="0"]')).toHaveCount(0)
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  // two adjacent rendered rows sit exactly 34px apart on screen
  const [a, b] = await rows.evaluateAll((els) =>
    els.slice(0, 2).map((el) => el.getBoundingClientRect().top),
  )
  expect(Math.round(b! - a!)).toBe(34)
  // the sticky header is still pinned at the container top 850,000px deep
  const header = page.locator('thead th[data-col="id"]')
  await expect(header).toBeVisible()
  const container = await page
    .locator('[data-testid="container"]')
    .boundingBox()
  const headBox = await header.boundingBox()
  expect(Math.abs(headBox!.y - container!.y)).toBeLessThanOrEqual(2)
})

test('clicking Age sorts ascending, again descending, indicator shown', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('tbody tr[data-index="0"]')).toBeVisible()
  await page.locator('th[data-col="age"]').click()
  // ascending: first row holds the minimum age (deterministic data -> 0 exists in 50k)
  const firstAge = () =>
    page.locator('tbody tr[data-index="0"] td').nth(3).textContent()
  await expect.poll(firstAge).toBe('0')
  await expect(page.locator('th[data-col="age"]')).toContainText('\u{1F53C}')
  await page.locator('th[data-col="age"]').click()
  await expect.poll(firstAge).toBe('39')
  await expect(page.locator('th[data-col="age"]')).toContainText('\u{1F53D}')
})

test('index vs data: sorting swaps data under a stationary window', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('tbody tr[data-index="0"]')).toBeVisible()
  // scroll mid-list
  await page.locator('[data-testid="container"]').evaluate((el) => {
    el.scrollTop = 34 * 1000
  })
  const rows = page.locator('tbody tr')
  await expect
    .poll(async () => Number(await rows.first().getAttribute('data-index')))
    .toBeGreaterThan(900)
  const beforeIndexes = await rows.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-index')),
  )
  const beforeIds = await rows.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-id')),
  )
  const beforeScroll = await page
    .locator('[data-testid="container"]')
    .evaluate((el) => el.scrollTop)
  // Dispatch a DOM click: Playwright's actionability auto-scroll misjudges a
  // position:sticky header inside a deeply-scrolled huge container (its LAYOUT
  // position is at the table top) and would yank scrollTop — an artifact of the
  // test driver, not the page (verified: native click leaves scrollTop untouched).
  await page
    .locator('th[data-col="lastName"]')
    .evaluate((el) => (el as HTMLElement).click())
  // "did not move" = stayed within a fraction of one row (sub-row platform variance —
  // e.g. macOS scroll-anchoring residue — must not fail the lesson; the airtight proof
  // is the identical index list below)
  await expect
    .poll(async () =>
      Math.abs(
        (await page
          .locator('[data-testid="container"]')
          .evaluate((el) => el.scrollTop)) - beforeScroll,
      ),
    )
    .toBeLessThan(34)
  const afterIndexes = await rows.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-index')),
  )
  const afterIds = await rows.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-id')),
  )
  expect(afterIndexes).toEqual(beforeIndexes) // ...same visible POSITIONS...
  expect(afterIds).not.toEqual(beforeIds) // ...different DATA in them
})
