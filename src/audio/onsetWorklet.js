// Microphone clap detection. Runs in an AudioWorklet: a fast peak envelope must jump well above its own slow
// average (and an absolute floor) to count as an onset; the onset time is sample-accurate within the render block.
// Kept as a string and loaded through a Blob URL, so it needs no extra file or server route.
export const ONSET_WORKLET = `
class Onset extends AudioWorkletProcessor {
  constructor() {
    super(); this.fast = 0; this.slow = 0.001; this.refr = 0; this.peak = 0; this.n = 0; this.setSens(5);
    this.port.onmessage = e => this.setSens(e.data.sens);
  }
  setSens(s) { this.ratio = 10 - 0.6 * s; this.floor = 0.3 * Math.pow(10, -s / 3.5); }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    const decay = Math.exp(-1 / (0.004 * sampleRate)), follow = 1 / (0.25 * sampleRate);
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      this.fast = a > this.fast ? a : this.fast * decay;
      if (this.refr > 0) this.refr--;
      else if (this.fast > this.floor && this.fast > this.ratio * this.slow) {
        this.port.postMessage({ type: 'onset', t: currentTime + i / sampleRate, v: this.fast });
        this.refr = Math.round(0.07 * sampleRate);
      }
      this.slow += (this.fast - this.slow) * follow;
      if (this.fast > this.peak) this.peak = this.fast;
    }
    if (++this.n >= 12) { this.port.postMessage({ type: 'level', v: this.peak, floor: this.floor }); this.peak = 0; this.n = 0; }
    return true;
  }
}
registerProcessor('onset', Onset);`;
