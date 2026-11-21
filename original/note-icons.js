// Note values as small inline SVG icons (currentColor), for keys that choose a note value instead of naming it,
// so they need no translation. Used by the metronome (subdivision) and the main tool (smallest note).
// A beamed group of n notes as an inline SVG in currentColor: beams 0 = quarter(s), 1 = eighths, 2 = sixteenths, 3 = 32nds.
// A lone note with beams > 0 gets flags instead. dot adds an augmentation dot, tuplet puts a number over the beam.
function noteGroup({ n = 1, beams = 0, dot = false, tuplet = 0 }, size = 0.85) {
  const gap = 8.5, top = tuplet ? 8 : 3, head = 26, lone = n === 1 && beams > 0;
  const w = 7 + (n - 1) * gap + (dot ? 5 : 0) + (lone ? 5 : 0), h = head + 3.5;
  const sx = k => 3.4 + k * gap + 2.6;  // stem x of note k
  let s = '';
  for (let k = 0; k < n; k++) {
    const x = 3.4 + k * gap;
    s += `<ellipse cx="${x}" cy="${head}" rx="3.4" ry="2.45" transform="rotate(-22 ${x} ${head})"/>`;
    s += `<rect x="${sx(k) - 0.6}" y="${top}" width="1.25" height="${head - top - 0.6}"/>`;
  }
  for (let b = 0; b < beams; b++) {
    const y = top + b * 3.6;
    if (lone) s += `<path d="M${sx(0) + 0.6} ${y}c0 3.2 4.6 4.4 4.1 9.2c-.6-3-2.4-4.6-4.1-4.9z"/>`;
    else s += `<rect x="${sx(0) - 0.6}" y="${y}" width="${sx(n - 1) - sx(0) + 1.25}" height="2.3"/>`;
  }
  if (dot) s += `<circle cx="${3.4 + 6.6}" cy="${head - 1}" r="1.3"/>`;
  if (tuplet) s += `<text x="${(sx(0) + sx(n - 1)) / 2}" y="5.6" font-size="7.5" font-weight="700" font-style="italic" text-anchor="middle" font-family="Georgia, serif">${tuplet}</text>`;
  return `<svg class="ng" viewBox="0 0 ${w.toFixed(1)} ${h}" width="${(w * size).toFixed(1)}" height="${(h * size).toFixed(1)}" fill="currentColor" aria-hidden="true">${s}</svg>`;
}
window.noteGroup = noteGroup;
