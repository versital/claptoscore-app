// Golden test: the refactored core must produce exactly what the original inline script produced.
// The original functions are cut straight out of original/claptoscore.html (by their section markers) and run in a
// sandbox, then compared against src/core/* on randomised takes across every clean-up option combination.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { analyze } from '../src/core/analyze.js';
import { inferFreeTake } from '../src/core/freeTempo.js';
import { toAbc } from '../src/core/abc.js';
import { toMusicXml } from '../src/core/musicxml.js';
import { toMidi } from '../src/core/midiFile.js';
import { exampleTake, takeFromRhythm, rhythmOf } from '../src/core/takes.js';
import * as RC from '../src/core/rhythmCode.js';

const root = new URL('../original/', import.meta.url);
const html = readFileSync(new URL('claptoscore.html', root), 'utf8');
// the original UMD sets self.RhythmCode when there is no CommonJS module
const OrigRC = (() => { const sb = { self: {}, TextEncoder, TextDecoder }; vm.createContext(sb); vm.runInContext(readFileSync(new URL('rhythm-code.js', root), 'utf8'), sb); return sb.self.RhythmCode; })();

// Cut the original script between two section markers.
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a); assert.ok(a > 0 && b > a, from); return html.slice(a, b); };
function loadOriginal({ count = 'off', S }) {
  const src = [
    cut('// ---------- meters ----------', '// ---------- state ----------'),
    cut('// ---------- free tempo: find the pulse in the taps ----------', '// ---------- render ----------'),
    cut('// ---------- example take ----------', '// ---------- boot ----------'),
    'this.out = { analyze, inferFreeTake, toAbc, toMusicXml, toMidi, exampleTake };',
  ].join('\n');
  const store = { 'claptoscore.count': JSON.stringify(count) };
  const sandbox = {
    S, T: (s, v) => v ? s.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m) : s,
    window: { RhythmCode: OrigRC }, RhythmCode: OrigRC,
    localStorage: { getItem: k => store[k] ?? null },
    takeTitle: () => 'Test title', Date: class extends Date { toISOString() { return '2026-01-01T00:00:00.000Z'; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.out;
}

// Deterministic random takes: 1–2 voices, jitter, drift, holds, excluded taps, every meter.
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
function randomTake(seed) {
  const r = rng(seed), meters = ['2/4', '3/4', '4/4', '5/4', '6/8', '9/8', '12/8'];
  const meter = meters[Math.floor(r() * meters.length)], bpm = 50 + Math.floor(r() * 150), beatMs = 60000 / bpm;
  const two = r() < 0.3, n = 3 + Math.floor(r() * 40), taps = [];
  let pos = r() * 0.5;
  const steps = [0.25, 0.5, 1 / 3, 0.75, 1, 1.5, 2, 2 / 3];
  for (let i = 0; i < n; i++) {
    const t = pos * beatMs * (1 + (r() - 0.5) * 0.04) + (r() - 0.5) * 70;
    const hold = r() < 0.8 ? t + 40 + r() * beatMs : null;
    taps.push({ t, up: hold, v: two && r() < 0.4 ? 2 : 1, src: r() < 0.15 ? 'mic' : 'key', ...(r() < 0.05 ? { excluded: true } : {}) });
    pos += steps[Math.floor(r() * steps.length)];
  }
  return { bpm, meter, taps, source: 'user', barShift: Math.floor(r() * 3) - 1 };
}
const OPTS = [];
for (const finest of [0, 1, 2]) for (const triplets of [true, false]) for (const tempoMode of ['off', 'steady', 'follow'])
  for (const lengths of ['next', 'held']) for (const maxLen of ['0', '1', 'bar']) OPTS.push({ finest, triplets, simplicity: (finest * 3 + 1) % 7, tempoMode, lengths, maxLen, debounce: [0, 60, 120][finest] });
const LAT = { key: 17, mic: -9 };
// analysis objects contain Maps and functions; compare their JSON-able essence
// vm-sandbox objects have foreign prototypes; compare plain data
const plain = x => JSON.parse(JSON.stringify(x));
const essence = A => JSON.stringify(A, (k, v) => Object.prototype.toString.call(v) === '[object Map]' ? [...v] : v);

test('analyze + ABC + MusicXML + MIDI match the original on random takes', () => {
  let compared = 0;
  for (const count of ['off', 'count', 'kodaly']) {
    const orig = loadOriginal({ count, S: { rec: { title: 'Test title' } } });
    for (let seed = 1; seed <= 60; seed++) {
      const take = randomTake(seed * 7919);
      for (const o of OPTS.filter((_, i) => (i + seed) % 9 === 0)) {
        const a = orig.analyze(structuredClone(take), o, LAT), b = analyze(structuredClone(take), o, LAT);
        assert.equal(essence(b), essence(a), `analyze seed ${seed}`);
        if (a.empty) continue;
        assert.equal(toAbc(b, b.startBar, { count }), orig.toAbc(a), `abc seed ${seed} count ${count}`);
        assert.equal(toAbc(b, b.endBar - 1, { lyrics: false }), orig.toAbc(a, a.endBar - 1, { lyrics: false }));
        assert.equal(toMusicXml(b, { title: 'Test title', date: '2026-01-01' }), orig.toMusicXml(a));
        assert.deepEqual([...toMidi(b)], [...orig.toMidi(a)]);
        compared++;
      }
    }
  }
  assert.ok(compared > 300, `compared ${compared}`);
});

test('free-tempo inference matches the original', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const take = randomTake(seed * 104729), opt = OPTS[seed * 5 % OPTS.length];
    const raw = take.taps.map(x => ({ t: x.t + 5000, up: x.up == null ? null : x.up + 5000, v: x.v, src: x.src }));
    for (const hint of [false, true]) {
      const S = { opt, latency: 12, micLatency: 30, tempoHint: hint, bpm: take.bpm };
      const orig = loadOriginal({ S });
      assert.deepEqual(inferFreeTake(raw, take.meter, { opt, lat: { key: 12, mic: 30 }, hintBpm: hint ? take.bpm : null }), plain(orig.inferFreeTake(raw, take.meter)));
    }
  }
});

test('example take matches the original', () => {
  for (const lat of [0, 25]) assert.deepEqual(exampleTake(lat), plain(loadOriginal({ S: { latency: lat } }).exampleTake()));
});

test('rhythm codes: same encode/decode/ABC/exercise/grid as the original rhythm-code.js', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const take = randomTake(seed * 31);
    const A = analyze(take, OPTS[seed % OPTS.length], LAT);
    if (A.empty) continue;
    // (exactCheck off: this compares the codecs, not this build's choice between link versions)
    const r = rhythmOf(A, { title: seed % 3 ? 'Clap ' + seed : '', hide: seed % 2 === 0, exactCheck: false });
    let code;
    try { code = OrigRC.encode(r); } catch { continue; }
    assert.equal(RC.encode(r), code);
    let d;
    try { d = plain(OrigRC.decode(code)); } catch (e) { assert.throws(() => RC.decode(code)); continue; }
    assert.deepEqual(RC.decode(code), d);
    for (const count of ['off', 'count', 'kodaly']) assert.equal(RC.toAbc(d, { count }), OrigRC.toAbc(d, { count }));
    assert.deepEqual(RC.exercise(d), plain(OrigRC.exercise(d)));
    assert.deepEqual(RC.grid(d), plain(OrigRC.grid(d)));
    assert.deepEqual(takeFromRhythm(d).taps.length, d.voices.flat().length);
  }
  assert.equal(RC.cleanTitle('visit www.example.com'), '');
  assert.throws(() => RC.decode('!!'));
});
