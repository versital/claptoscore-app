// Export menu: MusicXML, MIDI, Print/PDF (Pro) and Copy ABC (free).
import { S } from '../state.js';
import { T } from '../services/i18n.js';
import { toMusicXml } from '../core/musicxml.js';
import { toMidi } from '../core/midiFile.js';
import { $, toast, download } from '../ui/dom.js';
import { isPro, upsell } from './proGate.js';
import { takeTitle, fileBase } from './takeInfo.js';

function copyAbc() {
  const txt = $('#abcOut').textContent;
  const done = () => toast(T('abc copied'));
  const fallback = () => {
    for (let d = $('#abcOut').closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true;
    const r = document.createRange(); r.selectNodeContents($('#abcOut')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    toast(T('selected. press ⌘C or Ctrl+C'));
  };
  try { navigator.clipboard.writeText(txt).then(done, fallback); } catch { fallback(); }
}

// Exporters by menu key. Add a format here and a <button data-x="..."> in index.html.
const EXPORTERS = {
  musicxml: { pro: true, run: A => { download(fileBase() + '.musicxml', toMusicXml(A, { title: takeTitle() }), 'application/vnd.recordare.musicxml+xml'); toast(T('musicxml saved')); } },
  midi: { pro: true, run: A => { download(fileBase() + '.mid', toMidi(A), 'audio/midi'); toast(T('midi saved')); } },
  print: { pro: true, run: () => {
    let h = $('#printHead');
    if (!h) { h = document.createElement('div'); h.id = 'printHead'; h.className = 'print-head'; $('#score').before(h); }
    h.textContent = `${takeTitle()} · Claptoscore`;
    window.print();
  } },
};

export function exportAs(kind) {
  const A = S.A;
  if (kind === 'abc') return copyAbc();
  if (!isPro()) return upsell(kind === 'print' ? T('Printing and PDF are part of Claptoscore Pro.') : T('{format} export is part of Claptoscore Pro, along with saved takes and advanced lessons.', { format: kind === 'midi' ? 'MIDI' : 'MusicXML' }));
  if (!A || A.empty) return toast(T('nothing to export yet'));
  EXPORTERS[kind]?.run(A);
}

export function bindExportMenu() {
  const menu = $('#exportMenu'), menuBtn = $('#exportBtn');
  const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; menuBtn.setAttribute('aria-expanded', String(!menu.hidden)); });
  menu.addEventListener('click', e => { const b = e.target.closest('button[data-x]'); if (b) { closeMenu(); exportAs(b.dataset.x); } });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !e.target.closest('.export')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) closeMenu(); });
}
