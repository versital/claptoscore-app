// Metronome volume: one setting, shown as a slider in the Tempo panel and in the Practice tab (kept in sync).
import { setClickVolume } from '../audio/context.js';
import { store } from '../services/store.js';
import { $$ } from '../ui/dom.js';

export function bindClickVolume() {
  const saved = store.get('clickVol');
  const show = v => $$('.click-vol').forEach(el => { el.value = v; el.parentElement.querySelector('.val').textContent = v + '%'; });
  const set = v => { v = Math.max(0, Math.min(150, Math.round(+v))); setClickVolume(v); show(v); store.set('clickVol', v); };
  set(typeof saved === 'number' ? saved : 100);
  $$('.click-vol').forEach(el => el.addEventListener('input', () => set(el.value)));
}
