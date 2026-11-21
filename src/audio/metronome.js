// Look-ahead metronome: a 20 ms timer schedules clicks ~120 ms ahead on the audio clock, and queues each beat's
// performance.now() time in visQ for the beat dots (ui/beatDots.js).
import { METERS } from '../core/meters.js';
import { audio, ctx, audioToPerf } from './context.js';
import { click, softClick } from './sounds.js';

// mode: 'preview' (the metronome key) | 'record' | 'calib' | null
export const metro = { running: false, timer: 0, t0: 0, beat: 0, beatSec: 0.5, bpb: 4, compound: false, audible: () => true, onBeat: null, subdiv: false, mode: null, onStop: null };
export const visQ = [];

// audible(b): click on beat b?  onBeat(b, perfTime): return false to stop.  onStop(): called once when it stops.
export function metroStart({ bpm, meter, audible = () => true, onBeat = null, subdiv = false, mode, onStop = null }) {
  audio(); metroStop();
  const M = METERS[meter];
  Object.assign(metro, { running: true, mode, beat: 0, beatSec: 60 / bpm, bpb: M.beats, compound: M.compound, audible, onBeat, subdiv, onStop, t0: ctx.currentTime + 0.15 });
  metro.timer = setInterval(metroTick, 20); metroTick();
}
function metroTick() {
  while (metro.running) {
    const b = metro.beat, t = metro.t0 + b * metro.beatSec;
    if (t > ctx.currentTime + 0.12) break;
    const perf = audioToPerf(t);
    if (metro.onBeat && metro.onBeat(b, perf) === false) { metroStop(); return; }
    if (metro.audible(b)) {
      click(t, b % metro.bpb === 0);
      if (metro.subdiv) { const n = metro.compound ? 3 : 2; for (let k = 1; k < n; k++) softClick(t + k * metro.beatSec / n); }
    }
    visQ.push({ perf, b });
    metro.beat++;
  }
}
export function metroStop() {
  metro.running = false; clearInterval(metro.timer); visQ.length = 0;
  document.querySelectorAll('.dot.on').forEach(d => d.classList.remove('on'));
  const onStop = metro.onStop; metro.onStop = null;
  if (onStop) onStop();
  metro.mode = null;
}
