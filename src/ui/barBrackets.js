// Irrational meters (4/3, 5/6 …): every bar is one d:D tuplet. abcjs cannot nest tuplets (a triplet inside the bar
// would clash), so the bar brackets are drawn onto the finished score instead: one bracket per bar, above
// everything else in that bar, with the ratio ("3:2") in the middle. Call after ABCJS.renderAbc with add_classes.
const NS = 'http://www.w3.org/2000/svg';

export const barBracketPad = M => (M && M.irr ? 22 : 0);  // extra paddingtop to leave room above the staff

export function drawBarBrackets(root, M, color = 'currentColor') {
  if (!M || !M.irr || !root) return;
  const svg = root.querySelector('svg');
  if (!svg) return;
  svg.querySelectorAll('.bar-bracket').forEach(e => e.remove());
  svg.style.overflow = 'visible';
  const label = `${M.irr.p}:${M.irr.q}`;
  // group the bar's contents by system (abcjs-l#) and bar within the system (abcjs-m#)
  const bars = new Map(), tops = new Map();
  let parent = null;
  for (const e of svg.querySelectorAll('.abcjs-note, .abcjs-rest, .abcjs-triplet')) {
    if (e.style.display === 'none') continue;
    const c = e.getAttribute('class') || '', l = /abcjs-l(\d+)/.exec(c), m = /abcjs-m(\d+)\b/.exec(c);
    if (!l || !m) continue;
    let b; try { b = e.getBBox(); } catch { continue; }
    if (!b.width && !b.height) continue;
    parent = parent || e.parentNode;
    const key = l[1] + ':' + m[1], g = bars.get(key) || { l: l[1], x0: Infinity, x1: -Infinity };
    g.x0 = Math.min(g.x0, b.x); g.x1 = Math.max(g.x1, b.x + b.width);
    bars.set(key, g);
    tops.set(l[1], Math.min(tops.get(l[1]) ?? Infinity, b.y));
  }
  if (!parent) return;
  // the tempo marking sits above the first system's first bar: the brackets of that system go above it
  const tempo = svg.querySelector('.abcjs-tempo');
  if (tempo && tops.has('0')) { try { const b = tempo.getBBox(); if (b.height) tops.set('0', Math.min(tops.get('0'), b.y)); } catch {} }
  for (const g of bars.values()) {
    const y = tops.get(g.l) - 7, x0 = g.x0 - 2, x1 = g.x1 + 2, mid = (x0 + x1) / 2, gap = 6 + 3.2 * label.length;
    const p = document.createElementNS(NS, 'path');
    const d = x1 - x0 > 2 * gap + 4
      ? `M${x0} ${y + 5}L${x0} ${y}L${mid - gap} ${y}M${mid + gap} ${y}L${x1} ${y}L${x1} ${y + 5}`
      : `M${x0} ${y + 5}L${x0} ${y}M${x1} ${y}L${x1} ${y + 5}`;
    p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', color); p.setAttribute('stroke-width', '1');
    p.setAttribute('class', 'bar-bracket');
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', mid); t.setAttribute('y', y + 3.5); t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', '11'); t.setAttribute('font-style', 'italic'); t.setAttribute('font-family', 'Georgia, serif');
    t.setAttribute('fill', color); t.setAttribute('class', 'bar-bracket');
    t.textContent = label;
    parent.append(p, t);
  }
}
