// Keyboard and pointer input.
//   Space / J  tap (high voice)      F  low voice (two voices)      T  tap tempo
//   Enter / Esc  stop recording      Esc  cancel calibration
//   Rhythm pad: click/touch; with two voices the left half is the low voice. TAP key: tap tempo.
import { S, rec, calib } from '../state.js';
import { $, isTyping } from '../ui/dom.js';
import { tapDown, tapUp } from './taps.js';
import { stopRecording } from '../features/recorder.js';
import { finishCalib } from '../features/calibration.js';

const keyVoice = e => {
  if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyJ') return 1;
  if (e.code === 'KeyF' && S.twoVoices) return 2;
  return 0;
};

export function bindKeyboard() {
  $('#tempoTap').addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); tapDown(e.timeStamp, { origin: 'tempo' }); } });
  document.addEventListener('keydown', e => {
    if (e.code === 'KeyT' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat && rec.state === 'idle' && !isTyping(e.target)) { e.preventDefault(); tapDown(e.timeStamp, { origin: 'tempo' }); return; }
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
