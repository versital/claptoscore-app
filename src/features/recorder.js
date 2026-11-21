// Step 2: recording a take — with the metronome (count-in, auto-stop after 2 silent bars, 64-bar limit) or in
// free tempo (no click; tempo and barlines inferred afterwards). Live provisional notation while recording.
import { S, rec, calib, latencies } from '../state.js';
import { METERS } from '../core/meters.js';
import { median } from '../core/stats.js';
import { analyze } from '../core/analyze.js';
import { inferFreeTake } from '../core/freeTempo.js';
import { toAbc } from '../core/abc.js';
import { T, plural } from '../services/i18n.js';
import { store } from '../services/store.js';
import { metro, metroStart, metroStop } from '../audio/metronome.js';
import { stopPlay } from '../audio/playback.js';
import { setBeatListeners } from '../ui/beatDots.js';
import { setStep } from '../ui/steps.js';
import { $, css, flash, reducedMotion } from '../ui/dom.js';
import { finishCalib } from './calibration.js';
import { buildFinest, syncControls } from './cleanup.js';
import { render, relabelTuplets } from './notation.js';
import { drawBarBrackets, barBracketPad } from '../ui/barBrackets.js';

const freeTake = taps => inferFreeTake(taps, rec.meter, { opt: S.opt, lat: latencies(), hintBpm: S.tempoHint ? S.bpm : null });

function setRecButton(on) {
  $('#recBtn').className = on ? 'btn rec' : 'btn primary';
  $('#recBtn').innerHTML = `<span class="ic">${on ? '■' : '●'}</span>`; $('#recBtn').setAttribute('aria-label', on ? T('Stop') : T('Rec')); $('#recBtn').title = on ? T('Stop') : T('Rec');
}

export function padIdle(sub) {
  $('#rhythmPad').className = 'pad pad-lg' + (S.twoVoices ? ' split' : '');
  $('#padMain').textContent = S.free ? T('Tap to begin') : T('Click or space');
  $('#padSub').textContent = sub ?? (S.free ? '' : plural(S.countIn, 'Count-in: {n} bar', 'Count-in: {n} bars'));
}

export function startRecording() {
  if (calib.active) finishCalib(true);
  if (metro.mode) metroStop();
  stopPlay();
  setStep(2);
  const M = METERS[S.meter];
  Object.assign(rec, { taps: [], downbeat: null, bpm: S.bpm, meter: S.meter, countBeats: M.beats * S.countIn, holding: new Map(), free: S.free });
  setRecButton(true);
  $('.live').classList.add('on'); $('#liveScore').innerHTML = '';
  $('#liveInfo').textContent = S.free ? '' : T('count-in…');
  const pad = $('#rhythmPad');
  if (S.free) {
    rec.state = 'free';
    pad.className = 'pad pad-lg recording' + (S.twoVoices ? ' split' : '');
    $('#padMain').textContent = T('Tap the rhythm');
    $('#padSub').textContent = T('waiting for first tap');
    rec.timer = setInterval(freeTick, 100);
    return;
  }
  rec.state = 'countin';
  const bpb = M.beats, beatMs = 60000 / S.bpm;
  metroStart({ bpm: S.bpm, meter: S.meter, subdiv: S.subdiv, mode: 'record',
    audible: b => S.clickOn || b < rec.countBeats,
    onBeat: (b, perf) => {
      if (b === rec.countBeats) rec.downbeat = perf;
      const rb = b - rec.countBeats;
      if (rb > 0 && S.autoStop && rec.downbeat !== null && rec.taps.length) {
        const last = Math.max(...rec.taps.map(x => x.up ?? x.t));
        const lastBar = Math.floor((last - rec.downbeat) / beatMs / bpb);
        if (rb >= (lastBar + 3) * bpb) { setTimeout(stopRecording, Math.max(0, perf - performance.now())); return false; }
      }
      if (rb >= 64 * bpb) { setTimeout(stopRecording, 0); return false; }
    } });
  setBeatListeners([b => {
    if (rec.state === 'idle') return;
    const rb = b - rec.countBeats, split = S.twoVoices ? ' split' : '';
    if (rb < 0) {
      rec.state = 'countin'; pad.className = 'pad pad-lg counting' + split;
      $('#padMain').innerHTML = `<span class="pad-big">${(-rb - 1) % bpb + 1}</span>`;
      $('#padSub').textContent = rb >= -bpb ? T('get ready…') : T('count-in');
    } else {
      rec.state = 'rec'; pad.className = 'pad pad-lg recording' + split;
      $('#padMain').innerHTML = `<span class="pad-big">${Math.floor(rb / bpb) + 1}<span style="font-size:.4em;color:var(--ink-3)">.${rb % bpb + 1}</span></span>`;
      $('#padSub').textContent = T('{n} taps · Enter to stop', { n: rec.taps.length });
      scheduleLive();
    }
  }]);
}

// Free tempo: show progress; auto-stop after a long pause (≥ 2.5 s or 4 typical gaps), hard limit 3 minutes.
function freeTick() {
  const n = rec.taps.length;
  if (!n) return;
  const now = performance.now(), first = rec.taps[0].t;
  const last = Math.max(...rec.taps.map(x => x.up ?? x.t));
  const iois = rec.taps.slice(1).map((x, i) => x.t - rec.taps[i].t);
  const quiet = Math.max(2500, 4 * median(iois));
  $('#padSub').textContent = T('{n} taps · {s} s · Enter to stop', { n, s: ((now - first) / 1000).toFixed(1) });
  if ((S.autoStop && rec.holding.size === 0 && now - last > quiet) || now - first > 180000) stopRecording();
}

// key: identifies the held key/pointer/MIDI note so its release sets the note length (null for mic claps).
export function recordDown(time, key, v, src) {
  if (rec.state === 'idle') return;
  flash($('#rhythmPad'), v);
  const tap = { t: time, up: null, v, src };
  rec.taps.push(tap);
  if (key !== null) rec.holding.set(key, tap);
  if (rec.state === 'free' || rec.state === 'rec') $('#padSub').textContent = T('{n} taps · Enter to stop', { n: rec.taps.length });
  scheduleLive();
}
export function recordUp(time, key) {
  const tap = rec.holding.get(key);
  if (tap) { tap.up = time; rec.holding.delete(key); if (S.opt.lengths === 'held') scheduleLive(); }
}

export function stopRecording() {
  if (rec.state === 'idle') return;
  const D = rec.downbeat;
  if (rec.state !== 'idle') liveRender(); // draw the final taps before the take is closed
  rec.state = 'idle'; clearInterval(rec.timer); metroStop(); setBeatListeners([]);
  $('.live').classList.remove('on');
  $('#liveInfo').textContent = T('last take · clean-up below');
  setRecButton(false);
  for (const [, tap] of rec.holding) tap.up = performance.now();
  rec.holding.clear();
  if (!rec.taps.length || (!rec.free && D === null)) { padIdle(T('No taps recorded')); return; }
  let take;
  if (rec.free) {
    take = freeTake(rec.taps);
    if (!take) { padIdle(T('Tap at least 3 times so there is a tempo to find')); return; }
  } else {
    take = { bpm: rec.bpm, meter: rec.meter, source: 'user',
      taps: rec.taps.map(x => ({ t: x.t - D, up: x.up === null ? null : x.up - D, v: x.v, src: x.src })) };
  }
  padIdle(T('{n} taps captured', { n: take.taps.length }) + (take.free ? ' · ' + T('tempo found: {bpm} BPM', { bpm: Math.round(take.bpm) }) : ''));
  $('#padMain').textContent = S.free ? T('Tap for another take') : T('Click or space for another take');
  S.rec = take;
  store.set('rec', S.rec);
  buildFinest(); syncControls();
  render();
  if (S.jumpToResult) $('.result').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

export const toggleRecording = () => rec.state === 'idle' ? startRecording() : stopRecording();

// ---------- live notation while recording ----------
// Re-analyses the take so far on every tap (and every beat with a click), at most once per frame,
// and draws the last two bars. Tap times are event timestamps, so rendering never shifts them.
let liveQueued = false;
function scheduleLive() {
  if (liveQueued) return;
  liveQueued = true;
  requestAnimationFrame(() => { liveQueued = false; try { liveRender(); } catch (err) { console.warn('live render', err); } });
}
function liveTake() {
  if (rec.free) {
    if (rec.taps.length < 4) return null;
    return freeTake(rec.taps);
  }
  if (rec.downbeat === null || !rec.taps.length) return null;
  const D = rec.downbeat, beatMs = 60000 / rec.bpm;
  return { bpm: rec.bpm, meter: rec.meter, source: 'user', liveBeat: (performance.now() - D) / beatMs,
    taps: rec.taps.map(x => ({ t: x.t - D, up: x.up === null ? null : x.up - D, v: x.v, src: x.src })) };
}
function liveRender() {
  if (rec.state === 'idle') return;
  const info = $('#liveInfo');
  const take = liveTake();
  if (!take) { info.textContent = rec.free ? T('{n}/4 taps before the tempo shows', { n: rec.taps.length }) : T('listening…'); return; }
  const A = analyze(take, S.opt, latencies());
  if (A.empty) return;
  const from = Math.max(A.startBar, A.endBar - 2);
  const bars = T('bars {a}–{b} · provisional', { a: from - A.startBar + 1, b: A.endBar - A.startBar });
  info.textContent = rec.free ? `≈ ${Math.round(take.bpm)} BPM, ${bars}` : bars;
  const el = $('#liveScore'); el.style.width = el.style.height = '';
  const w = Math.max(260, el.clientWidth - 6);
  const labels = [];
  if (window.ABCJS) {
    ABCJS.renderAbc('liveScore', toAbc(A, from, { lyrics: false, abcjs: labels }).replace(/^Q:.*\n/m, ''), {
      staffwidth: w, scale: w < 420 ? 0.8 : 0.95, paddingleft: 0, paddingright: 0, paddingtop: barBracketPad(A.M), paddingbottom: 0,
      foregroundColor: css('--ink'), add_classes: true,
    });
    relabelTuplets(el, labels);
    drawBarBrackets(el, A.M, css('--ink'));
  }
}

export function bindRecorder() {
  $('#recBtn').addEventListener('click', toggleRecording);
}
