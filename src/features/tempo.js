// Step 1: tempo (field, −/+, tap tempo, T key), meter, subdivision clicks and the preview metronome.
import { S, rec, calib } from '../state.js';
import { METERS } from '../core/meters.js';
import { median } from '../core/stats.js';
import { store } from '../services/store.js';
import { metro, metroStart, metroStop } from '../audio/metronome.js';
import { buildDots } from '../ui/beatDots.js';
import { noteGroup } from '../ui/noteIcons.js';
import { $, flash } from '../ui/dom.js';

// Tempo range: no musical limit, only what the field holds (4 digits) and the metronome can schedule.
export const BPM_MIN = 1, BPM_MAX = 9999;

let tempoTaps = [];
// Tap tempo: median-filtered average of the last (up to 12) intervals; a 2.2 s pause starts over.
export function tempoTap(time) {
  flash($('#tempoTap'));
  if (tempoTaps.length && time - tempoTaps[tempoTaps.length - 1] > 2200) tempoTaps = [];
  tempoTaps.push(time);
  if (tempoTaps.length > 12) tempoTaps.shift();
  if (tempoTaps.length < 2) return;
  const iv = []; for (let i = 1; i < tempoTaps.length; i++) iv.push(tempoTaps[i] - tempoTaps[i - 1]);
  const med = median(iv);
  const kept = iv.filter(x => Math.abs(x - med) / med < 0.25); // drop stumbles and skipped beats
  const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
  setBpm(Math.round(60000 / mean), false);
}

let restartTimer = 0;
// restart: restart a running preview now; otherwise a running preview restarts after 600 ms of quiet.
export function setBpm(v, restart = true) {
  v = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(v) || 96));
  S.bpm = v; $('#bpm').value = v; fitBpm(); store.set('bpm', v); updateHint();
  if (restart && metro.mode === 'preview') startPreview();
  else if (metro.mode === 'preview') { clearTimeout(restartTimer); restartTimer = setTimeout(startPreview, 600); }
}
// four digits get a smaller font, so the number still fits the display
export const fitBpm = () => $('#bpm').classList.toggle('four', $('#bpm').value.length > 3);
export function updateHint() { $('#p2hint').textContent = `${S.bpm} BPM · ${S.meter}`; $('#hintBpm').textContent = S.bpm; }

export function setMetroBtn(on) {
  const b = $('#metroBtn');
  b.innerHTML = `<span class="ic">${on ? '■' : '▶'}</span><i class="i i-metronome"></i>`; b.setAttribute('aria-pressed', String(on));
}
export function startPreview() {
  metroStart({ bpm: S.bpm, meter: S.meter, subdiv: S.subdiv, mode: 'preview', onStop: () => setMetroBtn(false) });
  setMetroBtn(true);
}

export function subIcon() { $('#subLbl .sub-ic').innerHTML = noteGroup(METERS[S.meter].compound ? { n: 3, beams: 1 } : { n: 2, beams: 1 }, 0.75); }

export function bindTempo() {
  $('#bpmDown').addEventListener('click', () => setBpm(S.bpm - 1));
  $('#bpmUp').addEventListener('click', () => setBpm(S.bpm + 1));
  // The display is the tempo field: click anywhere on it to type; the whole number is selected, so typing replaces it.
  // Enter or leaving the field sets it, Esc puts the old tempo back, the arrow keys step it (Shift: by 10).
  const f = $('#bpm');
  f.closest('.bpm').addEventListener('pointerdown', e => { if (e.target !== f) { e.preventDefault(); f.focus(); } });
  f.addEventListener('focus', () => setTimeout(() => f.select(), 0));
  f.addEventListener('input', () => { f.value = f.value.replace(/\D/g, ''); fitBpm(); });
  f.addEventListener('change', () => setBpm(+f.value));
  f.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); f.blur(); }
    else if (e.key === 'Escape') { f.value = S.bpm; f.blur(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setBpm(S.bpm + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)); f.select(); }
  });
  $('#meter').addEventListener('change', e => {
    S.meter = e.target.value; store.set('meter', S.meter); buildDots(S.meter); updateHint(); subIcon();
    if (metro.mode === 'preview') startPreview();
  });
  $('#subdiv').addEventListener('change', e => { S.subdiv = e.target.checked; if (metro.mode === 'preview') startPreview(); });
  $('#metroBtn').addEventListener('click', () => { if (metro.mode === 'preview') metroStop(); else if (rec.state === 'idle' && !calib.active) startPreview(); });
}
