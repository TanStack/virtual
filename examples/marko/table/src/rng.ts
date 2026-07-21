// mulberry32 PRNG factory. Kept in a plain .ts module on purpose: the `>>>`
// unsigned right-shift operators trip Marko's template parser when written inside
// a `static` block (its tag scanner misreads the `>`), whereas TypeScript compiles
// them without issue. Returns a deterministic `() => number` in [0, 1).
export function mulberry32(seed: number): () => number {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
