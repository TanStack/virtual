// Deterministic pseudo-random sizes (mulberry32). Kept in a plain .ts module on
// purpose: the `>>>` unsigned right-shift operators in the algorithm trip Marko's
// template parser when written inside a `static` block (its tag scanner misreads
// the `>`), whereas TypeScript compiles them without issue. The React example uses
// Math.random(); these examples are server-rendered, so server and client must
// derive the SAME sizes and the e2e assertions stay stable.
export function seededSizes(
  count: number,
  base: number,
  spread: number,
  seed: number,
): number[] {
  let t = seed
  return Array.from({ length: count }, () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    const unit = ((r ^ (r >>> 14)) >>> 0) / 4294967296
    return base + Math.round(unit * spread)
  })
}
