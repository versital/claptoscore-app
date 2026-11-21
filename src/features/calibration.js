// Latency: one offset for keyboard / clicks / MIDI and one for the microphone, typed in or calibrated
// (4 clicks to listen, then tap or clap along with the next 12; the median offset becomes the latency).
import { S, rec, calib } from '../state.js';
import { median } from '../core/stats.js';
import { T } from '../services/i18n.js';
import { store } from '../services/store.js';
import { metroStart, metroStop } from '../audio/metronome.js';
import { $ } from '../ui/dom.js';
import { render } from './notation.js';

export function startCalib() {
  if (rec.state !== 'idle') return;
  calib.active = true; calib.taps = []; calib.beats = [];
  $('#calibInfo').textContent = T('Listen for 4, then tap along…');
  $('#calibBtn').textContent = T('Cancel');
  metroStart({ bpm: S.bpm, meter: S.meter, mode: 'calib', onBeat: (b, perf) => {
    if (b >= 16) { setTimeout(finishCalib, 400); return false; }
    calib.beats[b] = perf;
    if (b >= 4) setTimeout(() => { if (calib.active) $('#calibInfo').textContent = T('tap… {n}/12', { n: b - 3 }); }, Math.max(0, perf - performance.now()));
  } });
}

export function finishCalib(cancel) {
  if (!calib.active) return;
  calib.active = false; metroStop(); $('#calibBtn').textContent = T('Calibrate');
  if (cancel) { $('#calibInfo').textContent = ''; return; }
  const beatMs = 60000 / S.bpm, offs = [];
  const micTaps = calib.taps.filter(x => x.src === 'mic');
  const src = micTaps.length > calib.taps.length / 2 ? 'mic' : 'key';
  for (const { time: t } of calib.taps.filter(x => (x.src === 'mic') === (src === 'mic'))) {
    let best = null;
    for (let k = 4; k < calib.beats.length; k++) { const d = t - calib.beats[k]; if (best === null || Math.abs(d) < Math.abs(best)) best = d; }
    if (best !== null && Math.abs(best) < beatMs * 0.35) offs.push(best);
  }
  if (offs.length < 6) { $('#calibInfo').textContent = T('Only {n} usable taps; try again', { n: offs.length }); return; }
  const m = Math.round(median(offs));
  const spread = Math.round(median(offs.map(x => Math.abs(x - m))));
  setLatency(src, m);
  const v = { n: offs.length, ms: Math.abs(m), spread };
  $('#calibInfo').textContent = src === 'mic'
    ? (m >= 0 ? T('Microphone: {n} taps, you land {ms} ms late (±{spread} ms)', v) : T('Microphone: {n} taps, you land {ms} ms early (±{spread} ms)', v))
    : (m >= 0 ? T('Keyboard & clicks: {n} taps, you land {ms} ms late (±{spread} ms)', v) : T('Keyboard & clicks: {n} taps, you land {ms} ms early (±{spread} ms)', v));
}

const fmtMs = v => (v > 0 ? '+' : '') + v + ' ms';
export function showLatency() {
  $('#latency').value = S.latency; $('#micLatency').value = S.micLatency;
  $('#latVal').innerHTML = `<i class="i i-keyboard"></i>${fmtMs(S.latency)} · <i class="i i-mic"></i>${fmtMs(S.micLatency)}`;
}

// src: 'mic' | anything else (keyboard, clicks, MIDI)
export function setLatency(src, v) {
  v = Math.round(+v || 0);
  if (src === 'mic') { S.micLatency = v; store.set('micLatency', v); } else { S.latency = v; store.set('latency', v); }
  showLatency(); render();
}

// A tap during calibration (from any input).
export function calibTap(time, src) { calib.taps.push({ time, src }); }

export function bindCalibration() {
  $('#calibBtn').addEventListener('click', () => calib.active ? finishCalib(true) : startCalib());
  $('#latency').addEventListener('change', e => setLatency('key', e.target.value));
  $('#micLatency').addEventListener('change', e => setLatency('mic', e.target.value));
}
