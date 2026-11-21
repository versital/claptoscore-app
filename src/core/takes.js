import { METERS } from './meters.js';
import { MAX_BARS, MAX_NOTES, MAX_CODE, encode, decode } from './rhythmCode.js';
import { isExtended } from './tuplets.js';
import { analyze } from './analyze.js';

// Take = the raw material the analysis works on:
// { bpm, meter, taps: [{t, up, v, src, excluded?}], source: 'user'|'shared'|'example', free?, exact?, title?, barShift? }

// The demo take shown on first visit: a 4/4 rhythm with human jitter, slight rushing and a late offset.
export function exampleTake(latency = 0) {
  const bpm = 96, beatMs = 60000 / bpm;
  const pos = [0, 1, 1.5, 2, 3, 4, 4.5, 4.75, 5, 6, 6.5, 8, 8 + 1 / 3, 8 + 2 / 3, 9, 10, 11.5, 12, 14];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  const taps = pos.map((p, i) => {
    const t = p * beatMs * (1 - 0.012 * p / 16) + rnd() * 44 + 22 + latency;
    const ioi = ((pos[i + 1] ?? p + 2) - p) * beatMs;
    return { t, up: t + Math.min(ioi * 0.7, 90 + ioi * 0.5), v: 1, src: 'key' };
  });
  return { bpm, meter: '4/4', taps, source: 'example' };
}

// A shared rhythm as a take: taps exactly on the grid, analysed with the EXACT settings.
export function takeFromRhythm(r) {
  const M = METERS[r.meter], beatMs = 60000 / r.bpm, tpb = M.tpb * (r.u || 1), ms = t => t / tpb * beatMs, two = r.voices.length > 1;
  const taps = [];
  r.voices.forEach((v, k) => v.forEach(n => taps.push({ t: ms(n.start), up: ms(n.end), v: two && k === 1 ? 2 : 1, src: 'exact' })));
  taps.sort((a, b) => a.t - b.t);
  // version-2 links (they carry u) are read with the tuplet rules; version 1 exactly as the original app read them
  return { bpm: r.bpm, meter: r.meter, taps, source: 'shared', exact: r.u !== undefined ? 'ext' : true, title: r.title || '' };
}

// The written rhythm of an analysis, in rhythm-code form (for share links). Cut to MAX_BARS, and to fewer bars when
// the link would hold more than MAX_NOTES notes or be longer than the decoder accepts (dense tuplets, 32nds).
// exactCheck: a version-1 link reopens with the original app's rules, which can move a held note's end (an end in a
// beat with no note of its own snaps to a coarser grid); when it would, the link uses version 2 instead.
export function rhythmOf(A, { title = '', hide = false, exactCheck = true } = {}) {
  const origin = A.startBar * A.barTicks, total = A.endBar - A.startBar, u = A.tpb / A.M.tpb;
  // tuplets, 32nds or any non-original division: the link uses rhythm-code version 2, which reopens with the
  // tuplet rules (version 1 would reopen a quarter-note triplet as tied eighth triplets)
  const v2 = u > 1 || (A.cells && [...A.cells.values()].some(c => isExtended(A.M, c)));
  const make = bars => {
    const maxEnd = origin + bars * A.barTicks;
    const pick = v => (A.voices.find(x => x.v === v)?.notes || []).filter(n => n.start < maxEnd)
      .map(n => ({ start: n.start - origin, end: Math.min(n.end, maxEnd) - origin }));
    const r = {
      meter: A.R.meter, bpm: Math.round(A.R.bpm), voices: A.twoVoice ? [pick(1), pick(2)] : [pick(A.voices[0].v)],
      title, hide, cut: total > bars, bars: Math.min(bars, total),  // bars: how many the link holds
    };
    if (v2) r.u = u;
    return r;
  };
  let bars = MAX_BARS, r = make(bars);
  const fits = r => r.voices.flat().length <= MAX_NOTES && encode(r).length <= MAX_CODE[r.u !== undefined ? 2 : 1];
  while (bars > 1 && !fits(r)) r = make(--bars);
  if (exactCheck && r.u === undefined && !reopensAs(r, A.tpb)) {
    r.u = u;
    while (bars > 1 && !fits(r)) { r = make(--bars); r.u = u; }
  }
  return r;
}

// Does the link for r (ticks at resolution tpb) reopen with exactly these notes?
function reopensAs(r, tpb) {
  let B;
  try { B = analyze(takeFromRhythm(decode(encode(r))), {}, { key: 0, mic: 0 }); } catch { return false; }
  if (B.empty) return false;
  const want = r.voices.map(v => [...v].sort((a, b) => a.start - b.start).map(n => n.start / tpb + '-' + n.end / tpb).join());
  const got = (r.voices.length > 1 ? [1, 2] : [B.voices[0].v]).map(v => (B.voices.find(x => x.v === v)?.notes || [])
    .map(n => (n.start - B.startBar * B.barTicks) / B.tpb + '-' + (n.end - B.startBar * B.barTicks) / B.tpb).join());
  return want.every((w, k) => w === got[k]);
}
