import { METERS } from './meters.js';
import { quantize } from './quantize.js';
import { fitLine, localFits } from './stats.js';
import { scaleFor } from './tuplets.js';

// A shared rhythm (from a link) arrives as taps that sit exactly on the grid; these settings write it back
// exactly as it was sent, whatever the clean-up controls say. EXACT is the original app's, used for version-1 links,
// so they open exactly as before. Version-2 links (tuplets, 32nds) add EXACT_EXT: a tiny simplicity breaks ties
// between equally exact readings towards the plainer one.
export const EXACT = { finest: 2, triplets: true, tuplets: false, simplicity: 0, tempoMode: 'off', lengths: 'held', maxLen: '0', debounce: 0 };
export const EXACT_EXT = { finest: 3, tuplets: true, simplicity: 0.01 };

// Default clean-up options (the Fine-tune panel).
// tuplets: also detect 5-, 6-, 7-, 9- … 13-lets, duplets/quadruplets in compound meters and tuplets over 2 or 4 beats.
export const DEFAULT_OPT = { finest: 2, triplets: true, tuplets: true, simplicity: 3, tempoMode: 'follow', lengths: 'next', maxLen: '0', debounce: 60 };

/**
 * Turn a take into notation data.
 * R   take: { bpm, meter, taps: [{t, up, v, src, excluded?}], barShift?, exact?, liveBeat? } (times in ms from the downbeat)
 * o   clean-up options (see DEFAULT_OPT)
 * lat latency per input: { key, mic } in ms
 * Returns the analysis object "A" used by every renderer and exporter.
 */
export function analyze(R, o, lat) {
  if (R.exact) o = R.exact === 'ext' ? { ...o, ...EXACT, ...EXACT_EXT } : { ...o, ...EXACT };
  const M = METERS[R.meter], beatMs = 60000 / R.bpm;
  const shift = (R.barShift || 0) * beatMs;
  // 1. clean the raw taps (latency per input, double taps per voice)
  const all = R.taps.map((x, i) => {
    const L = x.src === 'exact' ? 0 : x.src === 'mic' ? lat.mic : lat.key;
    return { ...x, i, v: x.v || 1, t: x.t - L + shift, up: x.up == null ? null : x.up - L + shift };
  }).sort((a, b) => a.t - b.t);
  const used = [], dropped = [], lastBy = {};
  for (const x of all) {
    if (x.excluded) { dropped.push({ ...x, why: 'excluded' }); continue; }
    const prev = lastBy[x.v];
    if (prev && x.t - prev.t < o.debounce) {
      dropped.push({ ...x, why: 'double' });
      if (x.up !== null) prev.up = Math.max(prev.up ?? 0, x.up);
      continue;
    }
    const u = { ...x }; used.push(u); lastBy[x.v] = u;
  }
  if (!used.length) return { empty: true, M, R, all, dropped };
  const ts = used.map(x => x.t), vs = used.map(x => x.v);

  // 2. quantise, then refit the beat grid to the taps and quantise again
  // With tuplets the tempo is first refitted on the plain grid (so a tuplet cannot soak up ordinary tempo drift and
  // have each refit lock it in), then the tuplets are chosen and the fit is refined a few more times with them
  // (so a real tuplet does not stay bent by the plain-grid fit).
  const qo = o.tuplets ? { ...o, tuplets: false } : o;
  let fits = used.map(() => ({ a: 0, b: beatMs }));
  // A version-2 shared rhythm also states where each note ends; those ends join the choice of each beat's division
  // (as points in a voice of their own), so a held end in a beat without onsets reopens where it was written.
  const ghosts = R.exact === 'ext' ? used.filter(x => x.up !== null).map(x => x.up / beatMs) : [];
  const qz = (pp, opt) => {
    if (!ghosts.length) return quantize(pp, M, opt, beatMs, vs);
    const G = quantize([...pp, ...ghosts], M, opt, beatMs, [...vs, ...ghosts.map((_, i) => 'end' + i)]);
    G.q = G.q.slice(0, pp.length);
    return G;
  };
  let p = ts.map(t => t / beatMs), Q = qz(p, qo);
  const refit = (opt, rounds) => {
    const W = Math.max(4, M.beats);
    for (let iter = 0; iter < rounds; iter++) {
      const qs = Q.q;
      if (o.tempoMode === 'steady') { const f = fitLine(qs, ts, null, 0, beatMs); fits = used.map(() => f); }
      else fits = o.tuplets ? localFits(qs, ts, W, beatMs) : qs.map(qc => fitLine(qs, ts, qc, W, beatMs));
      p = ts.map((t, i) => (t - fits[i].a) / fits[i].b);
      const Q2 = qz(p, opt);
      const same = Q2.q.every((v, i) => v === Q.q[i]);
      Q = Q2;
      if (same) break;
    }
  };
  const fitting = o.tempoMode !== 'off' && used.length >= 3;
  if (fitting) refit(qo, 5);
  if (o.tuplets) {
    Q = qz(p, o); if (fitting) refit(o, 3);
    // A take made mostly of tuplets can be bent by the plain-grid fit above. So also run the fit with tuplets from
    // the start, and keep that reading only when it explains the taps clearly better (by more than Simplicity):
    // a small gain is more often tempo drift than a real tuplet. (Skipped for the provisional score while recording.)
    if (fitting && R.liveBeat == null) {
      const plainFirst = { Q, p, fits };
      fits = used.map(() => ({ a: 0, b: beatMs })); p = ts.map(t => t / beatMs); Q = qz(p, o); refit(o, 5);
      if (!(Q.total < plainFirst.Q.total - o.simplicity)) ({ Q, p, fits } = plainFirst);
    }
  }
  const globalFit = fitLine(Q.q, ts, null, 0, beatMs);
  // tick resolution: 12 per quarter, times u when a tuplet or 32nds need a finer grid (see core/tuplets.js)
  const cells = Q.cells, u = scaleFor(M, cells || new Map([...Q.grid].map(([b, s]) => [b, { b0: b, span: 1, s }])));
  const tpb = M.tpb * u, barTicks = M.beats * tpb;
  const cellOf = b => cells ? cells.get(b) : undefined;

  // 3. onsets on the tick grid, merging collisions within a voice
  const defaultS = M.compound ? 3 : (o.finest >= 1 ? 2 : 1);
  const slotAt = tick => { const c = cellOf(Math.floor(tick / tpb)); return c ? c.span * tpb / c.s : tpb / (Q.grid.get(Math.floor(tick / tpb)) || defaultS); };
  const onsetsBy = { 1: [], 2: [] };
  let merged = 0;
  used.forEach((x, i) => {
    const tick = Math.round(Q.q[i] * tpb);
    x.q = Q.q[i]; x.tick = tick; x.dev = x.t - (fits[i].a + fits[i].b * Q.q[i]); x.devClick = x.t - Q.q[i] * beatMs; x.fit = fits[i];
    const list = onsetsBy[x.v];
    if (list.length && list[list.length - 1].tick === tick) { merged++; x.mergedInto = true; return; }
    list.push(x);
  });

  // 4. note lengths, per voice
  // drum parts read best as short values, so two voices cap "no limit" at one beat
  // (not for a shared rhythm, which states its own lengths: the original app cut those at a beat too)
  const drums = !R.exact && onsetsBy[1].length > 0 && onsetsBy[2].length > 0;
  const capTicks = o.maxLen === '0' ? (drums ? tpb : Infinity) : o.maxLen === 'bar' ? barTicks : (+o.maxLen) * tpb;
  let nid = 0;
  const notesFor = onsets => onsets.map((x, k) => {
    const start = x.tick, next = k + 1 < onsets.length ? onsets[k + 1].tick : null;
    let end;
    const c = cellOf(Math.floor(start / tpb));
    if (o.lengths === 'held' && x.up !== null) {
      const pr = (x.up - x.fit.a) / x.fit.b, b = Math.floor(pr), cr = cellOf(b);
      if (cr && cr.span > 1) end = Math.round((cr.b0 + Math.round((pr - cr.b0) * cr.s / cr.span) * cr.span / cr.s) * tpb);
      else { const s = cr ? cr.s : Q.grid.get(b) || defaultS; end = Math.round((b + Math.round((pr - b) * s) / s) * tpb); }
      end = Math.max(end, start + slotAt(start));
    } else end = next ?? (c ? (c.b0 + c.span) * tpb : (Math.floor(start / tpb) + 1) * tpb);
    if (next !== null) end = Math.min(end, next);
    // a note inside a multi-beat tuplet may last to the end of that tuplet
    end = Math.min(end, c && c.span > 1 ? Math.max((c.b0 + c.span) * tpb, c.b0 * tpb + capTicks) : Math.floor(start / tpb) * tpb + capTicks);
    return { start, end, id: nid++, v: x.v };
  });
  const voiceIds = onsetsBy[2].length ? (onsetsBy[1].length ? [1, 2] : [2]) : [1];
  const notesByVoice = voiceIds.map(v => notesFor(onsetsBy[v]));
  const notes = notesByVoice.flat();

  // 5. fill the bars with notes and rests (shared bar range across voices)
  const startBar = Math.floor(Math.min(...notes.map(n => n.start)) / barTicks);
  let endBar = Math.max(startBar + 1, Math.ceil(Math.max(...notes.map(n => n.end)) / barTicks));
  if (R.liveBeat != null) endBar = Math.max(endBar, Math.floor(R.liveBeat / M.beats) + 1);
  const voices = notesByVoice.map((vn, k) => {
    const segs = []; let cur = startBar * barTicks;
    for (const n of vn) {
      if (n.start > cur) segs.push({ start: cur, end: n.start, rest: true });
      segs.push({ ...n, rest: false }); cur = n.end;
    }
    if (cur < endBar * barTicks) segs.push({ start: cur, end: endBar * barTicks, rest: true });
    return { v: voiceIds[k], notes: vn, segs };
  });

  const devs = used.filter(x => !x.mergedInto).map(x => Math.abs(x.dev));
  const devClick = used.map(x => Math.abs(x.devClick));
  return {
    M, R, o, beatMs, tpb, barTicks, startBar, endBar, grid: Q.grid, cells, used, dropped, all, notes, voices, merged,
    twoVoice: voices.length > 1 || voiceIds[0] === 2,
    meanDev: devs.reduce((a, b) => a + b, 0) / devs.length,
    meanDevClick: devClick.reduce((a, b) => a + b, 0) / devClick.length,
    playedBpm: 60000 / globalFit.b,
  };
}
