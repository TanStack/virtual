import { expect, test } from '@playwright/test'

// `isIOSWebKit()` keys off the user agent and touch support, so an iPhone UA
// plus touch emulation puts Chromium on the iOS code path. This can't
// reproduce WebKit's momentum physics, only the deferral bookkeeping: a
// programmatic landing involves no touch, so it must not defer its size
// corrections past a paint and snap ~150ms later (#1250).
test.use({
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})

// /scroll/ has 1002 rows of random height against a 50px estimate, so a
// landing far down the list measures rows above the fold that differ from
// their estimate and need compensation. Only an offset landing: an index
// landing is retargeted by reconcile in the next frame on every platform, so
// it settled within this window before the fix too and would detect nothing.
for (const button of ['#scroll-to-offset']) {
  test(`a programmatic landing (${button}) with no touch doesn't snap after it lands (#1250)`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'touch emulation runs in Chromium')
    await page.goto('/scroll/')

    // Click, then sample scrollTop every frame for 700ms.
    const samples = await page.evaluate(async (sel) => {
      const el = document.querySelector('#scroll-container')!
      const out: Array<[number, number]> = []
      const start = performance.now()
      ;(document.querySelector(sel) as HTMLButtonElement).click()
      await new Promise<void>((resolve) => {
        const tick = () => {
          const t = performance.now() - start
          out.push([t, el.scrollTop])
          if (t < 700) requestAnimationFrame(tick)
          else resolve()
        }
        requestAnimationFrame(tick)
      })
      return out
    }, button)

    // The landing and its corrections settle within the first frames; a
    // deferred correction would move the list again ~150ms after the last
    // scroll event.
    const final = samples[samples.length - 1]![1]
    const late = samples.filter(([t]) => t >= 100).map(([, top]) => top)
    expect(final).toBeGreaterThan(0)
    expect(
      late.every((top) => top === final),
      JSON.stringify(samples),
    ).toBe(true)
  })
}
