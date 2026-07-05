import { expect, test } from '@playwright/test'

// Gate for the padding example: paddingStart offsets the first item on each axis,
// horizontal virtualization re-windows on scrollLeft, and the grid's two virtualizers
// share cell elements safely via indexAttribute (the batch's last unproven input).

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

test('paddingStart offsets the first row and first column by 100px', async ({ page }) => {
  await page.goto('/')
  const row0 = page.locator('[data-testid="rows-list"] [data-index="0"]')
  await expect(row0).toBeVisible()
  await expect(row0).toHaveAttribute('style', /translateY\(100px\)/)
  const col0 = page.locator('[data-testid="cols-list"] [data-index="0"]')
  await expect(col0).toBeVisible()
  await expect(col0).toHaveAttribute('style', /translateX\(100px\)/)
})

test('vertical and horizontal lists re-window on scroll', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="rows-list"] [data-index="0"]')).toBeVisible()
  await page
    .locator('[data-testid="rows-list"]')
    .evaluate((el) => { el.scrollTop = 5000 })
  await expect(page.locator('[data-testid="rows-list"] [data-index="0"]')).toHaveCount(0)
  const rowIndexes = page.locator('[data-testid="rows-list"] [data-index]')
  await expect(rowIndexes.first()).toBeVisible()

  await page
    .locator('[data-testid="cols-list"]')
    .evaluate((el) => { el.scrollLeft = 5000 })
  await expect(page.locator('[data-testid="cols-list"] [data-index="0"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="cols-list"] [data-index]').first()).toBeVisible()
})

test('grid: first cell offset by 200px on both axes, both index attributes present', async ({
  page,
}) => {
  await page.goto('/')
  const cell = page.locator('[data-row-index="0"][data-column-index="0"]')
  await expect(cell).toBeVisible()
  await expect(cell).toHaveAttribute('style', /translateX\(200px\) translateY\(200px\)/)
})

test('indexAttribute keeps the two grid virtualizers apart under 2D scrolling', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-row-index="0"][data-column-index="0"]')).toBeVisible()
  // scroll BOTH axes; if either instance read the other's index attribute its
  // measurements/cache would corrupt and the windows would collapse or misplace
  await page.locator('[data-testid="grid-list"]').evaluate((el) => {
    el.scrollTop = 4000
    el.scrollLeft = 3000
  })
  // wait for the re-window to land before reading attributes
  await expect(
    page.locator('[data-row-index="0"][data-column-index="0"]'),
  ).toHaveCount(0)
  const anyCell = page.locator('[data-testid="grid-list"] [data-row-index]').first()
  await expect(anyCell).toBeVisible()
  const attrs = await anyCell.evaluate((el) => ({
    row: Number(el.getAttribute('data-row-index')),
    col: Number(el.getAttribute('data-column-index')),
  }))
  expect(attrs.row).toBeGreaterThan(0)
  expect(attrs.col).toBeGreaterThan(0)
  // rows and columns re-windowed INDEPENDENTLY to different neighborhoods
  expect(Math.abs(attrs.row - attrs.col)).toBeGreaterThan(5)
})

test('scroll-to-index button reaches the halfway row', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-row-index="0"][data-column-index="0"]')).toBeVisible()
  await page.locator('[data-testid="scroll-half"]').click()
  await expect(page.locator('[data-row-index="5000"]').first()).toBeVisible()
})

test('toggle unmounts and remounts the grid; it keeps working after', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="grid-list"]')).toBeVisible()
  await page.locator('[data-testid="toggle"]').click()
  await expect(page.locator('[data-testid="grid-list"]')).toHaveCount(0)
  await page.locator('[data-testid="toggle"]').click()
  await expect(page.locator('[data-row-index]').first()).toBeVisible()
  await page.locator('[data-testid="scroll-last"]').click()
  await expect(page.locator('[data-row-index="9999"]').first()).toBeVisible()
})
