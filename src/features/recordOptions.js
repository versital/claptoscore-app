// Rhythm panel options: timing (with metronome / free tempo), one or two voices, count-in, click while tapping,
// tempo hint, auto-stop. The mic and MIDI toggles live in input/.
import { S, rec } from '../state.js';
import { T } from '../services/i18n.js';
import { store } from '../services/store.js';
import { $, $$, syncSeg, onSeg } from '../ui/dom.js';
import { setStep } from '../ui/steps.js';
import { padIdle } from './recorder.js';

function updateMoreHint() {
  const on = [S.free && T('free tempo'), S.twoVoices && T('two voices')].filter(Boolean);
  $('#more2 .more-hint').innerHTML = on.length ? `<b>${on.join(' · ')}</b>` : T('free tempo, two voices, count-in');
}

export function setVoices(two) {
  S.twoVoices = two; store.set('twoVoices', two);
  syncSeg('#voices', v => (v === '2') === two);
  $$('.pad-voice').forEach(x => { x.hidden = !two; });
  updateMoreHint();
  if (rec.state === 'idle') padIdle(); else $('#rhythmPad').classList.toggle('split', two);
}

export function setTiming(free) {
  S.free = free; store.set('free', free);
  syncSeg('#timing', v => (v === 'free') === free);
  $$('.click-only').forEach(x => { x.hidden = free; });
  $$('.free-only').forEach(x => { x.hidden = !free; });
  $('#autoStopLbl').textContent = free ? T('Stop after a long pause') : T('Stop after 2 silent bars');
  updateMoreHint();
  if (rec.state === 'idle') padIdle();
}

export function bindRecordOptions() {
  $('#p2').addEventListener('pointerdown', () => setStep(2));
  $('#countIn').addEventListener('change', e => { S.countIn = +e.target.value; if (rec.state === 'idle') padIdle(); });
  $('#clickOn').addEventListener('change', e => { S.clickOn = e.target.checked; });
  $('#autoStop').addEventListener('change', e => { S.autoStop = e.target.checked; });
  $('#tempoHint').addEventListener('change', e => { S.tempoHint = e.target.checked; });
  onSeg('#voices', v => setVoices(v === '2'));
  onSeg('#timing', v => { if (rec.state === 'idle') setTiming(v === 'free'); });
}
