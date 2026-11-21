// Step 3: analyse the current take and draw everything that depends on it (score, stats, chart, share link).
// render() is the single "the take or its settings changed" entry point; every feature calls it.
import { S, latencies } from '../state.js';
import { T, plural } from '../services/i18n.js';
import { analyze } from '../core/analyze.js';
import { toAbc } from '../core/abc.js';
import { $, css } from '../ui/dom.js';
import { drawChart } from './chart.js';
import { drawBarBrackets, barBracketPad } from '../ui/barBrackets.js';
import { countMode } from './counting.js';
import { updateShare, sharePanelOpen } from './share.js';

const renderHooks = [];
// Extension point: fn(A) runs after every render (for future panels: practice scoring, pattern library, ...).
export const onRender = fn => { renderHooks.push(fn); };

// The analysis only depends on the take, the clean-up options and the latencies. Many redraws change none of these
// (window resize, theme, counting mode, opening a panel), so the last analysis is reused when its inputs match.
// The take is edited in place in three ways only: barShift, bpm (½× / 2×) and a tap's excluded flag (chart).
let memo = null;
function analysisFor(R, opt, lat) {
  const key = JSON.stringify([R.bpm, R.meter, R.barShift || 0, R.exact || false, opt, lat]);
  let ex = '';
  for (const x of R.taps) ex += x.excluded ? '1' : '0';
  if (memo && memo.R === R && memo.taps === R.taps && memo.ex === ex && memo.key === key) return memo.A;
  const A = analyze(R, opt, lat);
  memo = { R, taps: R.taps, ex, key, A };
  return A;
}

// Coalesce bursts of changes (dragging a slider) into one redraw per frame. requestAnimationFrame does not run in a
// hidden tab, so a timer backs it up.
let pending = 0;
export function requestRender() {
  if (pending) return;
  const go = () => { if (!pending) return; cancelAnimationFrame(pending.raf); clearTimeout(pending.timer); pending = 0; render(); };
  pending = { raf: requestAnimationFrame(go), timer: setTimeout(go, 120) };
}

// Put the real number on each tuplet bracket abcjs drew (it can only parse one digit; see core/abcText.js).
// Brackets are matched in reading order: by system (abcjs-l#), then voice (abcjs-v#), then position.
export function relabelTuplets(root, labels) {
  const num = (c, k) => +((new RegExp('abcjs-' + k + '(\\d+)').exec(c) || [])[1] || 0);
  const els = [...root.querySelectorAll('.abcjs-triplet')].map((e, i) => {
    const c = e.getAttribute('class') || '';
    return { e, i, l: num(c, 'l'), v: num(c, 'v') };
  }).sort((a, b) => a.l - b.l || a.v - b.v || a.i - b.i);
  if (els.length !== labels.length) return;
  // a tuplet of more than 9 notes was drawn as several brackets (label null = continuation): hide those and stretch
  // the first bracket (abcjs path: left tick, right tick, left half, right half) and its number over the whole group
  const xs = e => { const d = e.querySelector('path')?.getAttribute('d') || ''; return [...d.matchAll(/[ML]\s*([\d.]+)\s+([\d.]+)/g)].map(m => [+m[1], +m[2]]); };
  let head = null, right = -Infinity;
  const finish = () => {
    if (!head || right === -Infinity) return;
    const pts = xs(head.e), text = head.e.querySelector('text');
    const x0 = Math.min(...pts.map(p => p[0]).concat(text ? [+text.getAttribute('x')] : []));
    const mid = (x0 + right) / 2;
    if (text) { text.setAttribute('x', mid); text.querySelectorAll('tspan').forEach(t => t.setAttribute('x', mid)); }
    if (pts.length >= 8) {
      const yb = pts[0][1], yt = pts[1][1], gap = (pts[6][0] - pts[5][0]) / 2;
      head.e.querySelector('path').setAttribute('d', `M ${x0} ${yb} L ${x0} ${yt}M ${right} ${yb} L ${right} ${yt}M ${x0} ${yb} L ${mid - gap} ${yb}M ${mid + gap} ${yb} L ${right} ${yb}`);
    }
  };
  els.forEach(({ e }, j) => {
    const t = e.querySelector('tspan') || e.querySelector('text');
    if (labels[j] === null) {
      if (head) { const pts = xs(e), tx = e.querySelector('text'); right = Math.max(right, ...pts.map(p => p[0]), tx ? +tx.getAttribute('x') + 6 : -Infinity); }
      e.style.display = 'none';
      return;
    }
    finish(); head = { e }; right = -Infinity;
    if (t && t.textContent !== String(labels[j])) t.textContent = String(labels[j]);
  });
  finish();
}

export function render() {
  if (pending) { cancelAnimationFrame(pending.raf); clearTimeout(pending.timer); pending = 0; }  // this draw covers it
  if (!S.rec) return;
  const A = analysisFor(S.rec, S.opt, latencies());
  S.A = A;
  const tag = $('#srcTag'), R = S.rec;
  // Only say where the notes came from when they are not the player's own take; tempo and meter are on the staff.
  // A take keeps an empty, hidden .tag.user: the LCD buddy cheers on it.
  tag.textContent = R.source === 'shared' ? (R.title ? T('Shared: {title}', { title: R.title }) : T('Shared rhythm')) : R.source !== 'user' ? T('Example') : '';
  tag.hidden = R.source === 'user';
  tag.className = 'tag' + (R.source === 'user' || R.source === 'shared' ? ' user' : '');
  $('#countNote').textContent = A.twoVoice && countMode() !== 'off' ? T('counting shows under one-voice rhythms') : '';
  if (sharePanelOpen()) updateShare();
  $('#shiftVal').textContent = (R.barShift || 0) > 0 ? '+' + R.barShift : String(R.barShift || 0);
  if (A.empty) {
    $('#score').innerHTML = `<p style="color:var(--ink-3)">${T('Every tap is ignored. Click a grey tap in the chart to bring it back.')}</p>`;
    $('#stats').innerHTML = ''; drawChart(A); renderHooks.forEach(f => f(A)); return;
  }
  // abc: what abcjs can draw; the ABC source view shows the exact text (they differ only for 10- to 13-lets)
  const labels = [], abc = toAbc(A, A.startBar, { count: countMode(), abcjs: labels });
  $('#abcOut').textContent = toAbc(A, A.startBar, { count: countMode() });
  const box = $('#score'); box.style.width = box.style.height = '';  // abcjs pins the box to the last drawing's size
  const room = box.clientWidth, w = Math.max(300, room - 10);
  if (window.ABCJS) {
    const draw = scale => ABCJS.renderAbc('score', abc, {
      staffwidth: w, scale, paddingleft: 0, paddingright: 0, paddingtop: 6 + barBracketPad(A.M), paddingbottom: 6,
      foregroundColor: css('--ink'), add_classes: true,
    });
    const scale = w < 520 ? 0.85 : 1.1;
    draw(scale);
    // a dense bar can come out wider than the staff; on a phone that would push the page sideways, so draw it smaller
    const drawn = box.querySelector('svg')?.getBoundingClientRect().width || 0;
    if (room > 0 && drawn > room + 2) draw(scale * room / drawn * 0.98);  // (room 0: hidden, nothing to fit)
    relabelTuplets(box, labels);
    drawBarBrackets(box, A.M, css('--ink'));
    box.style.width = '';  // let the paper fill the panel again
  } else $('#score').innerHTML = `<p>${T('Notation library failed to load. The ABC source below is still valid.')}</p>`;
  // Just the size of the result; how the taps were corrected shows in the timing chart.
  const count = v => A.notes.filter(n => n.v === v).length;
  const bits = [
    `<span>${A.twoVoice ? T('<b>{low}</b> low · <b>{high}</b> high notes', { low: count(2), high: count(1) }) : plural(A.notes.length, '<b>{n}</b> note', '<b>{n}</b> notes')}</span>`,
    `<span>${plural(A.endBar - A.startBar, '<b>{n}</b> bar', '<b>{n}</b> bars')}</span>`,
  ];
  $('#stats').innerHTML = bits.join('');
  drawChart(A);
  renderHooks.forEach(f => f(A));
}
