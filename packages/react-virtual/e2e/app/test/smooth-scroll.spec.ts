import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// A smooth scroll's duration scales with distance (index 1000 is ~50,000px),
// and reconcileScroll may re-drive it as rows measure, so neither a fixed wait
// nor a pair of equal scrollTop samples proves completion: the "index 1000"
// case flaked on a fixed 2s wait, and two samples can straddle the pause
// between two re-drives. The virtualizer has the real signal: reconcileScroll
// retires `scrollState` only once the target is stable and reached. Wait for
// the target row to render, then for that retirement.
async function waitForSmoothScroll(page: Page, testId: string) {
  await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible({
    timeout: 15_000,
  })
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const v = (window as any).__virtualizer
          return v.scrollState === null && v.isScrolling === false
        }),
      { timeout: 15_000, intervals: [50] },
    )
    .toBe(true)
}

test('smooth scrolls to index 1000', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-1000')

  await waitForSmoothScroll(page, 'item-1000')

  const delta = await page.evaluate(() => {
    const item = document.querySelector('[data-testid="item-1000"]')
    const container = document.querySelector('#scroll-container')
    if (!item || !container) throw new Error('Elements not found')

    const itemRect = item.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const scrollTop = container.scrollTop
    const top = itemRect.top + scrollTop - containerRect.top
    const bottom = top + itemRect.height
    const containerBottom = scrollTop + container.clientHeight
    return Math.abs(bottom - containerBottom)
  })
  expect(delta).toBeLessThan(1.01)
})

test('smooth scrolls to index 100', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-100')

  await waitForSmoothScroll(page, 'item-100')
})

test('smooth scrolls to index 0 after scrolling away', async ({ page }) => {
  await page.goto('/smooth-scroll/')

  // First scroll down
  await page.click('#scroll-to-500')
  await waitForSmoothScroll(page, 'item-500')

  // Then smooth scroll back to top
  await page.click('#scroll-to-0')
  await waitForSmoothScroll(page, 'item-0')

  const scrollTop = await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    return container?.scrollTop ?? -1
  })
  expect(scrollTop).toBeLessThan(1.01)
})

test('smooth scrolls to index 500 with start alignment', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-500-start')

  await waitForSmoothScroll(page, 'item-500')

  const delta = await page.evaluate(
    ([idx, align]) => {
      const item = document.querySelector(`[data-testid="item-${idx}"]`)
      const container = document.querySelector('#scroll-container')
      if (!item || !container) throw new Error('Elements not found')
      const itemRect = item.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      if (align === 'start') {
        return Math.abs(itemRect.top - containerRect.top)
      }
      return 0
    },
    [500, 'start'] as const,
  )
  expect(delta).toBeLessThan(1.01)
})

test('smooth scrolls to index 500 with center alignment', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-500-center')

  await waitForSmoothScroll(page, 'item-500')

  const delta = await page.evaluate(
    ([idx]) => {
      const item = document.querySelector(`[data-testid="item-${idx}"]`)
      const container = document.querySelector('#scroll-container')
      if (!item || !container) throw new Error('Elements not found')
      const itemRect = item.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const containerCenter = containerRect.top + containerRect.height / 2
      const itemCenter = itemRect.top + itemRect.height / 2
      return Math.abs(itemCenter - containerCenter)
    },
    [500] as const,
  )
  // Center alignment has slightly more tolerance due to rounding
  expect(delta).toBeLessThan(50)
})

test('smooth scrolls sequentially to multiple targets', async ({ page }) => {
  await page.goto('/smooth-scroll/')

  // Scroll to 100 first
  await page.click('#scroll-to-100')
  await waitForSmoothScroll(page, 'item-100')

  // Then scroll to 500
  await page.click('#scroll-to-500')
  await waitForSmoothScroll(page, 'item-500')

  // Then scroll to 1000
  await page.click('#scroll-to-1000')
  await waitForSmoothScroll(page, 'item-1000')
})

test('interrupting smooth scroll with another smooth scroll', async ({
  page,
}) => {
  await page.goto('/smooth-scroll/')

  // Start scrolling to 1000
  await page.click('#scroll-to-1000')
  // Interrupt mid-animation (before the 500ms animation completes)
  await page.waitForTimeout(200)
  await page.click('#scroll-to-100')

  await waitForSmoothScroll(page, 'item-100')
})
