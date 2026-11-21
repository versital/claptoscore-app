// The LCD buddy: a segment-display character, like the ones on a pocket synth's screen. This script only
// draws it and puts it on the page. Every reaction (foot taps on the beat, claps on your taps, the REC lamp,
// dozing off, cheering) is CSS in theme.css, keyed on state classes the tools already set, so nothing here
// touches timing.
// Segments: class "a" is always lit; the rest are ghosted until a state in theme.css lights them.
const SVG = `<svg class="buddy" viewBox="0 0 96 64" aria-hidden="true" focusable="false">
<path class="a gnd" d="M14 60.5h68"/>
<g class="note n1"><path d="M22 14.5v11"/><ellipse class="f" cx="19.6" cy="26" rx="2.7" ry="2"/><path d="M22 14.5q4.6 1.4 4.2 5.6"/></g>
<g class="note n2"><path d="M73 15.5v10.5M80 13.5v10.5M73 15.5l7 -2"/><ellipse class="f" cx="70.6" cy="26.5" rx="2.7" ry="2"/><ellipse class="f" cx="77.6" cy="24.5" rx="2.7" ry="2"/></g>
<path class="f star st1" d="M20 6l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z"/>
<path class="f star st2" d="M78 36l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1z"/>
<text class="f zz z1" x="60" y="15">z</text><text class="f zz z2" x="66" y="9.5">Z</text>
<text class="f qm" x="61" y="16">?</text>
<circle class="f rec" cx="88.5" cy="7" r="2.7"/>
<g class="all">
  <g class="sp spl"><path d="M41.5 5.2l-3.2 -2.4M40 9h-4"/></g>
  <g class="sp spr"><path d="M54.5 5.2l3.2 -2.4M56 9h4"/></g>
  <g class="au aul"><path d="M41 37.5L33 24 45.6 8.4"/><circle class="f" cx="46" cy="7.6" r="2.3"/></g>
  <g class="au aur"><path d="M55 37.5L63 24 50.4 8.4"/><circle class="f" cx="50" cy="7.6" r="2.3"/></g>
  <g class="ad adl"><path d="M41 38.5l-6 5v4"/><circle class="f" cx="35" cy="48.6" r="1.9"/></g>
  <g class="ad adr"><path d="M55 38.5l6 5v4"/><circle class="f" cx="61" cy="48.6" r="1.9"/></g>
  <g class="hd">
    <path class="a" d="M48 17v-3.6"/><circle class="a f" cx="48" cy="12" r="1.7"/>
    <circle class="a" cx="48" cy="25" r="8"/>
    <rect class="a f ey" x="44.1" y="22.6" width="2.3" height="3.6" rx="1"/><rect class="a f ey" x="49.6" y="22.6" width="2.3" height="3.6" rx="1"/>
    <path class="ms" d="M44.4 28.4q3.6 2.6 7.2 0"/><circle class="mo" cx="48" cy="29.2" r="1.5"/><path class="msad" d="M44.6 30.2q3.4 -2.5 6.8 0"/>
  </g>
  <rect class="a" x="41" y="35" width="14" height="13" rx="3"/>
  <path class="lg ll" d="M44.5 48v11h-4.6"/><path class="lt llt" d="M44.5 48v7l-5 -2"/>
  <path class="lg lr" d="M51.5 48v11h4.6"/><path class="lt lrt" d="M51.5 48v7l5 -2"/>
</g></svg>`;
const mount = (sel, cls, where = 'append') => {
  const el = document.querySelector(sel);
  if (!el || document.querySelector('.buddy-win.' + cls)) return;
  const w = document.createElement('div');
  w.className = 'buddy-win ' + cls; w.innerHTML = SVG;
  el[where](w);
};
// Put the buddy on the page wherever a host element exists (main tool, lesson, metronome, 404 pages).
export function mountBuddy() {
  mount('.live', 'in-live');                 // the main tool: beside the live notation
  mount('.practice .settings', 'in-bar');    // lesson pages: at the end of the settings bar
  mount('.tool #beats', 'in-tool', 'after'); // metronome: under the beat keys
  if (document.body.dataset.page === '404') mount('.wrap > h1', 'lost', 'before');  // 404: lost the beat
}
