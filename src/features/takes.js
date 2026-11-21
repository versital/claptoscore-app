// Saved takes (Pro): name, save (up to 200), open, delete with a 4-second "Really delete?" confirm.
import { S } from '../state.js';
import { T } from '../services/i18n.js';
import { store, rawJson } from '../services/store.js';
import { Pro } from '../services/pro.js';
import { $, toast, escHtml } from '../ui/dom.js';
import { isPro, upsell } from './proGate.js';
import { takeTitle } from './takeInfo.js';
import { buildFinest, syncControls } from './cleanup.js';
import { render } from './notation.js';

const TAKES_KEY = 'claptoscore.takes';
export const loadTakes = () => rawJson.get(TAKES_KEY, []) || [];
const saveTakes = list => { if (rawJson.set(TAKES_KEY, list)) return true; toast(T('storage full. delete some takes')); return false; };
let confirmDelete = null;

export function renderTakes() {
  const list = loadTakes(), ul = $('#takes'), pro = isPro();
  document.body.classList.toggle('pro-on', pro);
  $('#takesHint').textContent = pro ? T('{n} saved', { n: list.length }) : '';
  $('#saveTake').textContent = pro ? T('Save take') : T('Save take (Pro)');
  if (!list.length) { ul.innerHTML = ''; return; }
  ul.innerHTML = list.map(t => `<li data-id="${t.id}">
      <span class="t-name">${escHtml(t.name)}</span>
      <span class="t-meta">${Math.round(t.rec.bpm)} BPM ${escHtml(t.rec.meter)} · ${T('{n} taps', { n: t.rec.taps.length })} · ${new Date(t.savedAt).toLocaleDateString(document.documentElement.lang)}</span>
      <button class="btn icon" data-a="open" aria-label="${T('Open')}" title="${T('Open')}"><i class="i i-folder"></i></button>
      ${confirmDelete === t.id ? `<button class="btn" data-a="del">${T('Really delete?')}</button>` : `<button class="btn icon" data-a="del" aria-label="${T('Delete')}" title="${T('Delete')}"><i class="i i-trash"></i></button>`}
    </li>`).join('');
}

export function bindTakes() {
  $('#saveTake').addEventListener('click', () => {
    if (!isPro()) return upsell(T('Saving takes is part of Claptoscore Pro.'));
    if (!S.rec || (S.rec.source !== 'user' && S.rec.source !== 'shared')) return toast(T('record a take first'));
    const list = loadTakes();
    const name = $('#takeName').value.trim() || `${takeTitle()}, ${new Date().toLocaleString(document.documentElement.lang, { dateStyle: 'medium', timeStyle: 'short' })}`;
    list.unshift({ id: Date.now().toString(36), name, savedAt: Date.now(), rec: S.rec, opt: { ...S.opt } });
    if (saveTakes(list.slice(0, 200))) { $('#takeName').value = ''; toast(T('take saved')); renderTakes(); }
  });
  $('#takes').addEventListener('click', e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const id = b.closest('li').dataset.id, list = loadTakes(), t = list.find(x => x.id === id);
    if (!t) return;
    if (b.dataset.a === 'open') {
      if (!isPro()) return upsell(T('Opening saved takes is part of Claptoscore Pro.'));
      S.rec = JSON.parse(JSON.stringify(t.rec)); if (t.opt) Object.assign(S.opt, t.opt);
      store.set('rec', S.rec); store.set('opt', S.opt);
      buildFinest(); syncControls(); render(); toast(T('opened “{name}”', { name: t.name }));
      $('.result').scrollIntoView({ block: 'start' });
    } else if (confirmDelete === id) {
      confirmDelete = null; saveTakes(list.filter(x => x.id !== id)); renderTakes();
    } else { confirmDelete = id; renderTakes(); setTimeout(() => { if (confirmDelete === id) { confirmDelete = null; renderTakes(); } }, 4000); }
  });
  Pro.onChange(() => { renderTakes(); if (isPro()) $('#upsell').hidden = true; });
  renderTakes();
}
