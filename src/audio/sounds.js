// Synthesised sounds. "bag" collects oscillators so playback can stop them early.
import { ctx, master, clickBus, audioFlags } from './context.js';

export function blip(time, freq, gain, dur, type, bag, out = master) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(gain, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(g).connect(out); o.start(time); o.stop(time + dur + 0.02);
  if (bag) bag.push(o);
}
// With the mic on, the click becomes a low pure tone that the mic's high-pass filter rejects.
// accent: true / 2 = downbeat, 1 = start of a group (additive meters), false / 0 = other beats.
export const click = (t, accent, bag) => {
  const a = accent === true ? 2 : accent || 0;
  return audioFlags.micOn
    ? blip(t, [700, 850, 1000][a], [0.4, 0.5, 0.6][a], 0.04, 'sine', bag, clickBus)
    : blip(t, [1250, 1550, 1900][a], [0.32, 0.45, 0.55][a], 0.03, 'triangle', bag, clickBus);
};
export const softClick = (t, bag) => blip(t, audioFlags.micOn ? 500 : 900, 0.12, 0.02, audioFlags.micOn ? 'sine' : 'triangle', bag, clickBus);
// The written rhythm plays as a woodblock (high voice) and a kick (low voice).
export const wood = (t, bag) => { blip(t, 740, 0.7, 0.07, 'sine', bag); blip(t, 2200, 0.18, 0.015, 'square', bag); };
export function kick(t, bag) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.2);
  if (bag) bag.push(o);
}
