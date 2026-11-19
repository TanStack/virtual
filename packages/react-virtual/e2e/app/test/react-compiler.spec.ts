import { expect, test } from '@playwright/test'

const ITEM_SIZE = 40

for (const mode of ['position', 'transform'] as const) {
  test.describe(`react-compiler directDomUpdates mode=${mode}`, () => {
    test('renders items on initial load', async ({ page }) => {
      await page.goto(`/react-compiler/?mode=${mode}`)

      await expect(page.locator('[data-testid="direct-dom"]')).toHaveText(
        'true',
      )

      // Items should be visible on initial load.
      await expect(page.locator('[data-testid="item-0"]')).toBeVisible()
      await expect(page.locator('[data-testid="item-0"]')).toContainText(
        'Row 0',
      )

      // Container height is set via containerRef.
      const inner = page.locator('#inner')
      await expect(inner).toHaveAttribute(
        'style',
        new RegExp(`height:\\s*${1000 * ITEM_SIZE}px`),
      )
    })

    test('items update correctly after scrolling', async ({ page }) => {
      await page.goto(`/react-compiler/?mode=${mode}`)

      await expect(page.locator('[data-testid="item-0"]')).toBeVisible()

      // Scroll to index 500.
      await page.click('#scroll-to-500')

      // Item 500 should become visible — this is the core #736 regression.
      // Without directDomUpdates the compiler caches getVirtualItems() and
      // only the initial batch of items ever renders.
      await expect(page.locator('[data-testid="item-500"]')).toBeVisible({
        timeout: 5000,
      })

      // Verify the item is positioned correctly via direct DOM writes.
      const item500 = page.locator('[data-testid="item-500"]')
      const style = (await item500.getAttribute('style')) ?? ''
      if (mode === 'position') {
        expect(style).toMatch(/top:\s*20000px/)
      } else {
        expect(style).toMatch(/translate3d\(0px,\s*20000px,\s*0px\)/)
      }
    })

    test('incremental scroll positions items without full re-render', async ({
      page,
    }) => {
      await page.goto(`/react-compiler/?mode=${mode}`)

      const initialRenders = Number(
        await page.locator('[data-testid="render-count"]').textContent(),
      )

      // Scroll by one item — within overscan, so no range change.
      await page.locator('#scroll-container').evaluate((el, by) => {
        el.scrollTop = by
      }, ITEM_SIZE)

      // Item 1 should be positioned at ITEM_SIZE.
      const item1 = page.locator('[data-testid="item-1"]')
      await expect(item1).toHaveAttribute(
        'style',
        mode === 'position'
          ? /top:\s*40px/
          : /translate3d\(0px,\s*40px,\s*0px\)/,
      )

      const renderAfterScroll = Number(
        await page.locator('[data-testid="render-count"]').textContent(),
      )
      // directDomUpdates should minimise re-renders — allow at most 2
      // (isScrolling flips).
      expect(renderAfterScroll - initialRenders).toBeLessThanOrEqual(2)
    })
  })
}

// `useVirtualizer` itself is skipped by the compiler, but a component the
// virtualizer is passed to is compiled. These cover reads made there.
test.describe('react-compiler useVirtualizerState', () => {
  test('a compiled child reading useVirtualizerState follows scrolling', async ({
    page,
  }) => {
    await page.goto('/react-compiler/?api=state')

    await expect(page.locator('[data-testid="item-0"]')).toBeVisible()
    await expect(page.locator('#inner')).toHaveAttribute(
      'style',
      new RegExp(`height:\\s*${1000 * ITEM_SIZE}px`),
    )

    await page.click('#scroll-to-500')

    await expect(page.locator('[data-testid="item-500"]')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator('[data-testid="item-500"]')).toHaveAttribute(
      'style',
      /translateY\(20000px\)/,
    )
  })

  test('a compiled child reading useVirtualizerState renders newly visible items', async ({
    page,
  }) => {
    await page.goto('/react-compiler/?api=state')

    await expect(page.locator('[data-testid="item-0"]')).toBeVisible()

    await page.locator('#scroll-container').evaluate((el, by) => {
      el.scrollTop = by
    }, ITEM_SIZE * 20)

    await expect(page.locator('[data-testid="item-25"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-0"]')).toHaveCount(0)
  })

  // Control: the same child reading the instance is memoised on the stable
  // virtualizer, so it keeps its first render — taken before the scroll
  // element was attached, with no items — which is what the state hook fixes.
  test('a compiled child reading the instance goes stale', async ({ page }) => {
    await page.goto('/react-compiler/?api=instance')

    await expect(page.locator('#scroll-container')).toBeVisible()
    await page.waitForTimeout(300)
    await expect(page.locator('[data-testid="item-0"]')).toHaveCount(0)

    await page.locator('#scroll-container').evaluate((el, by) => {
      el.scrollTop = by
    }, ITEM_SIZE * 20)

    await page.waitForTimeout(300)
    await expect(page.locator('[data-testid="item-25"]')).toHaveCount(0)
  })
})
