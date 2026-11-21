// Counting syllables under the notes: Off, 1 e & a, or Kodály (ta, ti-ti). Stored per browser.
import { rawJson } from '../services/store.js';
import { $, syncSeg, onSeg } from '../ui/dom.js';

export const COUNT_KEY = 'claptoscore.count';
export const countMode = () => rawJson.get(COUNT_KEY, 'off') || 'off';

export function bindCountMode(onChange) {
  const sync = () => syncSeg('#countMode', v => v === countMode());
  onSeg('#countMode', v => { rawJson.set(COUNT_KEY, v); sync(); onChange(); });
  sync();
  $('#countRow').hidden = false;
}
