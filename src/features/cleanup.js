// Fine-tune panel: grid (down to 32nds), triplets, tuplets, simplicity, tempo correction, note lengths, longest note, double taps,
// ½× / 2× tempo and moving the barlines. Changes apply instantly to the last take.
import { S } from '../state.js';
import { METERS } from '../core/meters.js';
import { T } from '../services/i18n.js';
import { store } from '../services/store.js';
import { noteGroup } from '../ui/noteIcons.js';
import { $, syncSeg, onSeg } from '../ui/dom.js';
import { render, requestRender } from './notation.js';

// soon: redraw on the next frame instead of now (slider drags fire many input events)
export function setOpt(k, v, soon = false) { S.opt[k] = v; store.set('opt', S.opt); syncControls(); (soon ? requestRender : render)(); }

// The Grid keys show note values; compound meters use a dotted quarter and hide the triplet key.
export function buildFinest() {
  const compound = METERS[(S.rec && S.rec.meter) || S.meter].compound;
  const notes = [compound ? { dot: true } : {}, { beams: 1 }, { beams: 2 }, { beams: 3 }], names = [compound ? T('Dotted quarters') : T('Quarter notes'), T('Eighths'), T('Sixteenths'), T('Thirty-seconds')];
  $('#finest').innerHTML = notes.map((g, i) => `<button data-v="${i}" aria-label="${names[i]}" title="${names[i]}">${noteGroup(g)}</button>`).join('');
  $('#tripLbl .tri-ic').innerHTML = noteGroup({ n: 3, beams: 1, tuplet: 3 }, 0.75);
  $('#tripLbl').hidden = compound;
  $('#tupLbl .tup-ic').innerHTML = noteGroup({ n: 4, beams: 2, tuplet: 'n' }, 0.7);
}

export function syncControls() {
  const o = S.opt;
  syncSeg('#finest', v => +v === o.finest);
  syncSeg('#tempoMode', v => v === o.tempoMode);
  syncSeg('#lengths', v => v === o.lengths);
  $('#triplets').checked = o.triplets; $('#tuplets').checked = !!o.tuplets; $('#simplicity').value = o.simplicity; $('#simpVal').textContent = o.simplicity;
  $('#maxLen').value = o.maxLen; $('#debounce').value = o.debounce; $('#debVal').textContent = o.debounce + ' ms';
}

// Move the barlines by d beats (wraps within a bar, kept between -n/2 and n/2).
export function shiftBars(d) {
  if (!S.rec) return;
  const n = METERS[S.rec.meter].beats;
  S.rec.barShift = ((((S.rec.barShift || 0) + d) % n) + n) % n;
  if (S.rec.barShift > n / 2) S.rec.barShift -= n;
  if (S.rec.source === 'user') store.set('rec', S.rec);
  render();
}
// Fix a tempo read at double or half speed.
export function scaleTempo(f) {
  if (!S.rec) return;
  const bpm = S.rec.bpm * f;
  if (bpm < 20 || bpm > 400) return;
  S.rec.bpm = Math.round(bpm * 10) / 10; S.rec.barShift = 0;
  if (S.rec.source === 'user') store.set('rec', S.rec);
  render();
}

export function bindCleanup() {
  onSeg('#finest', v => setOpt('finest', +v));
  onSeg('#tempoMode', v => setOpt('tempoMode', v));
  onSeg('#lengths', v => setOpt('lengths', v));
  $('#triplets').addEventListener('change', e => setOpt('triplets', e.target.checked));
  $('#tuplets').addEventListener('change', e => setOpt('tuplets', e.target.checked));
  $('#simplicity').addEventListener('input', e => setOpt('simplicity', +e.target.value, true));
  $('#maxLen').addEventListener('change', e => setOpt('maxLen', e.target.value));
  $('#debounce').addEventListener('input', e => setOpt('debounce', +e.target.value, true));
  $('#halfT').addEventListener('click', () => scaleTempo(0.5));
  $('#dblT').addEventListener('click', () => scaleTempo(2));
  $('#shiftL').addEventListener('click', () => shiftBars(-1));
  $('#shiftR').addEventListener('click', () => shiftBars(1));
}
