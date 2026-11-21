// Names for the current take, used by exports, print and saved takes.
import { S } from '../state.js';
import { T } from '../services/i18n.js';

export function takeTitle() {
  const R = S.rec;
  return R.title || T('Rhythm {bpm} BPM {meter}', { bpm: Math.round(R.bpm), meter: R.meter });
}
export const fileBase = () => `claptoscore-${Math.round(S.rec.bpm)}bpm-${S.rec.meter.replace('/', '-')}-${new Date().toISOString().slice(0, 10)}`;
