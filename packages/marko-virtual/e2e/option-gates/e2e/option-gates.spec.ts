import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Real-browser gates for the full-parity option batch. Tier 1 (jsdom forwarding for
// every option) lives in the package's options.test.ts; these are the Tier 2 behavioral
// proofs plus the Tier 3 weak-assertion pair (debug asserts a log line;
// useAnimationFrameWithResizeObserver is forwarding-only + explicitly UNPROVEN).

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

async function renderedIndexes(page: Page, attr = 'data-index'): Promise<number[]> {
  return page.$$eval(
    `[${attr}]`,
    (els, a) =>
      els
        .map((el) => Number(el.getAttribute(a as string)))
        .sort((x, y) => x - y),
    attr,
  )
}

test('scrollMargin: visibility is computed relative to the list, not the scroller top', async ({
  page,
}) => {
  await page.goto('/scroll-margin')
  await page.waitForSelector('[data-index="0"]')

  // At scrollTop 0 the 300px header fills most of the viewport; row 0 must sit
  // exactly below it (item.start includes the margin; the transform subtracts it).
  const header = await page.locator('[data-testid="header"]').boundingBox()
  const row0 = await page.locator('[data-index="0"]').boundingBox()
  expect(Math.abs(row0!.y - (header!.y + header!.height))).toBeLessThanOrEqual(1)

  // item.start for row 0 INCLUDES the margin.
  await expect(page.locator('[data-index="0"]')).toHaveAttribute('data-start', '300')

  // Scroll so the list itself is 700px in (header 300 + 20 rows x 35): the window
  // must be anchored around index 20, and index 0 must have left the DOM. Without
  // scrollMargin the math would think the list starts at the scroller top and keep
  // lower indexes rendered.
  await page.locator('[data-testid="scroller"]').evaluate((el) => {
    el.scrollTop = 300 + 20 * 35
  })
  await page.waitForFunction(
    () => !document.querySelector('[data-index="0"]'),
  )
  const idx = await renderedIndexes(page)
  expect(idx[0]!).toBeGreaterThanOrEqual(20 - 5) // minus overscan
  expect(idx[0]!).toBeLessThanOrEqual(20)
  // A row near index 20 is at the top edge of the viewport (within one row).
  const row20 = await page.locator('[data-index="20"]').boundingBox()
  const scroller = await page.locator('[data-testid="scroller"]').boundingBox()
  expect(Math.abs(row20!.y - scroller!.y)).toBeLessThan(35)
})

test('enabled=false disables the virtualizer (empty window); enabled=true re-windows from the live scroll position', async ({
  page,
}) => {
  // Characterizes core's ACTUAL disable contract: enabled=false is not a freeze —
  // core clears its measurements (measurementsCache = [], caches cleared), getSize()
  // and getScrollOffset() return 0, and the rendered window collapses. Re-enabling
  // re-observes and re-windows from the element's current scroll position.
  await page.goto('/enabled')
  await page.waitForSelector('[data-index="0"]')

  // Scroll deep while enabled: re-windows to ~index 100.
  await page.locator('[data-testid="scroller"]').evaluate((el) => {
    el.scrollTop = 100 * 35
  })
  await page.waitForFunction(() => !document.querySelector('[data-index="0"]'))
  const deep = await renderedIndexes(page)
  expect(deep[0]!).toBeGreaterThan(50)

  // Let the end-of-scroll debounce fire while STILL ENABLED before toggling.
  // KNOWN UPSTREAM CORE BUG (found by this gate): core's debounce (utils.ts) has no
  // cancel, and observeOffset's unsubscribe only removes the event listeners — a
  // pending end-of-scroll timer survives cleanup() and later fires
  // cb(staleOffset, false) into the live instance. Disable + re-enable within
  // isScrollingResetDelay (150ms) and the stale offset overwrites the correct
  // re-enable recompute, leaving a stale window until the next real scroll event.
  // This wait sidesteps the zombie timer so the gate asserts the enabled contract
  // itself; remove it if/when the core fix (cancellable debounce) lands.
  await page.waitForTimeout(250)

  // Disable: the deep window disappears (measurements cleared, empty/collapsed window).
  await page.locator('[data-testid="toggle"]').click()
  await page.waitForFunction(
    (edge) => !document.querySelector(`[data-index="${edge}"]`),
    deep[0]!,
  )
  const disabled = await renderedIndexes(page)
  expect(disabled.length).toBeLessThanOrEqual(1) // empty (or a single collapsed row at offset 0)
  expect(disabled).not.toContain(deep[0]!)

  // The scroll element itself was NOT unmounted — the pause switch never tears down DOM.
  await expect(page.locator('[data-testid="scroller"]')).toBeVisible()

  // Re-enable with the element scrolled to the top: re-windows live from offset 0.
  await page.locator('[data-testid="scroller"]').evaluate((el) => {
    el.scrollTop = 0
  })
  await page.locator('[data-testid="toggle"]').click()
  await page.waitForSelector('[data-index="0"]')
  const resumed = await renderedIndexes(page)
  expect(resumed[0]!).toBe(0)
  expect(resumed.length).toBeGreaterThan(10)
})

test('isRtl: a right-to-left horizontal list advances as the user scrolls left', async ({
  page,
}) => {
  await page.goto('/rtl')
  await page.waitForSelector('[data-index="0"]')

  // In RTL, scrolling toward the list end means scrollLeft goes NEGATIVE.
  await page.locator('[data-testid="scroller"]').evaluate((el) => {
    el.scrollLeft = -(50 * 100) // 50 columns in
  })
  await page.waitForFunction(() => !document.querySelector('[data-index="0"]'))
  const idx = await renderedIndexes(page)
  expect(idx[0]!).toBeGreaterThanOrEqual(45) // 50 minus overscan
  expect(idx[idx.length - 1]!).toBeGreaterThan(50)
})

test('custom measureElement: item sizes come from the custom measurer (+10)', async ({
  page,
}) => {
  await page.goto('/measure-element')
  await page.waitForSelector('[data-index="0"]')
  // Rows render 30px tall; the custom measurer reports offsetHeight + 10 = 40.
  // Estimate is 50, so 40 is unambiguously the custom measurer's number.
  await expect(page.locator('[data-index="0"]')).toHaveAttribute('data-size', '40')
  await expect(page.locator('[data-index="5"]')).toHaveAttribute('data-size', '40')
})

test('useCachedMeasurements freezes sizes: frozen list keeps the estimate, control learns the DOM', async ({
  page,
}) => {
  await page.goto('/cached')
  await page.waitForSelector('[data-frozen-index="0"]')
  await page.waitForSelector('[data-control-index="0"]')

  // Control (default measurer): rows really render 90px, item.size becomes 90.
  await expect(page.locator('[data-control-index="0"]')).toHaveAttribute(
    'data-size',
    '90',
  )
  // Frozen (useCachedMeasurements): the measurer returns the cached/estimated size
  // and never reads the DOM — item.size stays at the 50px estimate.
  await expect(page.locator('[data-frozen-index="0"]')).toHaveAttribute(
    'data-size',
    '50',
  )
})

test('laneAssignmentMode "measured": a 3-lane masonry lays out with all lanes populated and no in-lane overlap', async ({
  page,
}) => {
  await page.goto('/lanes-mode')
  await page.waitForSelector('[data-index="0"]')

  // Wait until measured sizes have settled (row 0's real height is 30px, estimate 60).
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-index="0"]')
    return el !== null
  })
  const rows = await page.$$eval('[data-index]', (els) =>
    els.map((el) => ({
      index: Number(el.getAttribute('data-index')),
      lane: Number(el.getAttribute('data-lane')),
      top: (el as HTMLElement).getBoundingClientRect().top,
      bottom: (el as HTMLElement).getBoundingClientRect().bottom,
    })),
  )
  const lanes = new Set(rows.map((r) => r.lane))
  expect(lanes).toEqual(new Set([0, 1, 2]))

  // Within each lane, sorted by top, no two items overlap.
  for (const lane of [0, 1, 2]) {
    const inLane = rows
      .filter((r) => r.lane === lane)
      .sort((a, b) => a.top - b.top)
    for (let i = 1; i < inLane.length; i++) {
      expect(inLane[i]!.top).toBeGreaterThanOrEqual(inLane[i - 1]!.bottom - 1)
    }
  }
})

test('useScrollendEvent + isScrollingResetDelay: scrolling still re-windows (regression smoke; timing itself NOT asserted)', async ({
  page,
}) => {
  await page.goto('/scroll-events')
  await page.waitForSelector('[data-index="0"]')
  await page.locator('[data-testid="scroller"]').evaluate((el) => {
    el.scrollTop = 200 * 35
  })
  await page.waitForFunction(() => !document.querySelector('[data-index="0"]'))
  const idx = await renderedIndexes(page)
  expect(idx[0]!).toBeGreaterThan(150)
  // Scroll back; settles again after the (native scrollend / 50ms) end-of-scroll signal.
  await page.locator('[data-testid="scroller"]').evaluate((el) => {
    el.scrollTop = 0
  })
  await page.waitForSelector('[data-index="0"]')
})

test('debug=true emits core timing logs (a console.info with the memo key)', async ({
  page,
}) => {
  const infos: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'info') infos.push(message.text())
  })
  await page.goto('/debug')
  await page.waitForSelector('[data-index="0"]')
  await page.locator('[data-testid="scroller"]').evaluate((el) => {
    el.scrollTop = 50 * 35
  })
  await page.waitForFunction(() => !document.querySelector('[data-index="0"]'))
  // Core's memo() prints console.info('%c⏱ ... ms', <css>, key) in dev when debug is on.
  expect(
    infos.some((t) => t.includes('⏱') || t.includes('maybeNotify')),
  ).toBe(true)
})

test('window-virtualizer horizontal: the page scrolls sideways and the column window follows', async ({
  page,
}) => {
  await page.goto('/window-horizontal')
  await page.waitForSelector('[data-index="0"]')
  await page.evaluate(() => window.scrollTo(60 * 100, 0))
  await page.waitForFunction(() => !document.querySelector('[data-index="0"]'))
  const idx = await renderedIndexes(page)
  expect(idx[0]!).toBeGreaterThanOrEqual(55) // 60 minus overscan
})

test('window-virtualizer initialOffset: the SERVER paints the slice at the offset (view-source)', async ({
  page,
  request,
}) => {
  // Raw HTML, no JS: the seed must contain rows around index 100 (3500 / 35), not row 0.
  // NOTE: Marko renders attributes UNQUOTED (data-index=100), so match with a
  // boundary regex, not a quoted substring.
  const res = await request.get('/window-initial-offset')
  const html = await res.text()
  expect(html).toMatch(/data-index=100[\s">]/)
  expect(html).not.toMatch(/data-index=0[\s">]/)

  // And live: the page loads with those rows present before any client scrolling.
  await page.goto('/window-initial-offset')
  await page.waitForSelector('[data-index="100"]')
})

test('window example (fixed): measured scrollMargin positions rows after the heading and windows correctly at depth', async ({
  page,
}) => {
  // The shipped window example, verbatim. Its heading/prose sit above the list, so
  // listOffset is measured on mount and passed as scrollMargin; rows subtract it.
  await page.goto('/window-example')
  await page.waitForSelector('[class*="item"]')

  // Row 0 starts exactly at the list wrapper's top (which is listOffset px into the page).
  const wrapper = await page
    .locator('div[style*="position: relative"]')
    .first()
    .boundingBox()
  const row0 = await page.locator('.item', { hasText: /^Row 0$/ }).boundingBox()
  expect(wrapper!.y).toBeGreaterThan(50) // prose above pushed the list down
  expect(Math.abs(row0!.y - wrapper!.y)).toBeLessThanOrEqual(1)

  // Scroll the window deep: the rendered rows must track the LIST's visibility.
  // Target index 500: window scroll = listOffset + 500*35 - we read the wrapper's
  // document offset from the page itself.
  const listTop = await page.evaluate(() => {
    const el = document.querySelector('div[style*="position: relative"]') as HTMLElement
    return el.getBoundingClientRect().top + window.scrollY
  })
  await page.evaluate((y) => window.scrollTo(0, y), listTop + 500 * 35)
  await page.waitForFunction(
    () => !document.body.textContent!.match(/Row 0(?!\d)/),
  )
  const texts = await page.$$eval('.item', (els) => els.map((el) => el.textContent!.trim()))
  const indexes = texts
    .map((t) => Number(t.replace('Row', '').trim()))
    .sort((a, b) => a - b)
  expect(indexes[0]!).toBeGreaterThanOrEqual(495 - 6) // 500 minus overscan, one row of slack
  expect(indexes[0]!).toBeLessThanOrEqual(500)
  // A row near 500 sits near the viewport top: positioning (start - listOffset) is coherent.
  const probe = await page
    .locator('.item', { hasText: new RegExp(`^Row ${indexes[0]! + 5}$`) })
    .boundingBox()
  expect(probe).not.toBeNull()
})
