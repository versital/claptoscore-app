import { allowedDivs, complexityFor, COMPLEXITY_SIMPLE, COMPLEXITY_COMPOUND, COMPLEXITY_EXT_SIMPLE, COMPLEXITY_EXT_COMPOUND,
  SIGMA_MS, SPANS, COMPLEXITY_SPAN, EMPTY_SLOT_COST, MIN_FILL, TUPLET_GAIN } from './meters.js';
import { tupletOf } from './tuplets.js';

const CX_SIMPLE = { ...COMPLEXITY_EXT_SIMPLE, ...COMPLEXITY_SIMPLE };
const CX_COMPOUND = { ...COMPLEXITY_EXT_COMPOUND, ...COMPLEXITY_COMPOUND };

// Pick a subdivision per beat that balances timing error against rhythmic complexity.
// p: tap positions in beats. Taps in different voices may share a grid point; taps in the same voice may not.
// Returns q (snapped positions), grid (beat -> chosen subdivision, single-beat cells) and the total cost.
// With o.tuplets it also tries the extended divisions and tuplets spanning several beats, and returns
// cells (beat -> { b0, span, s }) for every beat it covers, spans included.
export function quantize(p, M, o, beatMs, voices) {
  const divs = allowedDivs(M, o), maxS = Math.max(...divs), h = 0.5 / maxS;
  const cx = !M.compound && M.tpb !== 12 ? complexityFor(M, o.tuplets)
    : o.tuplets ? (M.compound ? CX_COMPOUND : CX_SIMPLE) : (M.compound ? COMPLEXITY_COMPOUND : COMPLEXITY_SIMPLE);
  const byBeat = new Map();
  p.forEach((x, i) => { const b = Math.floor(x + h); if (!byBeat.has(b)) byBeat.set(b, []); byBeat.get(b).push(i); });
  const q = new Array(p.length), grid = new Map();
  // empty tuplet slots cost in proportion to Simplicity, so at 0 (shared links: exact) only the timing counts
  const empty = EMPTY_SLOT_COST * o.simplicity / 3, ratio = TUPLET_GAIN, minFill = MIN_FILL;

  // snap the taps idx to n equal slots over `span` beats from beat b0; returns { cost, miss, snaps, filled }
  // (miss = the timing part of the cost, collisions included)
  const fit = (idx, b0, n, span, base) => {
    let cost = base;
    const seen = new Set(), slots = new Set(), w = n / span, step = span / n;
    const snaps = idx.map(i => {
      const k = Math.max(0, Math.min(n, Math.round((p[i] - b0) * w)));
      const at = span === 1 ? b0 + k / n : b0 + k * step;
      const err = (p[i] - at) * beatMs / SIGMA_MS;
      cost += err * err;
      const key = (voices ? voices[i] : 1) + ':' + k;
      if (seen.has(key)) cost += 40; seen.add(key);
      if (k < n) slots.add(k);
      return at;
    });
    return { cost, miss: cost - base, snaps, filled: slots.size };
  };
  const single = new Map();  // beat -> { s, cost, snaps, plainMiss }
  for (const [b, idx] of byBeat) {
    let best = null, plainMiss = Infinity;
    for (const s of divs) {
      let r;
      if (!o.tuplets) {
        // the original per-beat loop, kept verbatim so results stay identical without the Tuplets option
        let cost = o.simplicity * cx[s];
        const seen = new Set();
        const snaps = idx.map(i => {
          const k = Math.max(0, Math.min(s, Math.round((p[i] - b) * s)));
          const err = (p[i] - (b + k / s)) * beatMs / SIGMA_MS;
          cost += err * err;
          const key = (voices ? voices[i] : 1) + ':' + k;
          if (seen.has(key)) cost += 40; seen.add(key);
          return b + k / s;
        });
        r = { cost, snaps };
      } else {
        r = fit(idx, b, s, 1, o.simplicity * cx[s]);
        if (s !== 3 && tupletOf(M, s)) {
          // a tuplet must be well filled and fit the taps clearly better than any plain reading
          // (plain divisions come first in divs, so plainMiss is known here)
          if (r.filled < minFill * s || r.miss > ratio * plainMiss) continue;
          r.cost += empty * (s - r.filled);
        } else plainMiss = Math.min(plainMiss, r.miss);
      }
      if (!best || r.cost < best.cost) best = { s, cost: r.cost, snaps: r.snaps, plainMiss };
    }
    best.plainMiss = plainMiss;
    single.set(b, best);
  }

  if (!o.tuplets) {
    let total = 0;
    for (const [b, idx] of byBeat) {
      const best = single.get(b);
      grid.set(b, best.s); total += best.cost;
      idx.forEach((i, j) => { q[i] = best.snaps[j]; });
    }
    return { q, grid, total };
  }

  // Tuplets on: choose, left to right, between single beats and tuplets spanning 2 or 4 beats of one bar.
  // f[b] = cheapest way to write beats b..last; on (near-)equal cost the span wins (one bracket, not several).
  const cells = new Map();
  let total = 0;
  if (!byBeat.size) return { q, grid, total, cells };
  const beats = [...byBeat.keys()], lo = Math.min(...beats), hi = Math.max(...beats);
  const f = new Map([[hi + 1, 0]]), choice = new Map();
  const at = b => f.get(b) ?? 0;  // beyond the last tapped beat nothing costs anything
  for (let b = hi; b >= lo; b--) {
    const sb = single.get(b);
    let best = { cost: (sb ? sb.cost : 0) + at(b + 1), span: 1 };
    if (!M.compound) {
      const inBar = ((b % M.beats) + M.beats) % M.beats;
      for (const [span, n] of SPANS) {
        if (inBar + span > M.beats) continue;
        const idx = [];
        let plain = 0;
        for (let k = 0; k < span; k++) { const t = byBeat.get(b + k); if (t) { idx.push(...t); plain += single.get(b + k).plainMiss; } }
        if (!idx.length) continue;
        const r = fit(idx, b, n, span, o.simplicity * COMPLEXITY_SPAN[span + ':' + n]);
        // (3 over 2 or 4 beats sits on the eighth-triplet grid, so it only competes on simplicity)
        if (r.filled < minFill * n || (n !== 3 && r.miss > ratio * plain)) continue;
        const cost = r.cost + empty * (n - r.filled) + at(b + span);
        if (cost <= best.cost + 1e-9) best = { cost, span, n, idx, snaps: r.snaps };
      }
    }
    f.set(b, best.cost); choice.set(b, best);
  }
  for (let b = lo; b <= hi;) {
    const c = choice.get(b);
    if (c.span === 1) {
      const sb = single.get(b);
      if (sb) {
        grid.set(b, sb.s); total += sb.cost; cells.set(b, { b0: b, span: 1, s: sb.s });
        byBeat.get(b).forEach((i, j) => { q[i] = sb.snaps[j]; });
      }
      b++;
    } else {
      const cell = { b0: b, span: c.span, s: c.n };
      for (let k = 0; k < c.span; k++) cells.set(b + k, cell);
      c.idx.forEach((i, j) => { q[i] = c.snaps[j]; });
      total += c.cost - at(b + c.span);
      b += c.span;
    }
  }
  return { q, grid, total, cells };
}
