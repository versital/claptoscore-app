// Share: the rhythm as a link. The link holds the written rhythm itself (?r=<code>), so nothing is uploaded or stored.
import { S } from '../state.js';
import { T } from '../services/i18n.js';
import { RhythmCode } from '../core/rhythmCode.js';
import { rhythmOf } from '../core/takes.js';
import { $, toast } from '../ui/dom.js';

let shareLink = '';

export const sharePanelOpen = () => !$('#sharePanel').hidden;

export function updateShare() {
  const A = S.A, note = $('#shareNote');
  if (!A || A.empty) { shareLink = ''; $('#shareUrl').value = ''; note.textContent = T('nothing to share yet'); return; }
  const r = rhythmOf(A, { title: $('#shareTitle').value, hide: $('#shareHide').checked });
  // The original site linked to its /r/<code> share page, which this build does not have (and which cannot read the
  // version-2 codes that tuplets need). Link back to this page instead: main.js opens ?r=<code> on load, so links
  // work wherever the app is hosted (e.g. GitHub Pages under /<repo>/).
  shareLink = `${location.origin}${location.pathname}?r=${RhythmCode.encode(r)}`;
  $('#shareUrl').value = shareLink; $('#shareOpen').href = shareLink;
  const named = RhythmCode.cleanTitle(r.title);
  note.textContent = [r.title.trim() && !named && T('That name has a web address or number in it, so the link leaves it out.'),
    r.cut && T('Only the first {n} bars fit in a link.', { n: r.bars })].filter(Boolean).join(' ');
}

function setSharePanel(open) {
  $('#sharePanel').hidden = !open; $('#shareBtn').setAttribute('aria-expanded', String(open));
  if (open) { if (!$('#shareTitle').value && S.rec && S.rec.title) $('#shareTitle').value = S.rec.title; updateShare(); }
}

export function bindShare() {
  $('#shareBtn').hidden = false;
  $('#shareSend').hidden = !navigator.share;
  $('#shareBtn').addEventListener('click', () => setSharePanel($('#sharePanel').hidden));
  $('#shareClose').addEventListener('click', () => setSharePanel(false));
  $('#shareTitle').addEventListener('input', updateShare);
  $('#shareHide').addEventListener('change', updateShare);
  $('#shareUrl').addEventListener('focus', e => e.target.select());
  $('#shareCopy').addEventListener('click', () => {
    if (!shareLink) return toast(T('nothing to share yet'));
    const fallback = () => { $('#shareUrl').focus(); $('#shareUrl').select(); toast(T('selected. press ⌘C or Ctrl+C')); };
    try { navigator.clipboard.writeText(shareLink).then(() => { toast(T('link copied')); const i = $('#shareCopy .i'); i.className = 'i i-check'; setTimeout(() => { i.className = 'i i-copy'; }, 1600); }, fallback); } catch { fallback(); }
  });
  $('#shareSend').addEventListener('click', () => {
    if (!shareLink) return toast(T('nothing to share yet'));
    const t = RhythmCode.cleanTitle($('#shareTitle').value);
    navigator.share({ title: t || T('A rhythm to clap back'), text: $('#shareHide').checked ? T('Listen, then tap it back.') : T('Listen, then clap it back.'), url: shareLink }).catch(() => {});
  });
}
