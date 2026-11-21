// Meters and the tick grid shared by analysis, engraving, exports and rhythm codes.
// Ticks: 12 per quarter note (so 16ths = 3, 8th triplets = 4); compound beats are dotted quarters (18).

export const METERS = {
  '2/4': { beats: 2, tpb: 12, compound: false },
  '3/4': { beats: 3, tpb: 12, compound: false },
  '4/4': { beats: 4, tpb: 12, compound: false },
  '5/4': { beats: 5, tpb: 12, compound: false },
  '6/8': { beats: 2, tpb: 18, compound: true },
  '9/8': { beats: 3, tpb: 18, compound: true },
  '12/8': { beats: 4, tpb: 18, compound: true },
};
// Order matters: the index is stored in rhythm codes (share links).
export const METER_IDS = ['2/4', '3/4', '4/4', '5/4', '6/8', '9/8', '12/8'];

export const REPR = [72, 48, 36, 24, 18, 12, 9, 6, 3]; // single-glyph lengths in 1/48 notes
export const REPR_SET = new Set(REPR);
export const DOTTED = new Set([9, 18, 36, 72]);

// Beat subdivisions allowed by the Grid control (finest: 0 quarter, 1 eighth, 2 sixteenth, 3 thirty-second),
// the triplet key and the Tuplets key. The order matters: on equal cost the earlier division wins.
export function allowedDivs(M, o) {
  if (M.compound) {
    const d = [[1], [1, 3], [1, 3, 6], [1, 3, 6, 12]][o.finest];
    return o.tuplets ? [...d, ...TUPLET_DIVS_COMPOUND] : d;
  }
  const d = [[1], [1, 2], [1, 2, 4], [1, 2, 4, 8]][o.finest].slice();
  if (o.triplets) d.push(3);
  if (o.tuplets) d.push(...TUPLET_DIVS_SIMPLE);
  return d;
}
export const COMPLEXITY_SIMPLE = { 1: 0, 2: 1, 4: 2, 3: 2.5, 8: 3.5 };  // 8, 12: the 32nd grid (finest 3, new)
export const COMPLEXITY_COMPOUND = { 1: 0, 3: 1, 6: 2, 12: 3.5 };
export const SIGMA_MS = 35;

// ---------- extended rhythms (Fine-tune "Tuplets" key, o.tuplets) ----------
// Extra per-beat divisions. Simple meters (beat = quarter): sextuplets, quintuplets … 13-lets.
// Compound meters (beat = dotted quarter): duplets, quadruplets, 5/7/8/10/11/13-lets. 9 per dotted quarter is left
// out on purpose: it is written as three sixteenth-triplets, not as a 9-let.
export const TUPLET_DIVS_SIMPLE = [6, 5, 7, 9, 10, 11, 12, 13];
export const TUPLET_DIVS_COMPOUND = [2, 4, 5, 7, 8, 10, 11, 13];
// Grid "32nds" (finest 3) adds these plain (non-tuplet) divisions.
export const FINEST32 = { simple: 8, compound: 12 };
export const COMPLEXITY_EXT_SIMPLE = { 8: 3.5, 6: 3, 5: 3.2, 7: 3.8, 9: 4.4, 10: 4.6, 11: 5, 12: 4.8, 13: 5.4 };
export const COMPLEXITY_EXT_COMPOUND = { 12: 3.5, 2: 1.5, 4: 2.5, 5: 3.2, 7: 3.8, 8: 4, 10: 4.6, 11: 5, 13: 5.4 };
// Tuplets that span several beats (simple meters only): [beats, notes]. 2:3 = quarter-note triplets,
// 4:3 = half-note triplets, 2:5 = eighth quintuplets over two beats, and so on.
export const SPANS = [[2, 3], [4, 3], [2, 5], [4, 5], [2, 7], [4, 7]];
export const COMPLEXITY_SPAN = { '2:3': 2, '4:3': 2.5, '2:5': 3.5, '4:5': 3.5, '2:7': 4, '4:7': 4 };
// Cost per empty slot of a tuplet, so a few loose taps are not "explained" by an exotic tuplet.
export const EMPTY_SLOT_COST = 2.5;
// A tuplet (other than the eighth triplet) is only considered when at least this share of its slots has a tap:
// a 7-let with 4 notes, or a quarter-note triplet with 1, is almost always drift or a rest misread.
export const MIN_FILL = 0.6;
// ... and only when its timing error is at most this share of the best plain reading's: ordinary tempo drift
// leaves plain notes a little off, and a tuplet must not be used to soak that up.
export const TUPLET_GAIN = 0.45;
