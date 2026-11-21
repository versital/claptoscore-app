import { METERS } from './meters.js';
import { quantize } from './quantize.js';
import { fitLine } from './stats.js';

// Free tempo: find the pulse in the taps.
// Try tempi on a 1% grid and six first-tap phases; score each by how well the taps quantise
// (same cost as the notation step) plus a prior towards moderate tempi, then refine by regression.
//
// taps     raw taps [{t, up, v, src}] on the performance.now() clock
// meter    meter id
// opt      clean-up options (simplicity etc.)
// lat      { key, mic } latency in ms
// hintBpm  the Tempo hint (number) or null
export function inferFreeTake(taps, meter, { opt, lat, hintBpm = null }) {
  const M = METERS[meter], o = opt;
  const first = taps[0].t;
  const latOf = x => x.src === 'mic' ? lat.mic : lat.key;
  const rel = taps.map(x => ({ ...x, r: x.t - first, ru: x.up === null ? null : x.up - first }));
  const tc = rel.map(x => x.r - latOf(x) + latOf(rel[0]));
  const win = tc.filter(t => t < 12000);
  if (tc.length < 3) return null;
  const hint = hintBpm, ref = hint || 100;
  const lo = hint ? hint * 0.8 : 40, hi = hint ? hint * 1.25 : 220;
  // the tempo search scores on the plain grid: tuplets fit almost anything and would blur the choice of tempo
  const qo = { ...o, finest: 2, triplets: !M.compound, tuplets: false };
  let best = null;
  for (let bpm = lo; bpm <= hi; bpm *= 1.01) {
    const P = 60000 / bpm;
    const prior = win.length * (hint ? 0.3 : 0.8) * (Math.log2(bpm / ref) / 0.5) ** 2;
    for (const c of [0, 0.5, 0.25, 0.75, 1 / 3, 2 / 3]) {
      const { total } = quantize(win.map(t => t / P + c), M, qo, P);
      const cost = total + prior + (c ? 1.5 : 0);
      if (!best || cost < best.cost) best = { bpm, c, cost };
    }
  }
  const P = 60000 / best.bpm;
  const Q = quantize(tc.map(t => t / P + best.c), M, qo, P);
  const f = fitLine(Q.q, tc, null, 0, P);
  const shift = f.a + (best.c > 0 ? f.b : 0); // a pickup lands in the bar before the first downbeat
  return {
    bpm: Math.round(600000 / f.b) / 10, meter, source: 'user', free: true,
    taps: rel.map(x => ({ t: x.r - shift, up: x.ru === null ? null : x.ru - shift, v: x.v, src: x.src })),
  };
}
