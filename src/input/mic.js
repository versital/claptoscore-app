// Microphone input: claps become taps. Two 2.4 kHz high-passes, then the onset worklet.
import { audio, ctx, audioFlags } from '../audio/context.js';
import { ONSET_WORKLET } from '../audio/onsetWorklet.js';
import { store } from '../services/store.js';
import { T } from '../services/i18n.js';
import { $ } from '../ui/dom.js';

export const mic = { on: false, stream: null, nodes: [], worklet: null, sens: 5, loaded: false };
let onOnset = () => {};

// onset(perfTime) is called for every clap, on the performance.now() clock.
export function setMicHandler(fn) { onOnset = fn; }

export async function micStart() {
  const status = $('#micStatus');
  status.className = 'ib-note'; status.textContent = '';
  audio();
  try {
    mic.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    if (!mic.loaded) {
      const url = URL.createObjectURL(new Blob([ONSET_WORKLET], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url); mic.loaded = true;
    }
  } catch (err) {
    micStop();
    status.className = 'ib-note err';
    status.textContent = err && err.name === 'NotAllowedError'
      ? T('Mic blocked. Allow the microphone for this site in your browser, then tick the box again.')
      : T('No microphone available here. Tap on the space bar or the pad instead.');
    $('#micOn').checked = false; return;
  }
  const src = ctx.createMediaStreamSource(mic.stream);
  const hp1 = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 2400, Q: 0.7 });
  const hp2 = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 2400, Q: 0.7 });
  const node = new AudioWorkletNode(ctx, 'onset');
  const sink = new GainNode(ctx, { gain: 0 });
  src.connect(hp1).connect(hp2).connect(node).connect(sink).connect(ctx.destination);
  mic.nodes = [src, hp1, hp2, node, sink]; mic.worklet = node; mic.on = true; audioFlags.micOn = true;
  node.port.postMessage({ sens: mic.sens });
  node.port.onmessage = e => {
    const m = e.data;
    if (m.type === 'onset') {
      onOnset(performance.now() - (ctx.currentTime - m.t) * 1000);
    } else {
      const db = 20 * Math.log10(Math.max(m.v, 1e-5));
      $('#micLevel').style.width = Math.max(0, Math.min(100, (db + 70) / 70 * 100)) + '%';
      $('#micMeter').classList.toggle('hot', m.v > m.floor);
    }
  };
  status.textContent = T('Mic on. Wear headphones so the click stays out of it.');
}

export function micStop() {
  mic.nodes.forEach(n => { try { n.disconnect(); } catch {} }); mic.nodes = []; mic.worklet = null;
  if (mic.stream) mic.stream.getTracks().forEach(t => t.stop());
  mic.stream = null; mic.on = false; audioFlags.micOn = false;
  $('#micLevel').style.width = '0';
  $('#micStatus').className = 'ib-note'; $('#micStatus').textContent = '';
}

export function setMicSens(v) {
  mic.sens = v; store.set('micSens', v);
  if (mic.worklet) mic.worklet.port.postMessage({ sens: v });
}

export function bindMic() {
  $('#micOn').addEventListener('change', e => { if (e.target.checked) micStart(); else micStop(); });
  $('#micSens').addEventListener('input', e => setMicSens(+e.target.value));
  const ss = store.get('micSens'); if (ss) { mic.sens = ss; $('#micSens').value = ss; }
}
