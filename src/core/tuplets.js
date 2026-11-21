// Tuplet helpers shared by analysis and the writers.
//
// A "cell" is the unit the quantiser divides evenly: { b0, span, s } = s equal notes over `span` beats starting at
// beat b0. Plain beats are cells with span 1. The analysis keeps them in A.cells (Map beat -> cell, one entry per
// covered beat) when the Tuplets option is on; without it, A.grid (Map beat -> s) is the only source.
//
// Ticks: an analysis normally has 12 ticks per quarter (A.tpb = M.tpb). Tuplets such as 5- or 7-lets do not fit
// that grid, so the analysis multiplies the resolution by a factor u (A.tpb = M.tpb * u) just large enough that
// every chosen cell lands on whole ticks. u = 1 whenever only the original divisions are used.

const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
export const lcm = (a, b) => a / gcd(a, b) * b;

const PLAIN_SIMPLE = new Set([1, 2, 4, 8]), PLAIN_COMPOUND = new Set([1, 3, 6, 12]);

// How a cell is written: null for plain notes, or { p, q } = p notes in the time of q (the written value of one
// tuplet note is span beats / q). Simple meters: q = largest power of two <= p (3:2, 5:4, 6:4, 7:4, 9..15:8).
// Compound meters (beat = 3 eighths): 2:3 and 4:3 eighths, 5:3, 7..11:6 sixteenths, 13:12 thirty-seconds.
export function tupletOf(M, s, span = 1) {
  if (span === 1 && (M.compound ? PLAIN_COMPOUND : PLAIN_SIMPLE).has(s)) return null;
  if (!M.compound) return { p: s, q: 2 ** Math.floor(Math.log2(s)) };
  if (s === 2) return { p: 2, q: 3 };
  let q = 3; while (q * 2 <= s) q *= 2;
  return { p: s, q };
}

// Smallest resolution factor that puts every cell's notes, and the written values inside it, on whole ticks.
export function scaleFor(M, cells) {
  let u = 1;
  if (!cells) return u;
  const seen = new Set();
  for (const c of cells.values()) {
    const key = c.s + ':' + c.span;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = tupletOf(M, c.s, c.span);
    let k = 1;
    const ok = k => {
      const span = c.span * M.tpb * k;
      if (span % c.s) return false;
      return !t || (span % t.q === 0 && (M.tpb * k * c.s) % t.q === 0);
    };
    while (!ok(k)) k++;
    u = lcm(u, k);
  }
  return u;
}

// The cell covering a beat: from A.cells when present, else a plain cell from A.grid (or undefined).
export function cellAt(A, beat) {
  if (A.cells) return A.cells.get(beat);
  const s = A.grid.get(beat);
  return s ? { b0: beat, span: 1, s } : undefined;
}

// A cell that is not one of the original divisions (so a v1 rhythm code could not carry it).
export const isExtended = (M, c) => c.span > 1 || (M.compound ? ![1, 3, 6].includes(c.s) : ![1, 2, 3, 4].includes(c.s));
