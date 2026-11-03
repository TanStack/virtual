import { expect, test } from '@playwright/test'

for (const deferred of [false, true]) {
  test(`re-pins after a cached row grows (deferred observer: ${deferred})`, async ({
    page,
  }) => {
    await page.goto(`/cached-measurements/${deferred ? '?raf' : ''}`)
    const scroller = page.locator('#scroll-container')
    await expect
      .poll(() => scroller.evaluate((el) => el.scrollHeight))
      .toBe(980)
    await page.getByRole('button', { name: 'Scroll to end' }).click()
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(780)
    await expect(page.getByTestId('scrolling')).toHaveText('idle')

    await page.getByRole('button', { name: 'Grow and pin' }).click()

    await expect
      .poll(() => scroller.evaluate((el) => el.scrollHeight))
      .toBe(1010)
    await expect
      .poll(() =>
        scroller.evaluate(
          (el) => el.scrollHeight - el.scrollTop - el.clientHeight,
        ),
      )
      .toBe(0)
  })
}

test('preserves item sizes when list is hidden with useCachedMeasurements', async ({
  page,
}) => {
  await page.goto('/cached-measurements/')

  // Wait for initial render and measurements
  await expect(page.locator('[data-testid="item-0"]')).toBeVisible()
  await page.waitForTimeout(200)

  // Capture totalSize before hiding
  const sizeBefore = await page
    .locator('[data-testid="total-size"]')
    .textContent()
  expect(Number(sizeBefore)).toBeGreaterThan(0)

  // Hide the list
  await page.click('[data-testid="toggle"]')
  await expect(page.locator('[data-testid="list-wrapper"]')).toBeHidden()

  // Wait for RO callbacks to fire
  await page.waitForTimeout(300)

  // totalSize should be preserved (not reset to estimate-only values)
  const sizeWhileHidden = await page
    .locator('[data-testid="total-size"]')
    .textContent()
  expect(Number(sizeWhileHidden)).toBe(Number(sizeBefore))

  // Show the list again
  await page.click('[data-testid="toggle"]')
  await expect(page.locator('[data-testid="item-0"]')).toBeVisible()
  await page.waitForTimeout(200)

  // totalSize should still match
  const sizeAfterShow = await page
    .locator('[data-testid="total-size"]')
    .textContent()
  expect(Number(sizeAfterShow)).toBe(Number(sizeBefore))
})
