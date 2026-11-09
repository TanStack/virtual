import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const state = (page: Page) =>
  page.evaluate(() => {
    const v = (window as any).__v
    const el = document.querySelector(
      '[data-testid="scroll-container"]',
    ) as HTMLElement
    return {
      scrollTop: el.scrollTop,
      command: v.scrollState !== null,
      row90: v.getMeasurements()[90].start,
    }
  })

test.beforeEach(async ({ page }) => {
  await page.goto('/command-retire/')
  await page.waitForFunction(() => (window as any).__v != null)
})

test('scrollToIndex lands on the fresh target when rows above shrink in the same handler', async ({
  page,
}) => {
  await page.click('[data-testid="index-shrink"]')
  // Rows 0–19 lost 30px each: row 90 moved from 4500 to 3900, and the max
  // from 4600 to 4000, under the 4500 written first.
  // Retired on its own; the safety valve would take 5s.
  await expect
    .poll(async () => (await state(page)).command, { timeout: 1000 })
    .toBe(false)
  const { scrollTop, row90 } = await state(page)
  expect(row90).toBe(3900)
  expect(scrollTop).toBe(3900)
})

test('scrollToOffset retires after a row above grows, without waiting for the safety valve', async ({
  page,
}) => {
  await page.evaluate(() => {
    const v = (window as any).__v
    const el = document.querySelector('[data-testid="scroll-container"]')!
    // Row 10 is measured larger as the write's read-back arrives, before
    // reconcile has seen the target reached.
    el.addEventListener('scroll', () => v.resizeItem(10, 100), { once: true })
    v.scrollToOffset(2000)
  })
  // The compensation keeps the content in place.
  await expect.poll(async () => (await state(page)).scrollTop).toBe(2050)
  // Retired within a few frames; the safety valve would take 5s.
  await expect
    .poll(async () => (await state(page)).command, { timeout: 1000 })
    .toBe(false)
})
