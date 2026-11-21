// English pages only: when the browser prefers one of the site's other languages, offer that version in a thin
// bar at the top. Never a redirect. A language picked in the footer list is remembered; closing the bar keeps English.
export function offerLanguage() {
  const KEY = 'claptoscore.lang';
  const OFFER = { nl: 'Deze pagina is er ook in het Nederlands', es: 'Esta página también está en español',
    fr: 'Cette page existe aussi en français', pt: 'Esta página também está em português', zh: '本页也有中文版' };
  const CLOSE = { nl: 'Sluiten', es: 'Cerrar', fr: 'Fermer', pt: 'Fechar', zh: '关闭' };
  const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch {} };
  const prefix = href => (/^\/(nl|es|fr|pt|zh)\//.exec(href) || [])[1] || 'en';
  document.addEventListener('click', e => { const a = e.target.closest('.langs a[href]'); if (a) set(prefix(a.getAttribute('href'))); });
  const saved = get();
  if (saved === 'en') return;
  const want = saved || (navigator.languages || [navigator.language || 'en']).map(l => String(l).toLowerCase().split(/[-_;]/)[0]).find(l => l === 'en' || l in OFFER);
  const link = want && want !== 'en' && document.querySelector(`.langs a[href^="/${want}/"]`);
  if (!link) return;
  const show = () => {
    const bar = document.createElement('div');
    bar.className = 'lang-offer'; bar.lang = link.lang;
    const a = document.createElement('a'); a.href = link.getAttribute('href') + location.search + location.hash; a.textContent = OFFER[want] + ' →';
    a.addEventListener('click', () => set(want));
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', CLOSE[want]);
    x.addEventListener('click', () => { set('en'); bar.remove(); });
    bar.append(a, x);
    document.body.prepend(bar);
  };
  show();
}
