// Ambient type declaration for .marko template imports.
// @marko/vite compiles .marko files to browser templates exposing mount().
// The full Marko.Template type is available via the marko package but
// requires the Marko language toolchain. For test imports we declare the
// minimal shape we actually use.
declare module "*.marko" {
  const template: {
    mount(
      input: Record<string, unknown>,
      container: Element | DocumentFragment,
    ): { destroy(): void }
  }
  export default template
}

// Type declaration for @marko/vite plugin.
// The actual package may ship its own types; this is a fallback.
declare module "@marko/vite" {
  import type { Plugin } from "vite"
  function marko(options?: Record<string, unknown>): Plugin
  export default marko
}