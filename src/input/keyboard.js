// Keyboard and pointer input. Which key does what is the user's choice (services/keybinds.js, Keys window);
// the defaults: Space / J / K tap (high voice) · F / D low voice (two voices; with one voice they tap too) ·
// T tap tempo · Enter / Esc stop. Practice tab: optionally every letter and digit key taps. Esc cancels calibration.
//   Rhythm pad: click/touch; with two voices the left half is the low voice. TAP key: tap tempo.
import { S, rec, calib } from '../state.js';
import { $, isTyping } from '../ui/dom.js';
import { tapDown, tapUp } from './taps.js';
import { stopRecording } from '../features/recorder.js';
import { finishCalib } from '../features/calibration.js';
import { practiceTab } from '../features/practice.js';
import { keys, actionOf } from '../services/keybinds.js';

// Several keys per voice, so fast passages can alternate hands or fingers. Each key is held on its own
// (note lengths and Hold mode follow every key separately).
const keyVoice = e => {
  const a = actionOf(e.code);
  if (practiceTab()) return a === 'high' || a === 'low' || (keys.anyInPractice && a !== 'stop' && /^(Space|Key[A-Z]|Digit\d|Numpad\d)$/.test(e.code)) ? 1 : 0;
  if (a === 'high') return 1;
  if (a === 'low') return S.twoVoices ? 2 : 1;
  return 0;
};

export function bindKeyboard() {
  $('#tempoTap').addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); tapDown(e.timeStamp, { origin: 'tempo' }); } });
  document.addEventListener('keydown', e => {
    if (actionOf(e.code) === 'tempo' && !practiceTab() && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat && rec.state === 'idle' && !isTyping(e.target)) { e.preventDefault(); tapDown(e.timeStamp, { origin: 'tempo' }); return; }
    const v = keyVoice(e);
    if (v && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (isTyping(e.target)) return;
      e.preventDefault(); if (e.repeat) return;
      tapDown(e.timeStamp, { v, key: e.code, src: 'key' });
    } else if (actionOf(e.code) === 'stop' && rec.state !== 'idle' && !isTyping(e.target)) { e.preventDefault(); stopRecording(); }
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
