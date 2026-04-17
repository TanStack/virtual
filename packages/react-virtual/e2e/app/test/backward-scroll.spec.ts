import { expect, test } from '@playwright/test'

// Regression test for the "jump while scrolling backward" bug.
//
// Repro: jump into the middle of a list with dynamically measured items,
// then scroll upward with the wheel. Previously the ResizeObserver would
// re-fire for items that were already measured, triggering scroll
// adjustments that caused visible jumps. The fix skips re-measuring
// cached items during backward user scroll.
test('does not jump when scrolling backward from the middle of a dynamic list', async ({
  page,
}) => {
  await page.goto('/backward-scroll/')

  const container = page.locator('[data-testid="scroll-container"]')
  await expect(container).toBeVisible()

  // Jump into the middle of the list
  await container.evaluate((el) => {
    ;(el as HTMLElement).scrollTop = 8000
  })

  // Let the browser lay out and measure the freshly rendered items
  await page.waitForTimeout(200)

  const startTop = await container.evaluate(
    (el) => (el as HTMLElement).scrollTop,
  )
  expect(startTop).toBeGreaterThan(7000)

  // Scroll upward with the wheel while sampling scrollTop. If a scroll
  // adjustment happens mid-scroll, scrollTop will jump *upward* between
  // two consecutive samples even though we're scrolling up ourselves.
  // We detect that by checking that scrollTop never increases between
  // two consecutive samples during the backward scroll.
  const samples: Array<number> = []
  samples.push(startTop)

  for (let i = 0; i < 20; i++) {
    await container.hover()
    await page.mouse.wheel(0, -120)
    // Yield to the browser so RO/scroll events can flush
    await page.waitForTimeout(40)
    const top = await container.evaluate(
      (el) => (el as HTMLElement).scrollTop,
    )
    samples.push(top)
  }

  // While the user is wheel-scrolling up, scrollTop must be monotonically
  // non-increasing. Any increase > a small tolerance means a jump occurred.
  const TOLERANCE = 2
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]!
    const curr = samples[i]!
    expect(
      curr,
      `Jump detected at sample ${i}: ${prev} -> ${curr}`,
    ).toBeLessThanOrEqual(prev + TOLERANCE)
  }

  // After scrolling stops, the layout should settle: items rendered
  // contiguously with no gaps / overlaps.
  await page.waitForTimeout(400)

  const rects = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid^="item-"]'),
    )
    return nodes
      .map((n) => ({
        index: Number(n.dataset.index),
        top: n.getBoundingClientRect().top,
        bottom: n.getBoundingClientRect().bottom,
      }))
      .sort((a, b) => a.index - b.index)
  })

  for (let i = 1; i < rects.length; i++) {
    const prev = rects[i - 1]!
    const curr = rects[i]!
    // Items are rendered back-to-back: curr.top should equal prev.bottom
    expect(Math.abs(curr.top - prev.bottom)).toBeLessThanOrEqual(1)
  }
})
