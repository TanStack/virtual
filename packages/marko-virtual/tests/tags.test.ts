/**
 * Integration tests for <virtualizer> and <window-virtualizer> Marko tags.
 *
 * @marko/testing-library v1.1.2 has a broken isV6 detection:
 *   const isV6 = !(template as any).renderSync
 * Marko 6 browser-compiled templates include renderSync from the runtime,
 * causing the library to fall into the Marko 3/4 code path and call
 * template.render(input, callback) — which doesn't exist on browser templates.
 *
 * We bypass @marko/testing-library entirely and call template.mount() directly,
 * which is the Marko 6 DOM API. @marko/vite compiles .marko files for the
 * browser in vitest/jsdom, so mount() is always available.
 *
 * ENVIRONMENT:
 * - jsdom with rAF, ResizeObserver, offsetHeight mocked (see tests/setup.ts)
 * - @marko/vite compiles .marko fixtures → browser templates with mount()
 * - waitFor() retries until Marko's RAF-based reactive flush completes
 *
 * WHY THESE TESTS EXIST:
 * The TS unit tests in index.test.ts never compile or mount a .marko file.
 * The <return> vs <${input.content}> architecture bug was invisible to them.
 * These tests close that gap by mounting real fixture components and asserting
 * that virtual items appear in the DOM.
 */

import { afterEach, describe, expect, test } from "vitest"
import { waitFor } from "@testing-library/dom"
import VirtualizerFixture from "./fixtures/virtualizer-fixture.marko"
import WindowVirtualizerFixture from "./fixtures/window-virtualizer-fixture.marko"

// Cast to any — @marko/vite compiles .marko files as ES modules whose default
// export is the template object with mount(input, container): Instance.
const Virtualizer = VirtualizerFixture as any
const WindowVirtualizer = WindowVirtualizerFixture as any

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function mountFixture(Template: any, input: Record<string, unknown> = {}) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  Template.mount(input, container)
  return container
}

afterEach(() => {
  // Reset DOM between tests
  document.body.innerHTML = ""
})

// ---------------------------------------------------------------------------
// <virtualizer> — row virtualisation
// ---------------------------------------------------------------------------

describe("<virtualizer> rows", () => {
  test("renders body content — catches <return> vs <${input.content}> bug", () => {
    // With <return=...>:        body never renders → virtual-wrapper missing
    // With <${input.content}>:  body IS rendered   → virtual-wrapper present
    // This test definitively catches the architecture bug.
    const el = mountFixture(Virtualizer, { count: 100 })
    expect(el.querySelector("[data-testid='virtual-wrapper']")).toBeTruthy()
  })

  test("populates virtualItems after mount", async () => {
    // onMount fires → _willUpdate → observeElementRect (sync, mocked 400px)
    // → notify() → items signal → Marko RAF flush → DOM updated
    const el = mountFixture(Virtualizer, { count: 100 })
    await waitFor(() =>
      expect(el.querySelectorAll("[data-testid='virtual-item']").length).toBeGreaterThan(0)
    )
  })

  test("items have sequential data-index starting from 0", async () => {
    const el = mountFixture(Virtualizer, { count: 100 })
    await waitFor(() => {
      const items = el.querySelectorAll("[data-testid='virtual-item']")
      expect(items[0].getAttribute("data-index")).toBe("0")
      expect(items[1].getAttribute("data-index")).toBe("1")
    })
  })

  test("totalSize equals count × estimateSize in px", async () => {
    const el = mountFixture(Virtualizer, { count: 100, itemHeight: 50 })
    await waitFor(() =>
      expect(
        (el.querySelector("[data-testid='virtual-wrapper']") as HTMLElement)?.style.height
      ).toBe("5000px")
    )
  })

  test("renders exactly count items when count < viewport capacity", async () => {
    // 3 items × 50px = 150px < 400px mocked viewport → all 3 rendered
    const el = mountFixture(Virtualizer, { count: 3 })
    await waitFor(() =>
      expect(el.querySelectorAll("[data-testid='virtual-item']")).toHaveLength(3)
    )
  })

  test("renders no items when count is 0", () => {
    const el = mountFixture(Virtualizer, { count: 0 })
    // Wrapper exists (body content rendered) but no items
    expect(el.querySelector("[data-testid='virtual-wrapper']")).toBeTruthy()
    expect(el.querySelectorAll("[data-testid='virtual-item']")).toHaveLength(0)
  })

  test("totalSize is 0 when count is 0", () => {
    const el = mountFixture(Virtualizer, { count: 0 })
    const wrapper = el.querySelector("[data-testid='virtual-wrapper']") as HTMLElement
    expect(wrapper?.style.height).toBe("0px")
  })
})

// ---------------------------------------------------------------------------
// <virtualizer> — column virtualisation
// ---------------------------------------------------------------------------

describe("<virtualizer> columns", () => {
  test("horizontal mode renders items with translateX positioning", async () => {
    const el = mountFixture(Virtualizer, { count: 100, horizontal: true })
    await waitFor(() => {
      const items = el.querySelectorAll("[data-testid='virtual-item']")
      expect(items.length).toBeGreaterThan(0)
      expect((items[0] as HTMLElement).style.transform).toContain("translateX(0px)")
    })
  })
})

// ---------------------------------------------------------------------------
// <virtualizer> — masonry lanes
// ---------------------------------------------------------------------------

describe("<virtualizer> lanes", () => {
  test("multi-lane layout renders items", async () => {
    const el = mountFixture(Virtualizer, { count: 20, lanes: 3 })
    await waitFor(() =>
      expect(el.querySelectorAll("[data-testid='virtual-item']").length).toBeGreaterThan(0)
    )
  })
})

// ---------------------------------------------------------------------------
// <window-virtualizer>
// ---------------------------------------------------------------------------

describe("<window-virtualizer>", () => {
  test("renders body content", () => {
    const el = mountFixture(WindowVirtualizer, { count: 100 })
    expect(el.querySelector("[data-testid='virtual-wrapper']")).toBeTruthy()
  })

  test("populates virtualItems after mount", async () => {
    const el = mountFixture(WindowVirtualizer, { count: 100 })
    await waitFor(() =>
      expect(el.querySelectorAll("[data-testid='virtual-item']").length).toBeGreaterThan(0)
    )
  })

  test("items have data-index starting from 0", async () => {
    const el = mountFixture(WindowVirtualizer, { count: 100 })
    await waitFor(() =>
      expect(
        el.querySelectorAll("[data-testid='virtual-item']")[0].getAttribute("data-index")
      ).toBe("0")
    )
  })
})