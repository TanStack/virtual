import { expect, test } from '@playwright/test'

// Gate for the scroll-padding example: the sticky header's measured height must feed
// paddingStart (first row starts below the header) and scrollPaddingStart
// (scrollToIndex aligns the target row just below the header, not underneath it).

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

async function headerBottom(page: import('@playwright/test').Page) {
  const box = await page.locator('thead').boundingBox()
  return box!.y + box!.height
}

test('rows start below the sticky header, not underneath it', async ({
  page,
}) => {
  await page.goto('/')
  const row0 = page.locator('[data-index="0"]')
  await expect(row0).toBeVisible()
  const bottom = await headerBottom(page)
  const box = await row0.boundingBox()
  expect(box!.y).toBeGreaterThanOrEqual(bottom - 1)
})

test('scrollToIndex(40) downward aligns to the viewport END (align auto semantics)', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-index="0"]')).toBeVisible()
  await page.locator('[data-testid="scroll-40"]').click()
  const row = page.locator('[data-index="40"]')
  await expect(row).toBeVisible()
  // align 'auto' scrolls the minimum: a DOWNWARD jump lands the row at the
  // BOTTOM of the scroller, not under the header. (The header alignment is the
  // upward case — next test.)
  const scroller = await page.locator('.list').boundingBox()
  const box = await row.boundingBox()
  expect(
    Math.abs(box!.y + box!.height - (scroller!.y + scroller!.height)),
  ).toBeLessThanOrEqual(2)
})

test('then scrollToIndex(20) scrolls BACK and aligns row 20 below the header', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-index="0"]')).toBeVisible()
  await page.locator('[data-testid="scroll-40"]').click()
  await expect(page.locator('[data-index="40"]')).toBeVisible()
  await page.locator('[data-testid="scroll-20"]').click()
  const row = page.locator('[data-index="20"]')
  await expect(row).toBeVisible()
  const bottom = await headerBottom(page)
  const box = await row.boundingBox()
  expect(Math.abs(box!.y - bottom)).toBeLessThanOrEqual(2)
})
