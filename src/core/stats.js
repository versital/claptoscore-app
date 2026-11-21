// Small numeric helpers used by tempo inference, calibration and the analysis.

export function median(a) {
  const s = [...a].sort((x, y) => x - y), n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
}

// Ridge-regularised (locally weighted) line through (beat position, time) pairs.
// center === null fits one line to everything; otherwise points are Gaussian-weighted around center (width W).
//
// Performance (this runs once per tap per refit pass, so O(n^2) on long takes): the sums run in plain loops over a
// reused buffer, and points whose Gaussian weight is exactly 0 (exp underflows past ~745) are skipped. Adding an
// exact zero term never changes a floating-point sum, so the result is bit-for-bit the original's.
let wbuf = new Float64Array(256);
const UNDERFLOW = 746;  // Math.exp(-x) === 0 for every x above this
export function fitLine(qs, ts, center, W, beatMs) {
  const n = qs.length;
  let sw = 0, sq = 0, st = 0;
  if (wbuf.length < n) wbuf = new Float64Array(Math.max(n, wbuf.length * 2));
  const w = wbuf;
  for (let j = 0; j < n; j++) {
    let wj = 1;
    if (center !== null) { const x = ((qs[j] - center) / W) ** 2; wj = x > UNDERFLOW ? 0 : Math.exp(-x); }
    w[j] = wj;
    if (wj === 0) continue;
    sw += wj; sq += wj * qs[j]; st += wj * ts[j];
  }
  const qm = sq / sw, tm = st / sw;
  let sqq = 0, sqt = 0;
  for (let j = 0; j < n; j++) {
    const wj = w[j];
    if (wj === 0) continue;
    const dq = qs[j] - qm; sqq += wj * dq * dq; sqt += wj * dq * (ts[j] - tm);
  }
  const K = 2;
  let b = (sqt + K * beatMs) / (sqq + K);
  b = Math.max(beatMs * 0.8, Math.min(beatMs * 1.25, b));
  return { a: tm - b * qm, b };
}

// Follow-drift fits centred on every point, for long takes: each fit only sums points within 8 window widths of its
// centre (their weight is below e^-64 ~ 1e-28, far under a double's precision next to the centre's own weight 1), so
// the cost is O(n * window) instead of O(n^2). Results match fitLine to within rounding, not bit for bit, so the
// original path (Tuplets off) keeps fitLine and its golden test.
let wl = new Float64Array(256);
export function localFits(qs, ts, W, beatMs) {
  const n = qs.length, order = Array.from({ length: n }, (_, i) => i).sort((a, b) => qs[a] - qs[b] || a - b);
  const sq = order.map(i => qs[i]), st = order.map(i => ts[i]), R = 8 * W, out = new Array(n);
  let lo = 0, hi = 0, last = null;
  for (let k = 0; k < n; k++) {
    const c = sq[k];
    if (last && last.c === c) { out[order[k]] = last.f; continue; }
    while (sq[lo] < c - R) lo++;
    while (hi < n && sq[hi] <= c + R) hi++;
    if (wl.length < hi - lo) wl = new Float64Array(Math.max(hi - lo, wl.length * 2));
    let sw = 0, sqs = 0, sts = 0;
    for (let j = lo; j < hi; j++) { const w = Math.exp(-(((sq[j] - c) / W) ** 2)); wl[j - lo] = w; sw += w; sqs += w * sq[j]; sts += w * st[j]; }
    const qm = sqs / sw, tm = sts / sw;
    let sqq = 0, sqt = 0;
    for (let j = lo; j < hi; j++) { const w = wl[j - lo], dq = sq[j] - qm; sqq += w * dq * dq; sqt += w * dq * (st[j] - tm); }
    const K = 2;
    let b = (sqt + K * beatMs) / (sqq + K);
    b = Math.max(beatMs * 0.8, Math.min(beatMs * 1.25, b));
    last = { c, f: { a: tm - b * qm, b } };
    out[order[k]] = last.f;
  }
  return out;
}
