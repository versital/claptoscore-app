// The beat dots under the tempo (preview) and the rhythm pad (recording), driven by the metronome's visQ.
import { METERS } from '../core/meters.js';
import { metro, visQ } from '../audio/metronome.js';
import { $ } from './dom.js';

export function buildDots(meter) {
  const M = METERS[meter];
  for (const id of ['#dots1', '#dots2', '#prDots']) {
    const el = $(id); el.innerHTML = '';
    for (let i = 0; i < M.beats; i++) { const d = document.createElement('span'); d.className = 'dot' + (i === 0 ? ' down' : ''); el.appendChild(d); }
  }
}

// Called with the beat number each time a beat is heard (the recorder uses it for the count-in display).
let beatListeners = [];
export function setBeatListeners(list) { beatListeners = list; }

function frame() {
  const now = performance.now();
  while (visQ.length && visQ[0].perf <= now) {
    const { b } = visQ.shift();
    const el = $(metro.mode === 'preview' ? '#dots1' : metro.mode === 'practice' ? '#prDots' : '#dots2');
    const dots = el.children;
    [...dots].forEach((d, i) => d.classList.toggle('on', i === b % metro.bpb));
    beatListeners.forEach(f => f(b));
  }
  requestAnimationFrame(frame);
}
export const startBeatDisplay = () => requestAnimationFrame(frame);
