import { vi } from "vitest"

// ---------------------------------------------------------------------------
// requestAnimationFrame — not available in jsdom.
// Marko 6's scheduler uses rAF. Without this, signal-driven DOM updates
// never flush and items never appear after onMount.
// ---------------------------------------------------------------------------
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(cb, 16) as unknown as number
  global.cancelAnimationFrame = (id: number) => clearTimeout(id)
}

// ---------------------------------------------------------------------------
// ResizeObserver — not available in jsdom.
// observeElementRect sets one up, but also fires handler() synchronously
// first (giving us the initial rect). The mock prevents errors on .observe().
// ---------------------------------------------------------------------------
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// ---------------------------------------------------------------------------
// offsetHeight / offsetWidth — always 0 in jsdom (no CSS layout engine).
// observeElementRect calls getRect(element) = { offsetWidth, offsetHeight }.
// Without this, the virtualizer sees a 0-height viewport and renders no items.
// 400px ÷ 50px default estimateSize = 8 visible + 5 overscan each side ≈ 18.
// ---------------------------------------------------------------------------
Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get: () => 400,
})
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get: () => 400,
})