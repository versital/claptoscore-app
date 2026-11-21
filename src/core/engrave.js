import { REPR, DOTTED, groupStarts } from './meters.js';
import { cellAt, tupletOf } from './tuplets.js';

// Engraving decisions for one bar of one voice, shared by the ABC, MusicXML and rhythm-code writers.
// (Previously duplicated in the inline app script and rhythm-code.js; this is now the single copy.)
//
// A: { M, tpb, barTicks, grid, cells? } (an analysis, or rhythmCode.layout()). A.tpb may be M.tpb * u (finer ticks
// for tuplets, see core/tuplets.js); written values are then in 1/(48u) whole notes.
// Each token is one written note or rest: dur = sounding ticks, notated = written value in ticks (differs inside
// tuplets), tie = tied into the next token, trip = {n, pos, p, q} for a tuplet group (p notes in the time of q;
// n tokens in the group), at = absolute start tick, onset = the token where a note starts (not a tied
// continuation), id = the source segment's id.

// note values that are one glyph, at resolution u (adds the 32nd when it is a whole number of ticks)
const glyphCache = new Map();
function glyphs(u) {
  let g = glyphCache.get(u);
  if (!g) {
    const list = REPR.map(r => r * u);
    if (u % 2 === 0) list.push(1.5 * u);
    g = { list, set: new Set(list), dotted: new Set([...DOTTED].map(r => r * u)) };
    glyphCache.set(u, g);
  }
  return g;
}

export function barTokens(A, bar, segs) {
  const { M, tpb, barTicks } = A, b0 = bar * barTicks, u = tpb / M.tpb, G = glyphs(u);
  if (segs.some(s => s.rest && s.start <= b0 && s.end >= b0 + barTicks)) return { measureRest: true, tokens: [] };
  let pieces = [];
  const clip = (cs, ce, j, tup) => {
    const out = [];
    for (const s of segs) {
      if (s.end <= cs || s.start >= ce) continue;
      const ps = Math.max(s.start, cs), pe = Math.min(s.end, ce);
      out.push({ start: ps - b0, len: pe - ps, rest: s.rest, id: s.id, tieOut: !s.rest && s.end > pe, tieIn: !s.rest && s.start < ps, beat: j, trip: !!tup, tup });
    }
    return out;
  };
  for (let j = 0; j < M.beats;) {
    const bs = b0 + j * tpb, cell = cellAt(A, bar * M.beats + j);
    // a cell spanning several beats is taken whole from its first beat (it never crosses a barline)
    const span = cell && cell.b0 === bar * M.beats + j && j + cell.span <= M.beats ? cell.span : 1;
    const tup = cell && (span > 1 || cell.span === 1) ? tupletOf(M, cell.s, span) : null;
    let inCell = clip(bs, bs + span * tpb, j, tup);
    if (tup) {
      // no bracket when the cell holds one note, or every note also fits the plain grid
      // (original rule for triplets: eighths; other tuplets: sixteenths)
      const g = (!M.compound && tup.p === 3 && span === 1 ? 6 : 3) * u;
      if (inCell.length === 1 || inCell.every(x => x.len % g === 0 && x.start % g === 0)) {
        inCell = span === 1 ? inCell.map(x => ({ ...x, trip: false, tup: null }))
          : Array.from({ length: span }, (_, k) => clip(bs + k * tpb, bs + (k + 1) * tpb, j + k, null)).flat();
      }
    }
    pieces.push(...inCell);
    j += span;
  }
  // merge whole-beat pieces into longer values, following common engraving rules
  const mid = (M.beats % 2 === 0 && M.beats >= 4 && !M.groups) ? barTicks / 2 : null;
  // additive meters (2+2+3/8): notes are beamed within a group and never merged across one
  const gs = groupStarts(M), gTicks = gs ? gs.map(b => b * tpb) : null;
  const canMerge = (x, y) => {
    if (x.trip || y.trip || y.start !== x.start + x.len) return false;
    const same = (x.rest && y.rest) || (!x.rest && !y.rest && x.tieOut && x.id === y.id);
    if (!same || x.start % tpb || x.len % tpb) return false;
    const L = x.len + y.len;
    if (!G.set.has(L)) return false;
    if (y.len % tpb) { if (M.compound || x.rest || x.len !== tpb || y.len !== tpb / 2) return false; }
    if (x.rest && !M.compound && G.dotted.has(L)) return false;
    if (mid !== null && x.start !== 0 && x.start < mid && x.start + L > mid) return false;
    if (gTicks && gTicks.some(g => x.start < g && x.start + L > g)) return false;
    return true;
  };
  for (let i = 0; i + 1 < pieces.length;) {
    const x = pieces[i], y = pieces[i + 1];
    if (canMerge(x, y)) { x.len += y.len; x.tieOut = y.tieOut; pieces.splice(i + 1, 1); } else i++;
  }
  const split = len => { const out = []; for (const r of G.list) while (len >= r) { out.push(r); len -= r; } if (len > 0) out.push(len); return out; };
  const tokens = [];
  // p / q: written value = sounding length * p / q (1 / 1 outside tuplets); multiply first so it stays exact
  const push = (pc, p, q, trip) => {
    let at = b0 + pc.start;
    split(pc.len * p / q).forEach((l, k, parts) => {
      const dur = p === q ? l : l * q / p;
      tokens.push({
        rest: pc.rest, dur, notated: l, beat: pc.beat, beatStart: k === 0 && (gTicks ? gTicks.includes(pc.start) : pc.start % tpb === 0),
        tie: !pc.rest && (k < parts.length - 1 || pc.tieOut), trip, at, onset: !pc.rest && k === 0 && !pc.tieIn, id: pc.id,
      });
      at += dur;
    });
  };
  for (let i = 0; i < pieces.length;) {
    const pc = pieces[i];
    if (pc.trip) {
      const first = tokens.length, { p, q } = pc.tup;
      while (i < pieces.length && pieces[i].trip && pieces[i].beat === pc.beat) push(pieces[i++], p, q, true);
      const grp = tokens.slice(first);
      grp.forEach((t, k) => {
        t.trip = { n: grp.length, pos: k === 0 ? 'start' : k === grp.length - 1 ? 'stop' : 'mid', p, q };
        if (k) t.beatStart = false;  // no gap inside a bracket, even where it crosses a beat
      });
    } else { push(pc, 1, 1, null); i++; }
  }
  return { measureRest: false, tokens };
}
