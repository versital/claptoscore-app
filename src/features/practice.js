// Practice tab: play a random rhythm at a chosen level, tempo, meter and length. The score is drawn as one long
// line that scrolls past a fixed playhead; notes turn green / ochre when hit and red when missed, and the run ends
// with an accuracy percentage. Generation and scoring live in core/practice.js.
import { S, calib } from '../state.js';
import { METERS, accentOf } from '../core/meters.js';
import { toAbc, exercise } from '../core/rhythmCode.js';
import { generate, scoreRun, noteTimes, windows, groupsFor, levelName, MAX_LEVEL, GOOD_MS, MIX, MIX_NAMES } from '../core/practice.js';
import { T, plural } from '../services/i18n.js';
import { store } from '../services/store.js';
import { audio, ctx, audioToPerf } from '../audio/context.js';
import { click, wood } from '../audio/sounds.js';
import { metro, metroStart, metroStop } from '../audio/metronome.js';
import { stopPlay } from '../audio/playback.js';
import { $, $$, css, toast, isTyping } from '../ui/dom.js';
import { finishCalib } from './calibration.js';
import { rec } from '../state.js';
import { stopRecording } from './recorder.js';
import { buildDots } from '../ui/beatDots.js';
import { fillMeterSelect } from './meterPicker.js';
import { drawBarBrackets, barBracketPad } from '../ui/barBrackets.js';
import { actionOf } from '../services/keybinds.js';
import { BPM_MIN, BPM_MAX } from './tempo.js';

const P = { mode: 'tap', level: 2, custom: ['basic', 'eighths'], bpm: 100, meter: '4/4', bars: 8, click: true, mix: {} };  // mix: group -> MIX index
let R = null;      // the current rhythm (rhythm-code object), its seed and note times
let view = null;   // the drawn line: { pts: [[ms, x]], heads: [[el]] per note, width }
let run = null;    // a run in progress: { start, notes, win, taps, done: Set, raf }
let listenBag = [], listenTimer = 0, listenRaf = 0;

export const practiceTab = () => document.body.dataset.tab === 'practice';
export const practiceRunning = () => !!run;
const save = () => store.set('practice', P);
const latOf = src => src === 'mic' ? S.micLatency : S.latency;

// ---------- input (from input/taps.js) ----------
export function practiceDown(time, { origin = 'global', key = null, src = 'key' } = {}) {
  if (origin === 'tempo') return;                  // T / the tempo key do nothing here
  if (!run) { if (src !== 'mic') start(); return; }  // the first press starts the count-in
  if (run.start == null) return;
  const t = time - latOf(src) - run.start;
  if (t < -400) return;                            // claps during the count-in are not part of the rhythm
  run.taps.push({ t, up: null, key });
  liveMark(t);
}
export function practiceUp(time, key) {
  if (!run || run.start == null) return;
  for (let i = run.taps.length - 1; i >= 0; i--) {
    const x = run.taps[i];
    if (x.key === key && x.up == null) { x.up = time - latOf('key') - run.start; return; }
  }
}

// ---------- rhythm and drawing ----------
function newRhythm(seed = (Math.random() * 2 ** 31) >>> 0) {
  const mix = Object.fromEntries(Object.entries(P.mix).map(([g, k]) => [g, MIX[k] ?? 1]));
  R = generate({ meter: P.meter, bpm: P.bpm, bars: P.bars, level: P.level, custom: P.level === 0 ? P.custom : null, mix, seed });
  R.seed = seed;
  R.times = noteTimes(R);
  draw();
}

function draw() {
  if (!R || !window.ABCJS) return;
  const stage = $('#prStage'), el = $('#prScore');
  const M = METERS[R.meter], tpb = M.tpb * R.u, barTicks = M.beats * tpb;
  // room per bar grows with its busiest bar, so 16ths and tuplets do not get squeezed
  const perBar = Array.from({ length: P.bars }, (_, b) => R.voices[0].filter(n => Math.floor(n.start / barTicks) === b).length);
  const barW = 70 + 30 * Math.max(M.beats, ...perBar);
  const w = Math.max(stage.clientWidth - 20, P.bars * barW);
  ABCJS.renderAbc('prScore', toAbc(R, { perLine: P.bars }), {
    staffwidth: w, scale: 1.15, paddingleft: 0, paddingright: 20, paddingtop: 4 + barBracketPad(M), paddingbottom: 4,
    foregroundColor: css('--paper-ink') || css('--ink'), add_classes: true,
  });
  drawBarBrackets(el, M, css('--paper-ink') || css('--ink'));
  el.style.width = el.style.height = '';
  // map time -> x: note heads (by note), barlines, and the start of the first bar
  const base = el.getBoundingClientRect().left, mid = e => { const r = e.getBoundingClientRect(); return (r.left + r.right) / 2 - base; };
  const heads = R.times.map(() => []), pts = [];
  const ex = exercise(R, P.bars);
  [...el.querySelectorAll('.abcjs-note')].forEach((e, k) => { const i = ex.heads[k]; if (i != null && heads[i]) heads[i].push(e); });
  heads.forEach((hs, i) => { if (hs[0]) pts.push([R.times[i].t, mid(hs[0])]); });
  const barMs = M.beats * 60000 / R.bpm;
  [...el.querySelectorAll('.abcjs-bar')].forEach((e, k) => pts.push([(k + 1) * barMs, mid(e)]));
  const first = [...el.querySelectorAll('.abcjs-m0')].filter(e => /abcjs-(note|rest)/.test(e.getAttribute('class')));
  if (first.length) pts.push([0, Math.min(...first.map(e => e.getBoundingClientRect().left - base))]);
  pts.sort((a, b) => a[0] - b[0] || b[1] - a[1]);  // a note on a downbeat wins over its barline
  const clean = [];
  for (const p of pts) if (!clean.length || (p[0] > clean[clean.length - 1][0] && p[1] >= clean[clean.length - 1][1])) clean.push(p);
  view = { pts: clean, heads, width: el.querySelector('svg')?.getBoundingClientRect().width || w };
  $('#prTitle').textContent = P.level ? T('Rhythm · Level {n}', { n: P.level }) : T('Rhythm · Custom');
  place(-1);
  $('#prHint').textContent = `${R.bpm} BPM · ${R.meter} · ${plural(P.bars, '{n} bar', '{n} bars')}`;
}

// x of time t (ms) on the drawn line
function xAt(t) {
  const p = view.pts;
  if (!p.length) return 0;
  if (t <= p[0][0]) return p[0][1];
  for (let k = 1; k < p.length; k++) if (t <= p[k][0]) return p[k - 1][1] + (p[k][1] - p[k - 1][1]) * (t - p[k - 1][0]) / (p[k][0] - p[k - 1][0]);
  return p[p.length - 1][1];
}
// Move the line and the playhead: the head travels to 30 % of the stage, then the music scrolls under it, and at
// the end the music stops and the head runs on to the last barline.
function place(t, manual = null) {
  if (!view) return;
  const stageW = $('#prStage').clientWidth, pad = 10, X = xAt(Math.max(0, t)), maxOff = Math.max(0, view.width - stageW + 2 * pad);
  const off = manual != null ? Math.max(0, Math.min(manual, maxOff)) : Math.max(0, Math.min(X - stageW * 0.3, maxOff));
  view.off = off; view.headT = t;
  $('#prRoll').style.transform = `translateX(${pad - off}px)`;
  $('#prHead').style.left = (pad + X - off) + 'px';
}
// While nothing plays, the line can be scrolled by hand (wheel, trackpad, dragging); the playhead stays at its time.
const busy = () => !!run || listenBag.length > 0;
function scrollLine(dx) { if (!view || busy()) return; place(view.headT ?? -1, (view.off || 0) + dx); }

const mark = (i, cls) => view?.heads[i]?.forEach(e => { e.classList.remove('pr-good', 'pr-ok', 'pr-miss'); e.classList.add(cls); });
function clearMarks() { $$('#prScore .pr-good, #prScore .pr-ok, #prScore .pr-miss').forEach(e => e.classList.remove('pr-good', 'pr-ok', 'pr-miss')); }

// colour the note a tap belongs to, right away (the final score is computed again at the end)
function liveMark(t) {
  const { notes, win } = run;
  let lo = 0, hi = notes.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (notes[m].t < t) lo = m + 1; else hi = m; }
  for (const i of [lo - 1, lo]) if (i >= 0 && i < notes.length && Math.abs(t - notes[i].t) <= win[i]) {
    const prev = run.best.get(i);
    if (prev == null || Math.abs(t - notes[i].t) < Math.abs(prev)) { run.best.set(i, t - notes[i].t); mark(i, Math.abs(t - notes[i].t) <= GOOD_MS ? 'pr-good' : 'pr-ok'); }
    return;
  }
}

// ---------- a run ----------
function start() {
  if (!R) newRhythm();
  if (calib.active) finishCalib(true);
  stopPlay(); stopListen();
  if (metro.mode) metroStop();
  clearMarks();
  $('#prResults').hidden = true; $('#prMsg').hidden = true;
  const M = METERS[R.meter], beatMs = 60000 / R.bpm, count = M.beats, beats = P.bars * M.beats;
  run = { start: null, notes: R.times, win: windows(R.times.map(n => n.t)), taps: [], best: new Map(), missed: 0, raf: 0, end: beats * beatMs };
  setStartButton(true);
  metroStart({
    bpm: R.bpm, meter: R.meter, mode: 'practice',
    audible: b => b < count || (P.click && b < count + beats),
    onBeat: (b, perf) => {
      if (b === 0 && run) {
        run.start = perf + count * beatMs;
        // animation frames stop in a hidden tab: a timer still ends the run
        const r = run; r.timer = setTimeout(() => { if (run === r) finish(); }, r.start - performance.now() + r.end + 400);
      }
      return b <= count + beats;
    },
  });
  const frame = () => {
    if (!run) return;
    const t = run.start == null ? -1 : performance.now() - run.start;
    place(t);
    // notes whose window has passed without a tap turn red
    while (run.missed < run.notes.length && t > run.notes[run.missed].t + run.win[run.missed]) {
      if (!run.best.has(run.missed)) mark(run.missed, 'pr-miss');
      run.missed++;
    }
    if (t > run.end + 250) { finish(); return; }
    run.raf = requestAnimationFrame(frame);
  };
  run.raf = requestAnimationFrame(frame);
}

export function stopPractice(msg) {
  if (!run) return;
  cancelAnimationFrame(run.raf); clearTimeout(run.timer); run = null;
  if (metro.mode === 'practice') metroStop();
  setStartButton(false);
  clearMarks(); place(-1);
  if (msg) { $('#prMsg').textContent = msg; $('#prMsg').hidden = false; }
}

function finish() {
  const taps = run.taps, hold = P.mode === 'hold';
  cancelAnimationFrame(run.raf); clearTimeout(run.timer); run = null;
  if (metro.mode === 'practice') metroStop();
  setStartButton(false);
  const s = scoreRun(R.times, taps, { hold });
  s.notes.forEach((r, i) => mark(i, r.tap < 0 ? 'pr-miss' : Math.abs(r.err) <= GOOD_MS ? 'pr-good' : 'pr-ok'));
  const pct = Math.round(s.accuracy * 100);
  $('#prResTitle').textContent = P.level ? T('Rhythm · Level {n}', { n: P.level }) : T('Rhythm · Custom');
  $('#prAcc').style.setProperty('--p', pct); $('#prAcc b').textContent = pct + '%';
  $('#prHits').style.setProperty('--p', R.times.length ? Math.round(100 * s.hits / R.times.length) : 0);
  $('#prHits b').textContent = `${s.hits}/${R.times.length}`;
  const bits = [plural(s.misses, '{n} miss', '{n} misses'), plural(s.extras, '{n} extra tap', '{n} extra taps'), `${R.bpm} BPM`];
  if (s.hits) {
    const m = Math.round(s.meanErr);
    bits.push(Math.abs(m) < 5 ? T('on time on average') : m > 0 ? T('{n} ms late on average', { n: m }) : T('{n} ms early on average', { n: -m }));
  }
  $('#prSum').textContent = bits.join(' · ');
  // the whole rhythm, wrapped, with the same colours
  ABCJS.renderAbc('prFull', toAbc(R, { perLine: 4 }), {
    staffwidth: Math.max(300, $('#prResults').clientWidth - 20), scale: 0.95, paddingleft: 0, paddingright: 0, paddingtop: 4 + barBracketPad(METERS[R.meter]), paddingbottom: 4,
    foregroundColor: css('--ink'), add_classes: true,
  });
  drawBarBrackets($('#prFull'), METERS[R.meter], css('--ink'));
  const ex = exercise(R, 4);
  [...$('#prFull').querySelectorAll('.abcjs-note')].forEach((e, k) => {
    const r = s.notes[ex.heads[k]]; if (r) e.classList.add(r.tap < 0 ? 'pr-miss' : Math.abs(r.err) <= GOOD_MS ? 'pr-good' : 'pr-ok');
  });
  $('#prResults').hidden = false;
  const best = store.get('practice.best') || {}, k = `${P.level || 'c'}|${R.meter}`;
  if (!(best[k] >= pct)) { best[k] = pct; store.set('practice.best', best); }
  place(Infinity);
}

function setStartButton(on) {
  const b = $('#prStart');
  b.className = on ? 'btn rec' : 'btn primary';
  b.innerHTML = on ? `<span class="ic">■</span> ${T('Stop')}` : `<span class="ic">●</span> ${T('Start')}`;
}

// ---------- listen: the rhythm on a woodblock over the click, with the line scrolling along ----------
let listenMsg = false;
function stopListen() {
  const was = listenBag.length > 0;
  listenBag.forEach(o => { try { o.stop(); } catch {} }); listenBag = []; clearTimeout(listenTimer);
  cancelAnimationFrame(listenRaf); listenRaf = 0;
  $('#prListen').innerHTML = `<span class="ic">▶</span> ${T('Listen')}`;
  if (!was) return;
  $$('#prScore .pr-play').forEach(e => e.classList.remove('pr-play'));
  $$('#prDots .dot.on').forEach(d => d.classList.remove('on'));
  if (!run) { place(-1); if (listenMsg) $('#prMsg').hidden = false; }
}
function listen() {
  if (listenBag.length) { stopListen(); return; }
  if (run) return;
  if (!R) newRhythm();
  audio(); stopPlay(); if (metro.mode) metroStop();
  const M = METERS[R.meter], beatSec = 60 / R.bpm, t0 = ctx.currentTime + 0.15, beats = (P.bars + 1) * M.beats;
  for (let b = 0; b < beats; b++) click(t0 + b * beatSec, accentOf(M, b), listenBag);
  const s0 = t0 + M.beats * beatSec;
  for (const n of R.times) wood(s0 + n.t / 1000, listenBag);
  $('#prListen').innerHTML = `<span class="ic">■</span> ${T('Listen')}`;
  listenTimer = setTimeout(stopListen, (beats * beatSec + 0.5) * 1000);
  // the playhead and the scrolling follow the sound (audio clock mapped to the page clock), each note lights up as
  // it sounds, and the beat dots count in
  clearMarks();
  listenMsg = !$('#prMsg').hidden; $('#prMsg').hidden = true;
  const startPerf = audioToPerf(s0), beatMs = beatSec * 1000, dots = $('#prDots').children, endMs = P.bars * M.beats * beatMs;
  let next = 0;
  const frame = () => {
    const t = performance.now() - startPerf;
    place(t);
    while (next < R.times.length && t >= R.times[next].t) { view?.heads[next]?.forEach(e => e.classList.add('pr-play')); next++; }
    const b = Math.floor((t + M.beats * beatMs) / beatMs);
    [...dots].forEach((d, i) => d.classList.toggle('on', b >= 0 && i === b % M.beats));
    if (t > endMs + 300) return;  // the timer stops the sound and tidies up
    listenRaf = requestAnimationFrame(frame);
  };
  listenRaf = requestAnimationFrame(frame);
}

// ---------- controls ----------
function fillLevels() {
  const sel = $('#prLevel');
  sel.innerHTML = `<option value="0">${T('Custom')}</option>` +
    Array.from({ length: MAX_LEVEL }, (_, k) => `<option value="${k + 1}">${k + 1} · ${levelName(P.meter, k + 1)}</option>`).join('');
  sel.value = String(P.level);
  const box = $('#prCustom');
  box.innerHTML = groupsFor(P.meter).map(g =>
    `<label class="pr-chk"><input type="checkbox" value="${g.id}"${P.custom.includes(g.id) ? ' checked' : ''}> <span>${T(g.name)}</span> <small>${g.level}</small></label>`).join('');
  box.hidden = P.level !== 0;
  fillMix();
}

// Rhythm mix: one slider per kind of rhythm in play (Rare … Lots); Normal is the level's own balance.
function fillMix() {
  const groups = groupsFor(P.meter).filter(g => P.level === 0 ? P.custom.includes(g.id) : g.level <= P.level);
  const k = g => P.mix[g.id] ?? 2;
  $('#prMix').innerHTML = groups.map(g => `<label class="pr-mix-row"><span>${T(g.name)}</span>
    <input type="range" min="0" max="${MIX.length - 1}" step="1" value="${k(g)}" data-g="${g.id}" aria-label="${T(g.name)}">
    <span class="val">${T(MIX_NAMES[k(g)])}</span></label>`).join('');
  const changedN = groups.filter(g => k(g) !== 2).length;
  $('#prMixHint').textContent = changedN ? plural(changedN, '{n} changed', '{n} changed') : '';
}

function changed(fn) { return e => { if (run) stopPractice(); stopListen(); fn(e); save(); newRhythm(); }; }

export function showPracticeTab(on) {
  document.body.dataset.tab = on ? 'practice' : 'notate';
  $$('.sitenav a[data-tab]').forEach(a => a.toggleAttribute('aria-current', a.dataset.tab === (on ? 'practice' : 'notate')));
  if (rec.state !== 'idle') stopRecording();
  if (on) { buildDots(P.meter, ['#prDots']); if (!R) newRhythm(); else draw(); }
  else { stopPractice(); stopListen(); }
}

export function bindPractice() {
  Object.assign(P, store.get('practice') || {});
  P.bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(+P.bpm) || 100));
  if (!METERS[P.meter]) P.meter = '4/4';
  $('#prBpm').value = P.bpm; fillMeterSelect($('#prMeter'), P.meter); $('#prBars').value = String(P.bars); $('#prClick').checked = P.click;
  $$('#prMode button').forEach(b => b.classList.toggle('on', b.dataset.v === P.mode));
  fillLevels();
  $('#prMode').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    P.mode = b.dataset.v; save(); $$('#prMode button').forEach(x => x.classList.toggle('on', x === b));
    $('#prModeNote').textContent = P.mode === 'hold' ? T('Hold each note for its written length (keys, mouse or touch).') : '';
  });
  $('#prLevel').addEventListener('change', changed(() => { P.level = +$('#prLevel').value; $('#prCustom').hidden = P.level !== 0; fillMix(); }));
  $('#prMix').addEventListener('input', e => {
    const r = e.target.closest('input[data-g]'); if (!r) return;
    r.parentElement.querySelector('.val').textContent = T(MIX_NAMES[+r.value]);
  });
  $('#prMix').addEventListener('change', changed(e => {
    const r = e.target.closest('input[data-g]'); if (!r) return;
    if (+r.value === 2) delete P.mix[r.dataset.g]; else P.mix[r.dataset.g] = +r.value;
    fillMix();
  }));
  $('#prMixReset').addEventListener('click', changed(() => { P.mix = {}; fillMix(); }));
  $('#prCustom').addEventListener('change', changed(() => {
    P.custom = [...$$('#prCustom input:checked')].map(x => x.value);
    if (!P.custom.length) { P.custom = ['basic']; $('#prCustom input[value=basic]').checked = true; toast(T('choose at least one kind of rhythm')); }
    fillMix();
  }));
  $('#prMeter').addEventListener('change', changed(() => { P.meter = $('#prMeter').value; fillLevels(); buildDots(P.meter, ['#prDots']); }));
  $('#prBars').addEventListener('change', changed(() => { P.bars = +$('#prBars').value; }));
  const setBpm = v => { P.bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(v) || P.bpm)); $('#prBpm').value = P.bpm; };
  $('#prBpm').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
  $('#prBpm').addEventListener('change', changed(() => setBpm(+$('#prBpm').value)));
  $('#prBpm').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  $('#prBpmDown').addEventListener('click', changed(() => setBpm(P.bpm - 4)));
  $('#prBpmUp').addEventListener('click', changed(() => setBpm(P.bpm + 4)));
  $('#prClick').addEventListener('change', () => { P.click = $('#prClick').checked; save(); });
  $('#prStart').addEventListener('click', () => run ? stopPractice(T('Stopped. Press space or Start to try again.')) : start());
  $('#prNew').addEventListener('click', () => { stopPractice(); stopListen(); newRhythm(); $('#prResults').hidden = true; });
  $('#prListen').addEventListener('click', listen);
  $('#prAgainNew').addEventListener('click', () => { newRhythm(); start(); });
  $('#prReplay').addEventListener('click', () => start());
  // the stage is a tap pad too
  // The stage: during a run every press is a tap. While stopped, dragging scrolls the line and a click (a press
  // that did not move) starts a run.
  const st = $('#prStage');
  let drag = null;
  st.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); try { st.setPointerCapture(e.pointerId); } catch {}
    if (busy()) { drag = null; if (run) practiceDown(e.timeStamp, { key: 'p' + e.pointerId, src: 'key' }); return; }
    drag = { id: e.pointerId, x: e.clientX, moved: false };
  });
  st.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    drag.moved = true; drag.x = e.clientX; st.classList.add('dragging');
    scrollLine(-dx);
  });
  const up = (e, cancel) => {
    if (drag && drag.id === e.pointerId) {
      const click = !drag.moved && !cancel; drag = null; st.classList.remove('dragging');
      if (click) practiceDown(e.timeStamp, { key: 'p' + e.pointerId, src: 'key' });
      return;
    }
    practiceUp(e.timeStamp, 'p' + e.pointerId);
  };
  st.addEventListener('pointerup', e => up(e, false));
  st.addEventListener('pointercancel', e => up(e, true));
  st.addEventListener('wheel', e => {
    if (busy() || !view) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if (!d) return;  // plain vertical wheel still scrolls the page
    e.preventDefault(); scrollLine(d);
  }, { passive: false });
  st.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (actionOf(e.code) !== 'stop' || isTyping(e.target)) return;
    if (run) { e.preventDefault(); stopPractice(T('Stopped. Press space or Start to try again.')); }
    else if (listenBag.length && practiceTab()) { e.preventDefault(); stopListen(); }
  });
  let rT = 0; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (practiceTab() && !run) draw(); }, 150); });
  // the tabs: #practice, anything else is the notation tool
  const fromHash = () => showPracticeTab(location.hash === '#practice');
  $$('.sitenav a[data-tab]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const on = a.dataset.tab === 'practice';
    history.replaceState(null, '', on ? '#practice' : location.pathname + location.search);
    showPracticeTab(on);
  }));
  addEventListener('hashchange', fromHash);
  fromHash();
}

// for tests and debugging in the console
export const practiceState = () => ({ P, R, run, view });
