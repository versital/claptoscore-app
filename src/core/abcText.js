// ABC text for engraving tokens (see engrave.js), shared by core/abc.js and core/rhythmCode.js.
// Lengths are written against L:1/48. At a finer tick resolution u (tuplets) a token's written value is in
// 1/(48u) notes, so it is written as a fraction of 1/48 when it is not whole (a 32nd is "3/2").

const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
export function abcLen(notated, u = 1) {
  if (notated % u === 0) return String(notated / u);
  const g = gcd(notated, u);
  return `${notated / g}/${u / g}`;
}

// abcjs reads one digit for each of p, q and r in "(p:q:r". For drawing, a tuplet past that is split into brackets
// of at most 9 notes with one-digit ratios chosen so the brackets together last exactly as long as the real tuplet
// (an 11:8 group = 7 notes at 7:5 + 4 at 4:3); every bar still lasts a bar, so two voices stay lined up. The page
// then puts the real number back and merges the brackets into one (relabelTuplets in features/notation.js).
// Exports and the ABC source keep the exact "(p:q:r" form.
const RATIOS = [];
for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) if (gcd(a, b) === 1 && (a > 1 || b > 1)) RATIOS.push([a, b]);
const planCache = new Map();
// written: the group's written lengths; returns [{ n, a, b }] chunks, or null when no exact split exists
export function drawPlan(written, p, q) {
  const key = p + ':' + q + ':' + written.join(',');
  if (planCache.has(key)) return planCache.get(key);
  let plan = null;
  if (p < 10 && q < 10 && written.length < 10) plan = [{ n: written.length, a: p, b: q }];
  else {
    const W = written.reduce((s, x) => s + x, 0), want = q / p;
    let best = Infinity;
    // chunk sums S_i must satisfy sum S_i * b_i / a_i = W * q / p; try 2 chunks, then 3; prefer ratios near q/p
    const sums = [0]; for (const x of written) sums.push(sums[sums.length - 1] + x);
    const n = written.length;
    const tryCuts = cuts => {
      const S = cuts.slice(1).map((c, k) => sums[c] - sums[cuts[k]]);
      if (cuts.slice(1).some((c, k) => c - cuts[k] > 9 || c - cuts[k] < 1)) return;
      const rec = (k, acc, chosen, dev) => {
        if (dev >= best) return;
        if (k === S.length - 1) {
          // last chunk: solve S * b / a = rest exactly
          const rest = W * q / p - acc;
          for (const [a, b] of RATIOS) {
            if (Math.abs(S[k] * b * p - rest * a * p) > 1e-9 * a * p) continue;
            const d = Math.max(dev, Math.abs(b / a - want));
            if (d < best) { best = d; plan = [...chosen, [a, b]].map(([a2, b2], j) => ({ n: cuts[j + 1] - cuts[j], a: a2, b: b2 })); }
          }
          return;
        }
        for (const [a, b] of RATIOS) {
          const d = Math.abs(b / a - want);
          if (d > 0.5) continue;
          rec(k + 1, acc + S[k] * b / a, [...chosen, [a, b]], Math.max(dev, d));
        }
      };
      rec(0, 0, [], 0);
    };
    for (let c1 = 1; c1 < n; c1++) tryCuts([0, c1, n]);
    if (!plan) for (let c1 = 1; c1 < n; c1++) for (let c2 = c1 + 1; c2 < n; c2++) tryCuts([0, c1, c2, n]);
  }
  planCache.set(key, plan);
  return plan;
}

// nearest one-digit ratio (last resort when no exact split exists; the bar is then drawn slightly off length)
function nearest(p, q) {
  let best = [p, q], err = Infinity;
  for (const [a, b] of RATIOS) { const e = Math.abs(a / b - p / q); if (e < err - 1e-12) { err = e; best = [a, b]; } }
  return best;
}

// One bar's tokens as ABC: letter is the note head ('B' one voice, 'c' snare, 'F' kick).
// labels: pass an array to get abcjs-drawable text; the number to show on every bracket drawn is pushed to it, in
// order (null for the 2nd and later bracket of a split group).
export function abcTokens(tokens, letter, u = 1, labels = null) {
  let out = '', chunks = null, chunkLeft = 0, first = false;
  tokens.forEach((t, i) => {
    if (t.beatStart && i) out += ' ';
    if (t.trip && t.trip.pos === 'start') {
      if (!labels) out += `(${t.trip.p}:${t.trip.q}:${t.trip.n}`;
      else {
        const grp = tokens.slice(i, i + t.trip.n), { p, q } = t.trip;
        chunks = drawPlan(grp.map(x => x.notated), p, q);
        if (!chunks) { const [a, b] = nearest(p, q); chunks = []; for (let k = 0; k < grp.length; k += 9) chunks.push({ n: Math.min(9, grp.length - k), a, b }); }
        chunks = chunks.slice(); chunkLeft = 0; first = true;
      }
    }
    if (labels && t.trip) {
      if (!chunkLeft) {
        const c = chunks.shift();
        out += `(${c.a}:${c.b}:${c.n}`; chunkLeft = c.n;
        labels.push(first ? t.trip.p : null); first = false;
      }
      chunkLeft--;
    }
    out += (t.rest ? 'z' : letter) + abcLen(t.notated, u) + (t.tie ? '-' : '');
  });
  return out;
}
