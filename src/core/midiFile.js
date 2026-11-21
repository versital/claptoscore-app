import { beatUnit, meterNumber } from './meters.js';
// Standard MIDI File export (Pro): format 0, 480 ticks per quarter, drums on channel 10:
// clap 39 (one voice) or snare 38 / kick 36 (two voices).
export function toMidi(A) {
  const PPQ = 480, k = PPQ / (12 * (A.tpb / A.M.tpb)), origin = A.startBar * A.barTicks;  // 12u ticks per quarter
  const quarterBpm = A.R.bpm * beatUnit(A.M).quarters;
  const num = meterNumber(A.R.meter), den = +A.R.meter.split('/')[1];
  const vlq = n => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
  const ev = [];
  const us = Math.round(60e6 / quarterBpm);
  ev.push({ t: 0, d: [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] });
  ev.push({ t: 0, d: [0xff, 0x58, 4, num, Math.log2(den), 24, 8] });
  for (const n of A.notes) {
    const key = A.twoVoice ? (n.v === 2 ? 36 : 38) : 39;
    const on = (n.start - origin) * k, off = on + Math.max(30, (n.end - n.start) * k - 20);
    ev.push({ t: on, d: [0x99, key, n.v === 2 ? 110 : 100] }, { t: off, d: [0x89, key, 0] });
  }
  ev.push({ t: (A.endBar - A.startBar) * A.barTicks * k, d: [0xff, 0x2f, 0] });
  // at equal times: tempo/meter first, then note-offs, then note-ons, and end-of-track last
  const rank = d => d[0] === 0xff ? (d[1] === 0x2f ? 3 : 0) : (d[0] & 0xf0) === 0x80 ? 1 : 2;
  ev.sort((a, b) => a.t - b.t || rank(a.d) - rank(b.d));
  const trk = []; let last = 0;
  for (const e of ev) { trk.push(...vlq(Math.round(e.t - last)), ...e.d); last = Math.round(e.t); }
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  return new Uint8Array([0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, PPQ >> 8, PPQ & 255, 0x4d, 0x54, 0x72, 0x6b, ...u32(trk.length), ...trk]);
}
