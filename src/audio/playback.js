// Play the written score (q) or the raw taps (r) over a click track. Pressing the same key again stops.
import { S } from '../state.js';
import { accentOf } from '../core/meters.js';
import { audio, ctx } from './context.js';
import { click, wood, kick } from './sounds.js';
import { metro, metroStop } from './metronome.js';
import { $ } from '../ui/dom.js';

let playBag = [], playTimer = 0, playing = null;

export function stopPlay() {
  playBag.forEach(o => { try { o.stop(); } catch {} }); playBag = []; clearTimeout(playTimer);
  playing = null; $('#playQ').innerHTML = '<span class="ic">▶</span><i class="i i-notes"></i>'; $('#playR').innerHTML = '<span class="ic">▶</span><i class="i i-tap"></i>';
}

export function play(kind) {
  const A = S.A; if (!A || A.empty) return;
  if (playing === kind) { stopPlay(); return; }
  audio(); stopPlay(); if (metro.mode === 'preview') metroStop();
  const beatSec = 60 / A.R.bpm, t0 = ctx.currentTime + 0.15, origin = A.startBar * A.M.beats;
  const beats = (A.endBar - A.startBar) * A.M.beats;
  const hit = (t, v) => v === 2 ? kick(t, playBag) : wood(t, playBag);
  for (let b = 0; b < beats; b++) click(t0 + b * beatSec, accentOf(A.M, b), playBag);
  if (kind === 'q') for (const n of A.notes) hit(t0 + (n.start / A.tpb - origin) * beatSec, n.v);
  else for (const x of A.used) hit(t0 + (x.t / 1000 - origin * beatSec), x.v);
  playing = kind;
  $(kind === 'q' ? '#playQ' : '#playR').innerHTML = `<span class="ic">■</span><i class="i i-${kind === 'q' ? 'notes' : 'tap'}"></i>`;
  playTimer = setTimeout(stopPlay, (beats * beatSec + 0.6) * 1000);
}

export function bindPlayback() {
  $('#playQ').addEventListener('click', () => play('q'));
  $('#playR').addEventListener('click', () => play('r'));
}
