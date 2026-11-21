// The one AudioContext, created lazily on the first user gesture, and the clock bridge to performance.now().

export let ctx = null;
export let master = null;
// clickBus: every metronome click (count-in, recording, preview, practice, playback's click track) goes through it,
// so the metronome volume can change without touching the rhythm sounds.
export let clickBus = null;
let clickGain = 1;
// v: 0..150 (%); loudness follows the square, so the slider feels even
export function setClickVolume(v) {
  clickGain = Math.pow(Math.max(0, Math.min(150, v)) / 100, 2);
  if (clickBus) clickBus.gain.value = clickGain;
}

// Shared audio flags. micOn: the microphone is listening, so clicks switch to tones its high-pass filter rejects.
export const audioFlags = { micOn: false };

export function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    clickBus = ctx.createGain(); clickBus.gain.value = clickGain; clickBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Map an AudioContext time to the performance.now() clock at which it is heard.
export function audioToPerf(t) {
  if (ctx.getOutputTimestamp) {
    const ts = ctx.getOutputTimestamp();
    if (ts.performanceTime > 0 && ts.contextTime > 0) return t * 1000 + ts.performanceTime - ts.contextTime * 1000;
  }
  return performance.now() + (t - ctx.currentTime) * 1000 + (ctx.outputLatency || ctx.baseLatency || 0) * 1000;
}
