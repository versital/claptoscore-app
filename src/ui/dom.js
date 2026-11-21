// Small DOM helpers shared by every feature.

export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);

// A CSS custom property's current value (follows the light/dark theme).
export function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1600);
}

// Brief hit highlight on a pad; on a split (two-voice) pad, the half that was hit.
export function flash(el, v) {
  const cls = el.classList.contains('split') ? (v === 2 ? 'hit-l' : 'hit-r') : 'hit';
  el.classList.add(cls); clearTimeout(el['_f' + cls]); el['_f' + cls] = setTimeout(() => el.classList.remove(cls), 90);
}

// True when a key press belongs to a text field or an open help popup rather than to the tap keys.
export function isTyping(t) {
  if (document.querySelector('dialog[open]')) return true;
  if (!t) return false;
  if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  return t.tagName === 'INPUT' && !['checkbox', 'range', 'radio', 'button'].includes(t.type);
}

export const escHtml = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// Segmented buttons (.seg): light the one whose data-v matches.
export function syncSeg(sel, isOn) { $$(sel + ' button').forEach(b => b.classList.toggle('on', isOn(b.dataset.v))); }

// Delegate clicks on a .seg's buttons to fn(value, button).
export function onSeg(sel, fn) { $(sel).addEventListener('click', e => { const b = e.target.closest('button'); if (b) fn(b.dataset.v, b); }); }

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
