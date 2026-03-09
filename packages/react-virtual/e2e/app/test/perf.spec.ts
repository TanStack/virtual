import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'

async function getRenderCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__RENDER_COUNT__?.current ?? 0)
}

async function collectScrollFPS(
  page: Page,
  scrollSteps: number,
  stepPx: number,
): Promise<{ fps: number; elapsed: number; renderCount: number }> {
  const rendersBefore = await getRenderCount(page)

  const result = await page.evaluate(
    ([steps, px]) => {
      return new Promise<{ fps: number; elapsed: number }>((resolve) => {
        const container = document.querySelector('#scroll-container')!
        let frames = 0
        let step = 0
        const start = performance.now()

        function tick() {
          container.scrollTop += px
          frames++
          step++
          if (step < steps) {
            requestAnimationFrame(tick)
          } else {
            // Wait one extra frame for final paint
            requestAnimationFrame(() => {
              const elapsed = performance.now() - start
              resolve({ fps: (frames / elapsed) * 1000, elapsed })
            })
          }
        }

        requestAnimationFrame(tick)
      })
    },
    [scrollSteps, stepPx] as const,
  )

  const rendersAfter = await getRenderCount(page)

  return {
    ...result,
    renderCount: rendersAfter - rendersBefore,
  }
}

test.describe('performance comparison', () => {
  test('initial render time', async ({ page, hookVariant }) => {
    await page.goto('/perf/')

    // Wait for the initial render measurement to be recorded
    await page.waitForFunction(
      () => performance.getEntriesByName('initial-render').length > 0,
    )

    const duration = await page.evaluate(
      () => performance.getEntriesByName('initial-render')[0].duration,
    )

    const renders = await getRenderCount(page)

    console.log(
      `[${hookVariant}] Initial render: ${duration.toFixed(1)}ms, renders: ${renders}`,
    )

    // Sanity check — initial render should be under 500ms
    expect(duration).toBeLessThan(500)
  })

  test('continuous scroll performance (200 frames × 100px)', async ({
    page,
    hookVariant,
  }) => {
    await page.goto('/perf/')
    await page.waitForTimeout(500) // settle

    const { fps, elapsed, renderCount } = await collectScrollFPS(page, 200, 100)

    console.log(
      `[${hookVariant}] Scroll 200×100px: ${fps.toFixed(1)} fps, ${elapsed.toFixed(0)}ms, ${renderCount} renders`,
    )

    // Should maintain at least 30 fps
    expect(fps).toBeGreaterThan(30)
  })

  test('rapid small scroll performance (500 frames × 20px)', async ({
    page,
    hookVariant,
  }) => {
    await page.goto('/perf/')
    await page.waitForTimeout(500)

    const { fps, elapsed, renderCount } = await collectScrollFPS(page, 500, 20)

    console.log(
      `[${hookVariant}] Scroll 500×20px: ${fps.toFixed(1)} fps, ${elapsed.toFixed(0)}ms, ${renderCount} renders`,
    )

    expect(fps).toBeGreaterThan(30)
  })

  test('scrollToIndex render count', async ({ page, hookVariant }) => {
    await page.goto('/perf/')
    await page.waitForTimeout(500)

    const rendersBefore = await getRenderCount(page)

    await page.click('#scroll-to-5000')
    await page.waitForTimeout(2000) // wait for convergence

    await expect(page.locator('[data-testid="item-5000"]')).toBeVisible()

    const rendersAfter = await getRenderCount(page)
    const scrollRenders = rendersAfter - rendersBefore

    console.log(
      `[${hookVariant}] scrollToIndex(5000): ${scrollRenders} renders`,
    )

    // Experimental should use fewer renders (DOM mutations vs React re-renders)
    // Just recording — no hard assertion, the value is informational
  })

  test('scrollToIndex round-trip render count', async ({
    page,
    hookVariant,
  }) => {
    await page.goto('/perf/')
    await page.waitForTimeout(500)

    const rendersBefore = await getRenderCount(page)

    // Scroll to end
    await page.click('#scroll-to-9999')
    await page.waitForTimeout(2000)
    await expect(page.locator('[data-testid="item-9999"]')).toBeVisible()

    // Scroll back to start
    await page.click('#scroll-to-0')
    await page.waitForTimeout(2000)
    await expect(page.locator('[data-testid="item-0"]')).toBeVisible()

    const rendersAfter = await getRenderCount(page)
    const totalRenders = rendersAfter - rendersBefore

    console.log(
      `[${hookVariant}] scrollToIndex round-trip (9999→0): ${totalRenders} renders`,
    )
  })
})
