// The Keys window (the ? key in the header): every action with its keys. + then a key press adds a key, × on a key
// removes it; any number of keys per action, also none. Mouse, touch, microphone and MIDI always work.
import { ACTIONS, keys, bind, unbind, setAnyInPractice, resetKeys, onKeysChange, keyName, keyNames, BINDABLE } from '../services/keybinds.js';
import { T } from '../services/i18n.js';
import { $, $$, escHtml, toast } from '../ui/dom.js';

let capturing = null;  // the action waiting for a key press

function render() {
  $('#keyTable').innerHTML = ACTIONS.map(a => `<tr data-a="${a.id}">
    <td><b>${T(a.name)}</b><small>${T(a.hint)}</small></td>
    <td><div class="key-list">${keys[a.id].map(c => `<span class="key-chip"><kbd>${escHtml(keyName(c))}</kbd><button class="key-x" data-code="${escHtml(c)}" aria-label="${T('Remove {k}', { k: escHtml(keyName(c)) })}" title="${T('Remove')}">×</button></span>`).join('')}
      <button class="btn small key-add${capturing === a.id ? ' on' : ''}" aria-label="${T('Add a key for {a}', { a: T(a.name) })}">${capturing === a.id ? T('Press a key…') : '+'}</button></div></td></tr>`).join('');
  $('#anyKeyPractice').checked = keys.anyInPractice;
  labels();
}

// Texts elsewhere on the page that name keys
function labels() {
  const hi = keys.high.length ? keyNames(keys.high) : T('no key'), lo = keys.low.length ? keyNames(keys.low) : T('no key');
  const l = $('.pad-voice.l'), r = $('.pad-voice.r');
  if (l) l.textContent = `${lo} · ${T('low')}`;
  if (r) r.textContent = `${hi} · ${T('high')}`;
  const msg = $('#prMsg');
  if (msg && !msg.dataset.base) msg.dataset.base = msg.textContent;
  if (msg) msg.textContent = msg.dataset.base.replace(T('Any letter key taps.'), keys.anyInPractice ? T('Any letter key taps.') : `${hi} ${T('tap.')}`);
}

function stopCapture() { capturing = null; window.removeEventListener('keydown', onCapture, true); render(); }
function onCapture(e) {
  if (!capturing) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.code === 'Escape' && !e.repeat && capturing !== 'stop') { stopCapture(); return; }  // Esc cancels (except when binding Stop)
  if (!BINDABLE(e.code)) { toast(T('{k} cannot be used', { k: keyName(e.code) || e.key })); return; }
  const a = capturing, from = bind(a, e.code);
  if (from) toast(T('{k} moved from {from} to {to}', { k: keyName(e.code), from: T(ACTIONS.find(x => x.id === from).name), to: T(ACTIONS.find(x => x.id === a).name) }));
  stopCapture();
}

export function bindKeybinds() {
  onKeysChange(render);
  $('#keyTable').addEventListener('click', e => {
    const row = e.target.closest('tr[data-a]'); if (!row) return;
    const x = e.target.closest('.key-x');
    if (x) { unbind(row.dataset.a, x.dataset.code); return; }
    if (e.target.closest('.key-add')) {
      if (capturing === row.dataset.a) { stopCapture(); return; }
      capturing = row.dataset.a;
      window.addEventListener('keydown', onCapture, true);
      render();
    }
  });
  $('#anyKeyPractice').addEventListener('change', e => setAnyInPractice(e.target.checked));
  $('#keysReset').addEventListener('click', () => { stopCapture(); resetKeys(); });
  $('#helpKeys').addEventListener('close', () => { if (capturing) stopCapture(); });
  render();
}
