// The tap router: every input (keys, pad, mic, MIDI, the TAP key) ends up here, and the tap goes to whichever
// mode is active — calibration, a recording in progress, tap tempo, or "start a new recording".
import { S, rec, calib } from '../state.js';
import { $, flash } from '../ui/dom.js';
import { calibTap } from '../features/calibration.js';
import { recordDown, recordUp, startRecording } from '../features/recorder.js';
import { tempoTap } from '../features/tempo.js';

// origin: 'tempo' (the TAP key or T), otherwise the rhythm: pad, space/J/F, mic, MIDI
// v: voice (1 high, 2 low); key: what is held (for note lengths); src: 'key' | 'mic' | 'midi'
export function tapDown(time, { origin = 'global', v = 1, key = null, src = 'key' } = {}) {
  if (calib.active) { calibTap(time, src); flash($('#rhythmPad'), v); return; }
  if (rec.state !== 'idle') { recordDown(time, key, v, src); return; }
  if (origin === 'tempo') { tempoTap(time); return; }
  if (src === 'mic' && !S.free) return; // a stray noise should not start a count-in
  startRecording();
  if (S.free) recordDown(time, key, v, src);
}

export function tapUp(time, key) { if (rec.state !== 'idle') recordUp(time, key); }
