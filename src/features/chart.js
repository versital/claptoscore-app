// Timing chart: top row = your taps against the click, bottom row = where they were written.
// Colour = how far off (good < 25 ms, warn < 60 ms, bad). Click a tap to ignore it / bring it back.
import { S } from '../state.js';
import { T } from '../services/i18n.js';
import { store } from '../services/store.js';
import { $, css } from '../ui/dom.js';
import { cellAt } from '../core/tuplets.js';

let hitMarks = [], chartHover = null;  // the tap under the pointer grows and shows what a click does

export function drawChart(A) {
  const cv = $('#chart'), wrap = $('#chartWrap'), dpr = window.devicePixelRatio || 1;
  const M = A.M, beatMs = 60000 / A.R.bpm;
  const minBeat = A.empty ? Math.floor(Math.min(...A.all.map(x => x.t)) / beatMs / M.beats) * M.beats : A.startBar * M.beats;
  const maxBeat = A.empty ? minBeat + M.beats * 4 : A.endBar * M.beats;
  const beats = maxBeat - minBeat, padL = 18, padR = 18;
  const ppb = Math.max(46, (wrap.clientWidth - padL - padR) / beats);
  const W = Math.ceil(beats * ppb + padL + padR), H = 170;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const X = beat => padL + (beat - minBeat) * ppb;
  const two = !A.empty && A.twoVoice;
  const yRaw = 58, yQ = 128, yQv = v => two ? (v === 2 ? yQ + 9 : yQ - 9) : yQ;
  const ink3 = css('--ink-3'), line = css('--line'), accent = css('--accent'), pulse = css('--pulse');
  const vColor = v => v === 2 ? pulse : accent;
  g.font = '500 11px "IBM Plex Mono", monospace'; g.textBaseline = 'middle';
  const mark = (x, y, v, r) => { g.beginPath(); if (v === 2) g.rect(x - r, y - r, r * 2, r * 2); else g.arc(x, y, r, 0, Math.PI * 2); };
  // grid
  for (let b = minBeat; b <= maxBeat; b++) {
    const isBar = b % M.beats === 0;
    g.strokeStyle = isBar ? ink3 : line; g.lineWidth = isBar ? 1.2 : 1;
    g.beginPath(); g.moveTo(X(b) + .5, 26); g.lineTo(X(b) + .5, H - 12); g.stroke();
    if (isBar && b < maxBeat) { g.fillStyle = ink3; g.fillText(T('bar {n}', { n: Math.floor(b / M.beats) - Math.floor(minBeat / M.beats) + 1 }), X(b) + 5, 14); }
    if (!A.empty && b < maxBeat) {
      // the chosen division of each beat (a tuplet over several beats is drawn from its first beat)
      const c = cellAt(A, b);
      if (c && c.b0 === b && c.s > 1) {
        const n = c.s, step = c.span / n;
        g.strokeStyle = accent; g.globalAlpha = .45;
        for (let k = 1; k < n; k++) { const x = X(b + k * step); g.beginPath(); g.moveTo(x, yQ - 20); g.lineTo(x, yQ + 20); g.stroke(); }
        g.globalAlpha = 1;
      }
    }
  }
  g.fillStyle = ink3; g.textAlign = 'left';
  g.fillText(T('tapped'), 4, yRaw - 24); g.fillText(T('written'), 4, yQ + 30);
  // written notes
  if (!A.empty) for (const n of A.notes) {
    const x0 = X(n.start / A.tpb), x1 = X(n.end / A.tpb), y = yQv(n.v);
    g.fillStyle = vColor(n.v); g.globalAlpha = .18; g.fillRect(x0, y - 6, Math.max(2, x1 - x0 - 2), 12); g.globalAlpha = 1;
    mark(x0, y, n.v, 4.5); g.fill();
  }
  // raw taps
  hitMarks = [];
  const colorFor = d => Math.abs(d) < 25 ? css('--good') : Math.abs(d) < 60 ? css('--warn') : css('--bad');
  const usedById = new Map((A.used || []).map(x => [x.i, x]));
  for (const x of A.all) {
    const u = usedById.get(x.i), xr = X(x.t / beatMs);
    if (x.up !== null && S.opt.lengths === 'held') { g.fillStyle = ink3; g.globalAlpha = .25; g.fillRect(xr, yRaw - 3, Math.max(1, X(x.up / beatMs) - xr), 6); g.globalAlpha = 1; }
    if (u) {
      const xq = X(u.q), c = colorFor(u.dev);
      g.strokeStyle = c; g.globalAlpha = .6; g.lineWidth = 1.2; g.beginPath(); g.moveTo(xr, yRaw + 6); g.lineTo(xq, yQv(u.v) - 6); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = c; mark(xr, yRaw, x.v, 5.5); g.fill();
      if (Math.abs(u.dev) >= 25) { g.fillStyle = ink3; g.textAlign = 'center'; g.fillText((u.dev > 0 ? '+' : '') + Math.round(u.dev), xr, yRaw - 13); g.textAlign = 'left'; }
    } else {
      g.strokeStyle = ink3; g.lineWidth = 1.5; mark(xr, yRaw, x.v, 5); g.stroke();
    }
    if (x.i === chartHover) {  // × ignores this tap, + brings an ignored one back
      g.fillStyle = u ? colorFor(u.dev) : ink3; mark(xr, yRaw, x.v, 9); g.fill();
      const k = u ? 3.5 : 4.5; g.strokeStyle = css('--paper') || '#fff'; g.lineWidth = 2; g.beginPath();
      if (u) { g.moveTo(xr - k, yRaw - k); g.lineTo(xr + k, yRaw + k); g.moveTo(xr + k, yRaw - k); g.lineTo(xr - k, yRaw + k); }
      else { g.moveTo(xr - k, yRaw); g.lineTo(xr + k, yRaw); g.moveTo(xr, yRaw - k); g.lineTo(xr, yRaw + k); }
      g.stroke();
    }
    hitMarks.push({ x: xr, y: yRaw, i: x.i });
  }
}

function chartHit(e) {
  const r = e.target.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  let best = null, bd = 12;
  for (const m of hitMarks) { const d = Math.hypot(m.x - x, m.y - y); if (d < bd) { bd = d; best = m; } }
  return best;
}
function chartPoint(i) {
  const cv = $('#chart'), tap = i != null && S.rec ? S.rec.taps[i] : null;
  cv.style.cursor = tap ? 'pointer' : '';
  cv.title = tap ? (tap.excluded ? T('Bring this tap back') : T('Ignore this tap')) : '';
}

// onChange(): the take changed (a tap was ignored or restored) and needs a re-render.
export function bindChart(onChange) {
  $('#chart').addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !S.A) return;
    const m = chartHit(e), i = m ? m.i : null;
    if (i === chartHover) return;
    chartHover = i; chartPoint(i); drawChart(S.A);
  });
  $('#chart').addEventListener('pointerleave', () => { if (chartHover == null || !S.A) return; chartHover = null; chartPoint(null); drawChart(S.A); });
  $('#chart').addEventListener('click', e => {
    const best = chartHit(e);
    if (!best || !S.rec) return;
    const tap = S.rec.taps[best.i]; tap.excluded = !tap.excluded;
    if (S.rec.source === 'user') store.set('rec', S.rec);
    onChange(); chartPoint(chartHover);
  });
}
