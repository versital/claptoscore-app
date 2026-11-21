// Keyboard and pointer input.
//   Space / J / K  tap (high voice)  F / D  low voice (two voices; with one voice they tap too)  T  tap tempo
//   Practice tab: Space and every letter and digit key tap, so fast rhythms can alternate fingers
//   Enter / Esc  stop recording      Esc  cancel calibration
//   Rhythm pad: click/touch; with two voices the left half is the low voice. TAP key: tap tempo.
import { S, rec, calib } from '../state.js';
import { $, isTyping } from '../ui/dom.js';
import { tapDown, tapUp } from './taps.js';
import { stopRecording } from '../features/recorder.js';
import { finishCalib } from '../features/calibration.js';
import { practiceTab } from '../features/practice.js';

// Several keys per voice, so fast passages can alternate hands or fingers. Each key is held on its own
// (note lengths and Hold mode follow every key separately).
export const HIGH_KEYS = new Set(['Space', 'KeyJ', 'KeyK']), LOW_KEYS = new Set(['KeyF', 'KeyD']);
const keyVoice = e => {
  if (practiceTab()) return e.code === 'Space' || e.key === ' ' || /^(Key[A-Z]|Digit\d|Numpad\d)$/.test(e.code) ? 1 : 0;
  if (HIGH_KEYS.has(e.code) || e.key === ' ') return 1;
  if (LOW_KEYS.has(e.code)) return S.twoVoices ? 2 : 1;
  return 0;
};

export function bindKeyboard() {
  $('#tempoTap').addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); tapDown(e.timeStamp, { origin: 'tempo' }); } });
  document.addEventListener('keydown', e => {
    if (e.code === 'KeyT' && !practiceTab() && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat && rec.state === 'idle' && !isTyping(e.target)) { e.preventDefault(); tapDown(e.timeStamp, { origin: 'tempo' }); return; }
    const v = keyVoice(e);
    if (v && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (isTyping(e.target)) return;
      e.preventDefault(); if (e.repeat) return;
      tapDown(e.timeStamp, { v, key: e.code, src: 'key' });
    } else if ((e.key === 'Enter' || e.key === 'Escape') && rec.state !== 'idle') { e.preventDefault(); stopRecording(); }
    else if (e.key === 'Escape' && calib.active) finishCalib(true);
  });
  document.addEventListener('keyup', e => {
    if (keyVoice(e) && !isTyping(e.target)) { e.preventDefault(); tapUp(e.timeStamp, e.code); }
  });
}

export function bindPad() {
  const el = $('#rhythmPad'), origin = 'rhythm';
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch {}
    const r = el.getBoundingClientRect();
    const v = S.twoVoices && e.clientX < r.left + r.width / 2 ? 2 : 1;
    tapDown(e.timeStamp, { origin, v, key: 'p' + e.pointerId, src: 'key' });
  });
  el.addEventListener('pointerup', e => tapUp(e.timeStamp, 'p' + e.pointerId));
  el.addEventListener('pointercancel', e => tapUp(e.timeStamp, 'p' + e.pointerId));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
