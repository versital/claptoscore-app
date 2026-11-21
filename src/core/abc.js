import { beatUnit } from './meters.js';
import { barTokens } from './engrave.js';
import { syllables } from './rhythmCode.js';
import { abcTokens } from './abcText.js';

// ABC notation for an analysis. Rendered by abcjs on screen, shown as "ABC source", and copied by "Copy ABC".

export function barAbc(A, bar, segs, letter, labels = null) {
  const { measureRest, tokens } = barTokens(A, bar, segs);
  if (measureRest) return 'Z';
  return abcTokens(tokens, letter, A.tpb / A.M.tpb, labels);
}

// Counting syllables under a one-voice score, as an ABC w: line. count: 'count' | 'kodaly'.
// The syllable rules work in 12 ticks per quarter; at a finer resolution (tuplets) the notes are scaled back first,
// and notes off that grid (inside 5-, 7-lets …) get a neutral '·'.
export function lyricLine(A, b0, b1, segs, count) {
  const u = A.tpb / A.M.tpb, sorted = [...A.voices[0].notes].sort((x, y) => x.start - y.start);
  const syl = syllables(u === 1 ? sorted : sorted.map(n => ({ start: n.start / u, end: n.end / u })), A.M, count);
  const byStart = new Map(sorted.map((n, k) => [n.start, syl[k]]));
  const words = [];
  for (let b = b0; b < b1; b++) for (const t of barTokens(A, b, segs).tokens) {
    if (!t.rest) words.push(t.onset ? (byStart.get(t.at) || '*').replace(/-/g, '\\-') : '*');
  }
  return words.length ? 'w: ' + words.join(' ') : '';
}

// lyrics: draw counting syllables (one voice only); count: 'off' | 'count' | 'kodaly'; perLine: bars per system.
// abcjs: an array to fill with tuplet numbers; the text is then drawable by abcjs (see abcText.js).
export function toAbc(A, fromBar = A.startBar, { lyrics = true, count = 'off', perLine = 4, abcjs = null } = {}) {
  const { M, R } = A;
  const head = ['X:1', `M:${R.meter}`, 'L:1/48', `Q:${beatUnit(M).abc}=${Math.round(R.bpm)}`];
  const systems = [];
  for (let bar = fromBar; bar < A.endBar; bar += perLine) systems.push([bar, Math.min(A.endBar, bar + perLine)]);
  const lineFor = (segs, letter, [b0, b1], last) => {
    const bars = []; for (let b = b0; b < b1; b++) bars.push(barAbc(A, b, segs, letter, abcjs));
    return bars.join(' | ') + (last ? ' |]' : ' |');
  };
  if (!A.twoVoice) {
    const segs = A.voices[0].segs, words = lyrics && count !== 'off';
    const body = [];
    if (words) body.push('%%vocalfont Geist 9');
    systems.forEach((s, k) => {
      body.push(lineFor(segs, 'B', s, k === systems.length - 1));
      if (words) { const w = lyricLine(A, s[0], s[1], segs, count); if (w) body.push(w); }
    });
    return [...head, 'K:C clef=perc stafflines=1', ...body].join('\n');
  }
  // two voices on a five-line percussion staff: high voice stems up (snare line), low voice stems down (kick space)
  const byV = v => A.voices.find(x => x.v === v)?.segs ?? [{ start: A.startBar * A.barTicks, end: A.endBar * A.barTicks, rest: true }];
  const body = [];
  systems.forEach((s, k) => {
    const last = k === systems.length - 1;
    body.push('[V:1] ' + lineFor(byV(1), 'c', s, last));
    body.push('[V:2] ' + lineFor(byV(2), 'F', s, last));
  });
  return [...head, '%%score (1 2)', 'V:1 clef=perc stem=up', 'V:2 clef=perc stem=down', 'K:C clef=perc', ...body].join('\n');
}
