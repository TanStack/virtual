import { expect, test } from '@playwright/test'

// Gate for the pretext example: heights are CALCULATED (no measureElement), so long jumps
// land exactly; measure() recomputes everything when the width changes.

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

test('renders a small window of 2000 rows with calculated heights', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-index="0"]')).toBeVisible()
  const stat = await page.locator('[data-testid="stat"]').textContent()
  const rendered = Number(stat!.split(' ')[0])
  expect(rendered).toBeGreaterThan(0)
  expect(rendered).toBeLessThan(60)
  // calculated row height matches the RENDERED bubble: no post-render correction needed
  const row = page.locator('[data-index="0"]')
  const declared = await row.evaluate((el) =>
    Number.parseFloat(el.style.height),
  )
  const actual = await row.evaluate((el) => el.getBoundingClientRect().height)
  expect(Math.abs(declared - actual)).toBeLessThanOrEqual(1)
})

test('Bottom lands exactly on the last message in one jump', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-index="0"]')).toBeVisible()
  await page.locator('[data-testid="bottom"]').click()
  const last = page.locator('[data-index="1999"]')
  await expect(last).toBeVisible()
  // end-aligned: the last row's bottom sits at the viewport bottom (calculated heights
  // mean no correction drift after landing)
  const list = await page.locator('[data-testid="list"]').boundingBox()
  const box = await last.boundingBox()
  expect(
    Math.abs(box!.y + box!.height - (list!.y + list!.height)),
  ).toBeLessThanOrEqual(2)
})

test('Middle then Top round-trips cleanly', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-index="0"]')).toBeVisible()
  await page.locator('[data-testid="middle"]').click()
  await expect(page.locator('[data-index="1000"]')).toBeVisible()
  await page.locator('[data-testid="top"]').click()
  await expect(page.locator('[data-index="0"]')).toBeVisible()
})

test('narrowing the viewport re-measures: rows get taller, total grows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('/')
  await expect(page.locator('[data-index="0"]')).toBeVisible()
  const beforeTotal = await page
    .locator('[data-testid="spacer"]')
    .evaluate((el) => Number.parseFloat(el.style.height))
  const beforeH0 = await page
    .locator('[data-index="0"]')
    .evaluate((el) => Number.parseFloat(el.style.height))
  await page.setViewportSize({ width: 460, height: 800 })
  // ResizeObserver -> widthState update -> v.measure() -> new calculated sizes
  await expect
    .poll(async () =>
      page
        .locator('[data-testid="spacer"]')
        .evaluate((el) => Number.parseFloat(el.style.height)),
    )
    .toBeGreaterThan(beforeTotal)
  const afterH0 = await page
    .locator('[data-index="0"]')
    .evaluate((el) => Number.parseFloat(el.style.height))
  expect(afterH0).toBeGreaterThan(beforeH0)
  // and the recalculated height still matches the rendered bubble exactly
  const declared = afterH0
  const actual = await page
    .locator('[data-index="0"]')
    .evaluate((el) => el.getBoundingClientRect().height)
  expect(Math.abs(declared - actual)).toBeLessThanOrEqual(1)
})
