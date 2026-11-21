// Rhythm practice: random rhythms by difficulty level, and scoring a played run against them. Pure, no DOM.
//
// A generated rhythm is a rhythm-code object ({ meter, bpm, voices: [[{ start, end }]], u }), so the existing
// writers (rhythmCode.toAbc, exercise) draw it. Rhythms are built from beat patterns: a pattern covers `b` beats,
// cut into `d` slots per beat, and lists its notes as [slot, length in slots]; gaps are rests.
import { METERS } from './meters.js';

const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => a / gcd(a, b) * b;
const P = (b, d, n) => ({ b, d, n });
const all = d => P(1, d, Array.from({ length: d }, (_, k) => [k, 1]));

// Pattern groups. Simple meters: the beat is a quarter note. Compound meters: the beat is a dotted quarter.
// level: the level that introduces the group (a level plays every group up to it, favouring its own).
export const GROUPS = {
  simple: [
    { id: 'basic', level: 1, name: 'Whole, half and quarter notes', p: [P(1, 1, [[0, 1]]), P(1, 1, []), P(2, 1, [[0, 2]]), P(3, 1, [[0, 3]]), P(4, 1, [[0, 4]])] },
    { id: 'eighths', level: 2, name: 'Eighth notes', p: [all(2), all(2), P(1, 2, [[1, 1]]), P(1, 2, [[0, 1]])] },
    { id: 'triplets', level: 3, name: 'Triplets', p: [all(3)] },
    { id: 'dottedQ', level: 3, name: 'Dotted quarters', p: [P(2, 2, [[0, 3], [3, 1]])] },
    { id: 'syncopation', level: 3, name: 'Syncopation', p: [P(2, 2, [[0, 1], [1, 2], [3, 1]]), P(2, 2, [[1, 2], [3, 1]])] },
    { id: 'sixteenths', level: 4, name: 'Sixteenths', p: [all(4), P(1, 4, [[0, 2], [2, 1], [3, 1]]), P(1, 4, [[0, 1], [1, 1], [2, 2]]), P(1, 4, [[0, 1], [1, 2], [3, 1]])] },
    { id: 'ties', level: 4, name: 'Ties', p: [P(2, 4, [[0, 2], [2, 1], [3, 3], [6, 2]]), P(2, 2, [[0, 1], [1, 3]]), P(2, 4, [[0, 1], [1, 1], [2, 4], [6, 2]])] },
    { id: 'dottedE', level: 5, name: 'Dotted eighths', p: [P(1, 4, [[0, 3], [3, 1]]), P(1, 4, [[0, 1], [1, 3]])] },
    { id: 'sixteenthRests', level: 5, name: 'Sixteenth rests', p: [P(1, 4, [[1, 1], [2, 1], [3, 1]]), P(1, 4, [[0, 1], [2, 1], [3, 1]]), P(1, 4, [[0, 1], [1, 1], [3, 1]]), P(1, 4, [[0, 2], [3, 1]])] },
    { id: 'sextuplets', level: 6, name: 'Sextuplets', p: [all(6)] },
    { id: 'quarterTriplets', level: 6, name: 'Quarter triplets', p: [P(2, 3, [[0, 2], [2, 2], [4, 2]])] },
    { id: 'sixteenthTriplets', level: 6, name: 'Sixteenth triplets', p: [P(1, 6, [[0, 3], [3, 1], [4, 1], [5, 1]]), P(1, 6, [[0, 1], [1, 1], [2, 1], [3, 3]])] },
    { id: 'quintuplets', level: 7, name: 'Quintuplets', p: [all(5)] },
    { id: 'septuplets', level: 8, name: 'Septuplets', p: [all(7)] },
    { id: 'broken', level: 8, name: 'Broken tuplets', p: [P(1, 5, [[0, 2], [2, 1], [3, 1], [4, 1]]), P(1, 5, [[0, 1], [1, 1], [3, 1], [4, 1]]), P(1, 3, [[0, 2], [2, 1]]), P(1, 3, [[0, 1], [2, 1]]), P(1, 7, [[0, 2], [2, 1], [3, 2], [5, 1], [6, 1]])] },
  ],
  compound: [
    { id: 'basic', level: 1, name: 'Dotted quarters and halves', p: [P(1, 1, [[0, 1]]), P(1, 1, []), P(2, 1, [[0, 2]]), P(1, 3, [[0, 2], [2, 1]])] },
    { id: 'eighths', level: 2, name: 'Eighth notes', p: [all(3), all(3), P(1, 3, [[0, 1], [1, 2]]), P(1, 3, [[1, 1], [2, 1]]), P(1, 3, [[0, 1], [2, 1]])] },
    { id: 'duplets', level: 3, name: 'Duplets', p: [all(2)] },
    { id: 'syncopation', level: 3, name: 'Syncopation', p: [P(2, 3, [[0, 1], [1, 3], [4, 2]]), P(2, 3, [[0, 2], [2, 2], [4, 2]])] },
    { id: 'sixteenths', level: 4, name: 'Sixteenths', p: [all(6), P(1, 6, [[0, 2], [2, 1], [3, 1], [4, 2]]), P(1, 6, [[0, 1], [1, 1], [2, 2], [4, 2]]), P(1, 6, [[0, 2], [2, 2], [4, 1], [5, 1]])] },
    { id: 'ties', level: 4, name: 'Ties', p: [P(2, 6, [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2]]), P(2, 3, [[0, 2], [2, 2], [4, 2]])] },
    { id: 'dottedE', level: 5, name: 'Dotted eighths', p: [P(1, 6, [[0, 3], [3, 1], [4, 2]])] },
    { id: 'sixteenthRests', level: 5, name: 'Sixteenth rests', p: [P(1, 6, [[0, 2], [3, 1], [4, 2]]), P(1, 6, [[1, 1], [2, 2], [4, 2]])] },
    { id: 'quadruplets', level: 6, name: 'Quadruplets', p: [all(4)] },
    { id: 'quintuplets', level: 7, name: 'Quintuplets', p: [all(5)] },
    { id: 'septuplets', level: 8, name: 'Septuplets', p: [all(7)] },
    { id: 'broken', level: 8, name: 'Broken tuplets', p: [P(1, 4, [[0, 2], [2, 1], [3, 1]]), P(1, 5, [[0, 2], [2, 1], [3, 1], [4, 1]]), P(1, 2, [[1, 1]])] },
  ],
};
export const MAX_LEVEL = 8;
export const groupsFor = meter => GROUPS[METERS[meter].compound ? 'compound' : 'simple'];
// The name of a level: its new groups, e.g. "Triplets, dotted quarters, syncopation".
export function levelName(meter, level) {
  const names = groupsFor(meter).filter(g => g.level === level).map(g => g.name);
  return names.map((s, k) => k ? s[0].toLowerCase() + s.slice(1) : s).join(', ');
}

// Small seeded random generator, so a rhythm can be replayed from its seed.
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// The weighted pattern pool for a level (1..8) or a custom list of group ids.
export function poolFor(meter, { level = 2, custom = null } = {}) {
  const groups = groupsFor(meter);
  const chosen = custom ? groups.filter(g => custom.includes(g.id)) : groups.filter(g => g.level <= level);
  const pool = [];
  for (const g of chosen) {
    // a level leans on what it introduces: its new groups together weigh as much as all earlier ones together
    const fresh = chosen.filter(x => x.level === level).length, older = chosen.length - fresh;
    const w = custom ? 1 : g.level === level ? Math.max(1, older / fresh) : 1;
    for (const p of g.p) pool.push({ p, w: w / g.p.length, g: g.id });
  }
  return pool;
}

// A random rhythm: { meter, bpm, voices: [notes], u } with notes { start, end } in ticks (M.tpb * u per beat).
export function generate({ meter = '4/4', bpm = 100, bars = 8, level = 2, custom = null, seed = 1 } = {}) {
  const M = METERS[meter], rand = rng(seed);
  let pool = poolFor(meter, { level, custom });
  // every bar must be fillable beat by beat: keep a one-beat pattern with at least one note
  if (!pool.some(x => x.p.b === 1 && x.p.n.length)) pool = pool.concat(poolFor(meter, { custom: ['basic'] }).filter(x => x.p.b === 1 && x.p.n.length));
  const placed = [];  // [beat index, pattern]
  const pick = (room, beat) => {
    // long patterns start on strong beats only (a half note on beat 1 or 3 in 4/4), and never cross the barline
    const ok = pool.filter(x => x.p.b <= room && (x.p.b === 1 || beat % x.p.b === 0 || (x.p.b === 3 && beat === 0)));
    let r = rand() * ok.reduce((s, x) => s + x.w, 0);
    for (const x of ok) if ((r -= x.w) <= 0) return x.p;
    return ok[ok.length - 1].p;
  };
  for (let bar = 0; bar < bars; bar++) {
    let beat = 0, barNotes = 0;
    while (beat < M.beats) {
      let p = pick(M.beats - beat, beat);
      // a bar of nothing but rests is no exercise: its last chance gets a note
      if (!p.n.length && !barNotes && beat + p.b >= M.beats) p = pool.find(x => x.p.b === 1 && x.p.n.length).p;
      placed.push([bar * M.beats + beat, p]);
      barNotes += p.n.length; beat += p.b;
    }
  }
  // the finest tick grid the chosen patterns need (u = 5 for quintuplets, 7 for septuplets ...)
  const u = placed.reduce((u, [, p]) => lcm(u, p.d / gcd(p.d, M.tpb)), 1), tpb = M.tpb * u, notes = [];
  for (const [b, p] of placed) {
    const s = tpb / p.d;
    for (const [k, len] of p.n) notes.push({ start: b * tpb + k * s, end: b * tpb + (k + len) * s });
  }
  return { meter, bpm, voices: [notes], u, title: '' };
}

// ---------- scoring ----------
export const GOOD_MS = 30;   // within this, a note is spot on (green)
export const MAX_WINDOW = 150;

// Each note's window: a tap within it counts for that note. Windows never overlap (at most 45 % of the gap to a
// neighbour), so every tap belongs to at most one note.
export function windows(times) {
  return times.map((t, k) => {
    const gap = Math.min(k ? t - times[k - 1] : Infinity, k < times.length - 1 ? times[k + 1] - t : Infinity);
    return Math.max(12, Math.min(MAX_WINDOW, 0.45 * gap));
  });
}

// notes: [{ t, end }] in ms from the start; taps: [{ t, up }] in ms (latency already removed; up: release time
// or null). hold: also score each note's release against its written end.
// Returns per-note results { tap, err, relErr, pts } (tap -1 = missed), extras, and the totals.
export function scoreRun(notes, taps, { hold = false } = {}) {
  const times = notes.map(n => n.t), win = windows(times);
  const res = notes.map(() => ({ tap: -1, err: null, relErr: null, pts: 0 }));
  const sorted = taps.map((x, i) => ({ ...x, i })).sort((a, b) => a.t - b.t);
  let extras = 0, k = 0;
  for (const x of sorted) {
    while (k < notes.length && times[k] + win[k] < x.t) k++;
    // the note whose window holds this tap (windows are disjoint and sorted)
    let j = -1;
    for (const c of [k - 1, k, k + 1]) if (c >= 0 && c < notes.length && Math.abs(x.t - times[c]) <= win[c]) { j = c; break; }
    if (j < 0) { extras++; continue; }
    const r = res[j], err = x.t - times[j];
    if (r.tap < 0 || Math.abs(err) < Math.abs(r.err)) { if (r.tap >= 0) extras++; r.tap = x.i; r.err = err; r.up = x.up; } else extras++;
  }
  const onsetPts = (e, w) => { const a = Math.abs(e); return a <= GOOD_MS ? 1 : a > w ? 0 : 1 - 0.5 * (a - GOOD_MS) / Math.max(1, w - GOOD_MS); };
  res.forEach((r, j) => {
    if (r.tap < 0) return;
    r.pts = onsetPts(r.err, win[j]);
    if (hold) {
      const len = notes[j].end - notes[j].t, rw = Math.max(40, Math.min(250, 0.5 * len));
      r.relErr = r.up == null ? null : r.up - notes[j].end;
      const rp = r.relErr == null ? 0 : Math.abs(r.relErr) <= rw ? 1 - 0.5 * Math.max(0, Math.abs(r.relErr) - 2 * GOOD_MS) / rw : 0;
      r.pts = (r.pts + Math.max(0, rp)) / 2;
    }
    delete r.up;
  });
  const hits = res.filter(r => r.tap >= 0), total = notes.length + extras;
  const accuracy = total ? res.reduce((s, r) => s + r.pts, 0) / total : 0;
  const meanErr = hits.length ? hits.reduce((s, r) => s + r.err, 0) / hits.length : 0;
  return { notes: res, hits: hits.length, misses: notes.length - hits.length, extras, accuracy, meanErr, windows: win };
}

// Note times in ms for a generated rhythm, the first beat of bar 1 at 0.
export function noteTimes(r) {
  const M = METERS[r.meter], tpb = M.tpb * (r.u || 1), beatMs = 60000 / r.bpm;
  return [...r.voices[0]].sort((a, b) => a.start - b.start).map(n => ({ t: n.start / tpb * beatMs, end: n.end / tpb * beatMs }));
}
