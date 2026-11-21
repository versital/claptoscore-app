// Custom meters in the meter menus (Tempo panel and Practice tab). "Custom…" opens a small field for n/d
// (d = 2, 4, 8 or 16, n up to 32) or an additive meter such as 2+2+3/8; meters you add are remembered and listed
// in both menus.
import { METER_IDS, parseMeter, MAX_NUM } from '../core/meters.js';
import { T } from '../services/i18n.js';
import { store } from '../services/store.js';
import { $$, toast } from '../ui/dom.js';

const KEY = 'customMeters', MAX_SAVED = 12;
const saved = () => (store.get(KEY) || []).filter(m => parseMeter(m) && !METER_IDS.includes(m));

// Rebuild a menu: the seven standard meters, the saved custom ones, then "Custom…". Keeps `value` selected
// (adding it to the list when it is a custom meter not saved yet, e.g. from a shared link).
export function fillMeterSelect(sel, value) {
  const list = saved();
  if (value && !METER_IDS.includes(value) && parseMeter(value) && !list.includes(value)) list.push(value);
  sel.innerHTML = METER_IDS.map(m => `<option>${m}</option>`).join('')
    + (list.length ? `<optgroup label="${T('Custom')}">${list.map(m => `<option>${m}</option>`).join('')}</optgroup>` : '')
    + `<option value="custom">${T('Custom…')}</option>`;
  if (value) sel.value = value;
}

function addMeter(m) {
  const list = saved().filter(x => x !== m);
  list.push(m);
  store.set(KEY, list.slice(-MAX_SAVED));
}

// sel: a meter <select>. When "Custom…" is chosen, a field appears next to it; a valid meter is added to every
// meter menu, selected, and a normal 'change' event is fired, so the menu's own handler applies it.
export function bindMeterSelect(sel) {
  let prev = sel.value;
  const field = document.createElement('input');
  Object.assign(field, { type: 'text', className: 'meter-custom', placeholder: '2+2+3/8', maxLength: 16, hidden: true, autocomplete: 'off' });
  field.setAttribute('aria-label', T('Custom meter, for example 7/8 or 2+2+3/8'));
  field.title = T('n/2, n/4, n/8 or n/16 (n up to {n}), or groups such as 2+2+3/8 or 3+2/4', { n: MAX_NUM });
  sel.after(field);
  // runs before the menu's own change handler (capture), so "custom" never reaches it
  sel.addEventListener('change', e => {
    if (sel.value !== 'custom') { prev = sel.value; return; }
    e.stopImmediatePropagation();
    sel.value = prev; field.hidden = false; field.value = ''; field.focus();
  }, true);
  const done = apply => {
    const m = field.value.replace(/\s+/g, '');
    field.hidden = true;
    if (!apply || !m) return;
    if (!parseMeter(m)) { toast(T('Use n/2, n/4, n/8 or n/16 (n up to {n}), or groups like 2+2+3/8', { n: MAX_NUM })); return; }
    if (!METER_IDS.includes(m)) addMeter(m);
    $$('select.meter-select').forEach(s => fillMeterSelect(s, s === sel ? m : s.value));
    prev = m;
    sel.dispatchEvent(new Event('change'));
  };
  field.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); done(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
  });
  field.addEventListener('blur', () => { if (!field.hidden) done(true); });
}
