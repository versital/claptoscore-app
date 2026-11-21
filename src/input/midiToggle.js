// The MIDI checkbox: a pad, an e-drum or a keyboard taps like a key (low voice = kick / below middle C).
import { S } from '../state.js';
import { T } from '../services/i18n.js';
import { $ } from '../ui/dom.js';
import { MidiIn } from './midiIn.js';
import { tapDown, tapUp } from './taps.js';

function midiNote(names) {
  const st = $('#midiStatus'); st.className = 'ib-note';
  st.textContent = names.length ? T('midi in · {names}', { names: names.join(', ') }) : T('MIDI in is on, but no device is connected. Plug one in, or pair it over Bluetooth.');
}

export async function setMidi(on) {
  const st = $('#midiStatus'), no = msg => { st.className = 'ib-note err'; st.textContent = msg; $('#midiOn').checked = false; };
  if (!on) { MidiIn.disable(); st.textContent = ''; return; }
  if (!MidiIn.supported()) return no(T('No MIDI in this browser. Chrome, Edge and Firefox have it. Safari, iPhones and iPads do not.'));
  try {
    midiNote(await MidiIn.enable({
      down: (t, m) => tapDown(t, { v: S.twoVoices && m.low ? 2 : 1, key: m.key, src: 'midi' }),
      up: (t, key) => tapUp(t, key),
      state: midiNote,
    }));
  } catch { no(T('MIDI blocked. Allow MIDI devices for this site in your browser, then tick the box again.')); }
}

export function bindMidi() {
  $('#midiOn').addEventListener('change', e => setMidi(e.target.checked));
  if (MidiIn.wanted()) { $('#midiOn').checked = true; setMidi(true); }
}
