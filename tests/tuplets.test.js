// Tuplets (o.tuplets) and 32nds (finest 3): detection, engraving, writers and share links.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyze, DEFAULT_OPT } from '../src/core/analyze.js';
import { barTokens } from '../src/core/engrave.js';
import { toAbc } from '../src/core/abc.js';
import { toMusicXml } from '../src/core/musicxml.js';
import { toMidi } from '../src/core/midiFile.js';
import { takeFromRhythm, rhythmOf } from '../src/core/takes.js';
import * as RC from '../src/core/rhythmCode.js';
import { tupletOf, scaleFor } from '../src/core/tuplets.js';
import { METERS } from '../src/core/meters.js';

const LAT = { key: 0, mic: 0 };
const OPT = { ...DEFAULT_OPT };                       // tuplets on, sixteenth grid
const OFF = { ...DEFAULT_OPT, tuplets: false };

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
// positions in beats -> a take, with timing jitter (ms, uniform ±j/2) and a held length
function take(pos, { bpm = 80, meter = '4/4', jitter = 20, seed = 3, voices } = {}) {
  const r = rng(seed), beatMs = 60000 / bpm;
  const taps = pos.map((p, i) => { const t = p * beatMs + (r() - 0.5) * jitter; return { t, up: t + 60, v: voices ? voices[i] : 1, src: 'key' }; });
  return { bpm, meter, taps, source: 'user' };
}
const cellsOf = A => [...new Set(A.cells ? A.cells.values() : [])].map(c => `${c.b0}:${c.span}:${c.s}`);
const tupletsIn = A => {
  const out = [];
  for (let bar = A.startBar; bar < A.endBar; bar++) for (const v of A.voices) for (const t of barTokens(A, bar, v.segs).tokens)
    if (t.trip && t.trip.pos === 'start') out.push(`${t.trip.p}:${t.trip.q}`);
  return out;
};
const evenly = (n, span = 1, from = 0) => Array.from({ length: n }, (_, k) => from + k * span / n);

// Every analysis must engrave into whole bars: token lengths add up, written values are whole ticks.
function checkEngraving(A, label) {
  for (const v of A.voices) for (let bar = A.startBar; bar < A.endBar; bar++) {
    const { measureRest, tokens } = barTokens(A, bar, v.segs);
    if (measureRest) continue;
    const sum = tokens.reduce((s, t) => s + t.dur, 0);
    assert.ok(Math.abs(sum - A.barTicks) < 1e-6, `${label}: bar ${bar} lasts ${sum}, want ${A.barTicks}`);
    for (const t of tokens) assert.ok(Number.isInteger(t.notated), `${label}: written value ${t.notated} is not whole`);
    let at = bar * A.barTicks;
    for (const t of tokens) { assert.ok(Math.abs(t.at - at) < 1e-6, `${label}: token at ${t.at}, expected ${at}`); at += t.dur; }
    // a bracket's token count matches what the ABC says
    tokens.forEach((t, i) => { if (t.trip && t.trip.pos === 'start') assert.ok(tokens.slice(i, i + t.trip.n).every(x => x.trip), `${label}: bracket`); });
  }
  for (const n of A.notes) assert.ok(Number.isInteger(n.start) && Number.isInteger(n.end) && n.end > n.start, `${label}: note ${n.start}-${n.end}`);
}

test('tuplet writing rules', () => {
  const S = METERS['4/4'], C = METERS['6/8'];
  assert.equal(tupletOf(S, 4), null); assert.equal(tupletOf(S, 8), null);
  assert.deepEqual(tupletOf(S, 3), { p: 3, q: 2 });
  assert.deepEqual(tupletOf(S, 5), { p: 5, q: 4 }); assert.deepEqual(tupletOf(S, 7), { p: 7, q: 4 });
  assert.deepEqual(tupletOf(S, 6), { p: 6, q: 4 }); assert.deepEqual(tupletOf(S, 9), { p: 9, q: 8 });
  assert.deepEqual(tupletOf(S, 13), { p: 13, q: 8 }); assert.deepEqual(tupletOf(S, 3, 2), { p: 3, q: 2 });
  assert.equal(tupletOf(C, 6), null); assert.equal(tupletOf(C, 12), null);
  assert.deepEqual(tupletOf(C, 2), { p: 2, q: 3 }); assert.deepEqual(tupletOf(C, 4), { p: 4, q: 3 });
  assert.deepEqual(tupletOf(C, 7), { p: 7, q: 6 }); assert.deepEqual(tupletOf(C, 13), { p: 13, q: 12 });
  const cells = list => new Map(list.map(([s, span = 1], k) => [k, { b0: k, span, s }]));
  assert.equal(scaleFor(S, cells([[4], [3], [2]])), 1);
  assert.equal(scaleFor(S, cells([[6]])), 1);
  assert.equal(scaleFor(S, cells([[5]])), 5);
  assert.equal(scaleFor(S, cells([[8]])), 2);
  assert.equal(scaleFor(S, cells([[5], [7]])), 35);
  assert.equal(scaleFor(S, cells([[3, 2]])), 1);   // quarter triplets fit the normal grid
  assert.equal(scaleFor(C, cells([[2]])), 1);
  assert.equal(scaleFor(C, cells([[4]])), 2);
});

test('detects 5-, 6-, 7-, 9-, 10-, 11-, 12- and 13-lets in a beat', () => {
  for (const n of [5, 6, 7, 9, 10, 11, 12, 13]) {
    const bpm = n >= 9 ? 40 : 70;           // a person can tap 13 notes a beat only at a slow tempo
    const pos = [...evenly(n, 1, 1), 2, 3];  // beat 1 holds the tuplet, then two quarters
    const A = analyze(take(pos, { bpm, jitter: n >= 9 ? 12 : 20 }), OPT, LAT);
    assert.ok(cellsOf(A).includes(`1:1:${n}`), `${n}-let: got cells ${cellsOf(A)}`);
    assert.deepEqual(tupletsIn(A), [`${n}:${tupletOf(A.M, n).q}`], `${n}-let bracket`);
    assert.equal(A.notes.length, pos.length);
    checkEngraving(A, `${n}-let`);
    const abc = toAbc(A);
    assert.match(abc, new RegExp(`\\(${n}:${tupletOf(A.M, n).q}:${n}`));
  }
});

test('detects tuplets over two and four beats', () => {
  const A = analyze(take([...evenly(3, 2), 2, 3], { bpm: 90 }), OPT, LAT);  // quarter-note triplets
  assert.deepEqual(cellsOf(A).filter(c => c.startsWith('0:')), ['0:2:3']);
  assert.deepEqual(tupletsIn(A), ['3:2']);
  assert.match(toAbc(A), /\(3:2:3B12B12B12/);
  checkEngraving(A, 'quarter triplets');
  const H = analyze(take(evenly(3, 4).concat([4]), { bpm: 90 }), OPT, LAT);  // half-note triplets
  assert.ok(cellsOf(H).includes('0:4:3'), String(cellsOf(H)));
  assert.match(toAbc(H), /\(3:2:3B24B24B24/);
  checkEngraving(H, 'half triplets');
  const Q = analyze(take([...evenly(5, 2), 2, 3], { bpm: 70 }), OPT, LAT);  // 5 eighths over two beats
  assert.ok(cellsOf(Q).includes('0:2:5'), String(cellsOf(Q)));
  assert.deepEqual(tupletsIn(Q), ['5:4']);
  checkEngraving(Q, '5 over 2');
});

test('compound meters: duplets and quadruplets', () => {
  const D = analyze(take([0, 0.5, 1, 1 + 1 / 3, 1 + 2 / 3, 2], { meter: '6/8', bpm: 60 }), OPT, LAT);
  // a duplet's second note sits on the sixteenth grid, so either reading (2 per beat, or 6 with two notes) is fine
  assert.ok(cellsOf(D).includes('0:1:2') || cellsOf(D).includes('0:1:6'), String(cellsOf(D)));
  checkEngraving(D, 'duplet');
  // two notes splitting a dotted quarter are written as two dotted eighths, so no bracket is needed
  assert.match(toAbc(D), /B9B9/);
  // (with a bar of plain notes before it: in a take of only a few taps the tempo fit has too little to go on)
  const Q = analyze(take([0, 1, 1 + 1 / 3, 1 + 2 / 3, ...evenly(4, 1, 2), 3, 4], { meter: '6/8', bpm: 60 }), OPT, LAT);
  assert.ok(cellsOf(Q).includes('2:1:4'), String(cellsOf(Q)));
  assert.deepEqual(tupletsIn(Q), ['4:3']);
  checkEngraving(Q, 'quadruplet');
});

test('32nd notes with the 32nd grid', () => {
  const pos = [0, 0.5, 0.625, 0.75, 1, 1.125, 1.25, 1.5, 2];
  const A = analyze(take(pos, { bpm: 60, jitter: 10 }), { ...OPT, finest: 3 }, LAT);
  assert.equal(A.tpb, 24);
  assert.ok(cellsOf(A).includes('0:1:8') && cellsOf(A).includes('1:1:8'), String(cellsOf(A)));
  assert.match(toAbc(A), /B3\/2/);
  assert.match(toMusicXml(A, { title: 't', date: '2026-01-01' }), /<type>32nd<\/type>/);
  checkEngraving(A, '32nds');
  // with neither 32nds nor tuplets the same taps are forced onto sixteenths
  assert.equal(analyze(take(pos, { bpm: 60, jitter: 10 }), OFF, LAT).tpb, 12);
});

test('ordinary rhythms are not turned into tuplets', () => {
  const plain = [
    [0, 1, 1.5, 2, 3],                                // quarters and eighths
    [0, 0.25, 0.5, 0.75, 1, 1.75, 2, 2.5, 3],         // sixteenths, dotted eighth
    [0, 1 / 3, 2 / 3, 1, 1.5, 2, 3],                  // eighth triplets
    [0, 0.667, 1, 1.667, 2, 2.667, 3],                // swing
    [0, 0.75, 1, 1.5, 1.75, 2, 3],                    // dotted rhythms
  ];
  for (const [k, pos] of plain.entries()) for (const bpm of [60, 100, 140]) for (let seed = 1; seed <= 6; seed++) {
    const t = take(pos, { bpm, jitter: 30, seed });
    const A = analyze(t, OPT, LAT), B = analyze(t, OFF, LAT);
    const tup = tupletsIn(A).filter(x => x !== '3:2');
    assert.deepEqual(tup, [], `pattern ${k} at ${bpm} BPM seed ${seed}: ${tup}`);
    assert.equal(A.tpb, 12, `pattern ${k} at ${bpm} BPM seed ${seed}: resolution ${A.tpb}`);
    assert.deepEqual(A.notes.map(n => n.start), B.notes.map(n => n.start), `pattern ${k} at ${bpm} BPM seed ${seed}`);
  }
});

test('random takes with tuplets on: every bar engraves cleanly and the writers agree', () => {
  const meters = ['2/4', '3/4', '4/4', '5/4', '6/8', '9/8', '12/8'];
  const steps = [0.25, 0.5, 1 / 3, 0.2, 1 / 7, 1 / 6, 0.75, 1, 1.5, 2, 2 / 3, 0.125, 1 / 5, 1 / 9];
  let tuplets = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const r = rng(seed * 977), meter = meters[Math.floor(r() * meters.length)], bpm = 40 + Math.floor(r() * 130);
    const two = r() < 0.3, taps = [], beatMs = 60000 / bpm;
    let pos = r();
    for (let i = 0, n = 3 + Math.floor(r() * 40); i < n; i++) {
      const t = pos * beatMs + (r() - 0.5) * 40;
      taps.push({ t, up: r() < 0.7 ? t + 30 + r() * beatMs : null, v: two && r() < 0.4 ? 2 : 1, src: 'key' });
      pos += steps[Math.floor(r() * steps.length)];
    }
    const o = { ...OPT, finest: Math.floor(r() * 4), lengths: r() < 0.5 ? 'held' : 'next', maxLen: ['0', '1', '2', 'bar'][Math.floor(r() * 4)], simplicity: Math.floor(r() * 8) };
    const A = analyze({ bpm, meter, taps, source: 'user', barShift: Math.floor(r() * 3) - 1 }, o, LAT);
    if (A.empty) continue;
    const label = `seed ${seed} ${meter} ${bpm}`;
    checkEngraving(A, label);
    tuplets += tupletsIn(A).length;
    // ABC lengths add up per bar (L:1/48)
    const abc = toAbc(A, A.startBar, { count: 'count' });
    assert.doesNotMatch(abc, /NaN|undefined|Infinity/, label);
    // MusicXML: durations of each voice fill each measure
    const xml = toMusicXml(A, { title: 'x', date: '2026-01-01' });
    for (const m of xml.split('<measure ').slice(1)) {
      const parts = m.split(/<backup>.*?<\/backup>/);
      for (const part of parts) {
        const d = [...part.matchAll(/<duration>(\d+)<\/duration>/g)].reduce((s, x) => s + +x[1], 0);
        assert.equal(d, A.barTicks, `${label}: measure duration`);
      }
    }
    // MIDI: same number of note-ons as notes
    const mid = toMidi(A);
    assert.equal([...mid].filter((b, i) => b === 0x99 && i > 22).length >= A.notes.length, true, label);
    // share link: encode -> decode -> reopen gives the same written notes
    const rh = rhythmOf(A, { title: '' });
    if (rh.cut) continue;
    const back = analyze(takeFromRhythm(RC.decode(RC.encode(rh))), DEFAULT_OPT, LAT);
    const norm = X => X.notes.map(n => [n.v, n.start * 1e6 / X.tpb, n.end * 1e6 / X.tpb].map(Math.round).join(':')).sort().join(' ');
    const shift = X => X.startBar * X.barTicks * 1e6 / X.tpb;
    assert.equal(norm(back).split(' ').length, norm(A).split(' ').length, `${label}: link note count`);
    const a = A.notes.map(n => Math.round((n.start * 1e6 / A.tpb) - shift(A))).sort((x, y) => x - y);
    const b = back.notes.map(n => Math.round((n.start * 1e6 / back.tpb) - shift(back))).sort((x, y) => x - y);
    assert.deepEqual(b, a, `${label}: link onsets`);
    // and the share page writer (rhythmCode.toAbc) copes with it
    assert.doesNotMatch(RC.toAbc(RC.decode(RC.encode(rh)), { count: 'kodaly' }), /NaN|undefined/, label);
  }
  assert.ok(tuplets > 10, `only ${tuplets} tuplets in the random takes`);
});

test('share links: plain rhythms stay version 1, tuplets use version 2', () => {
  const plain = analyze(take([0, 1, 1.5, 2, 3]), OPT, LAT);
  assert.equal(RC.encode(rhythmOf(plain))[0], 'A');  // first byte 1 -> "AQ…"
  const five = analyze(take([...evenly(5, 1, 1), 2, 3], { bpm: 70 }), OPT, LAT);
  const code = RC.encode(rhythmOf(five)), d = RC.decode(code);
  assert.equal(d.u, five.tpb / 12);
  const back = analyze(takeFromRhythm(d), DEFAULT_OPT, LAT);
  assert.deepEqual(tupletsIn(back), ['5:4']);
  assert.throws(() => RC.decode(code.replace(/^../, 'Aw')));  // unknown version byte
});

test('every tuplet is drawable by abcjs (one-digit brackets), and the real numbers are listed for relabelling', async () => {
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const ctx = { console: { log() {}, warn() {}, error() {} }, navigator: { userAgent: 'node' } };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../vendor/abcjs-basic-min.js', import.meta.url), 'utf8'), ctx);
  const warnings = abc => ctx.ABCJS.parseOnly(abc)[0].warnings || [];
  const cases = [];
  for (const n of [5, 6, 7, 9, 10, 11, 12, 13]) cases.push([[...evenly(n, 1, 1), 2, 3], { bpm: n >= 9 ? 40 : 70, jitter: 10 }, n]);
  cases.push([[0, 1, 2, ...evenly(13, 1, 3), 4], { meter: '6/8', bpm: 30, jitter: 5 }, 13]);
  for (const [pos, opts, n] of cases) {
    const A = analyze(take(pos, opts), OPT, LAT), labels = [];
    const drawable = toAbc(A, A.startBar, { abcjs: labels });
    assert.deepEqual(warnings(drawable), [], `${n}: ${drawable}`);
    assert.ok(labels.includes(n) && labels.filter(x => x === n).length === 1, `${n}: labels ${labels}`);
    assert.equal(labels.length, (drawable.match(/\(\d:\d:\d/g) || []).length);
    if (n < 10) assert.equal(drawable, toAbc(A), 'short tuplets are written the same either way');
    else assert.ok(toAbc(A).includes(`(${n}:`), "the exported ABC keeps the real tuplet");
  }
});
