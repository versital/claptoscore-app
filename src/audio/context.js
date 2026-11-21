// The one AudioContext, created lazily on the first user gesture, and the clock bridge to performance.now().

export let ctx = null;
export let master = null;

// Shared audio flags. micOn: the microphone is listening, so clicks switch to tones its high-pass filter rejects.
export const audioFlags = { micOn: false };

export function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
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
