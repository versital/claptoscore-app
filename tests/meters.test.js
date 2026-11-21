// Custom meters (7/8, 2/2, 3/8, 15/8 …) and unbounded tempos: parsing, analysis, writers, share links, practice.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyze, DEFAULT_OPT } from '../src/core/analyze.js';
import { barTokens } from '../src/core/engrave.js';
import { toAbc } from '../src/core/abc.js';
import { toMusicXml } from '../src/core/musicxml.js';
import { toMidi } from '../src/core/midiFile.js';
import { takeFromRhythm, rhythmOf } from '../src/core/takes.js';
import * as RC from '../src/core/rhythmCode.js';
import { METERS, parseMeter, allowedDivs } from '../src/core/meters.js';
import { generate } from '../src/core/practice.js';

const LAT = { key: 0, mic: 0 };

test('parseMeter: what a custom meter means', () => {
  assert.deepEqual(parseMeter('7/8'), { beats: 7, tpb: 6, compound: false });
  assert.deepEqual(parseMeter('3/8'), { beats: 1, tpb: 18, compound: true });
  assert.deepEqual(parseMeter('15/8'), { beats: 5, tpb: 18, compound: true });
  assert.deepEqual(parseMeter('2/2'), { beats: 2, tpb: 24, compound: false });
  assert.deepEqual(parseMeter('6/4'), { beats: 6, tpb: 12, compound: false });
  assert.deepEqual(parseMeter('7/16'), { beats: 7, tpb: 3, compound: false });
  assert.deepEqual(parseMeter('2+2+3/8'), { beats: 7, tpb: 6, compound: false, groups: [2, 2, 3] });
  assert.deepEqual(parseMeter('3 + 2/4'), { beats: 5, tpb: 12, compound: false, groups: [3, 2] });
  for (const bad of ['7/65', '4/1', '0/4', '33/4', 'x', '', '4/4/4', '2+0/8', '20+20/8', '+2/8', '2+/8']) assert.equal(parseMeter(bad), null, bad);
  assert.equal(METERS['7/8'].beats, 7);
  assert.equal(METERS['nope'], undefined);
  assert.equal(METERS['4/4'].tpb, 12);                 // the original seven are unchanged
  assert.ok('11/8' in METERS);
  for (const M of [METERS['7/8'], METERS['2/2']]) for (let finest = 0; finest <= 3; finest++)
    for (const tuplets of [false, true]) assert.ok(allowedDivs(M, { finest, triplets: true, tuplets }).length);
});

// positions in beats -> a take (beats of the meter), jitter in ms
function take(pos, { bpm = 100, meter, jitter = 16, seed = 5 } = {}) {
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const beatMs = 60000 / bpm;
  return { bpm, meter, source: 'user', taps: pos.map(p => { const t = p * beatMs + (r() - 0.5) * jitter; return { t, up: t + 60, v: 1, src: 'key' }; }) };
}
function wholeBars(A) {
  for (const v of A.voices) for (let bar = A.startBar; bar < A.endBar; bar++) {
    const { measureRest, tokens } = barTokens(A, bar, v.segs);
    if (measureRest) continue;
    assert.equal(tokens.reduce((s, t) => s + t.dur, 0), A.barTicks, `bar ${bar} of ${A.R.meter} adds up`);
  }
}

test('custom meters: taps come out on the right note values', () => {
  const cases = [
    // 7/8 in eighth beats: 2+2+3 with a pair of 16ths
    { meter: '7/8', pos: [0, 1, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], want: 6 * 0.5 },
    // 2/2: half-note beats with quarters (0.5) and eighths (0.25)
    { meter: '2/2', pos: [0, 0.5, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6], want: null },
    // 5/8 with 16ths
    { meter: '5/8', pos: [0, 0.5, 1, 2, 3, 3.5, 4, 5, 6, 7, 8, 9, 10], want: null },
    // 3/8 and 15/8: compound
    { meter: '3/8', pos: [0, 1 / 3, 2 / 3, 1, 2, 7 / 3, 8 / 3, 3, 4], want: null },
    { meter: '15/8', pos: [0, 1, 2, 2 + 1 / 3, 2 + 2 / 3, 3, 4, 5, 6, 7, 8, 9, 10], want: null },
    { meter: '6/4', pos: [0, 1, 1.5, 2, 3, 4, 5, 6, 7, 7.5, 8], want: null },
  ];
  for (const { meter, pos } of cases) {
    const A = analyze(take(pos, { meter }), DEFAULT_OPT, LAT);
    assert.ok(!A.empty, meter);
    const got = A.notes.map(n => n.start / A.tpb - A.startBar * A.M.beats).map(x => +x.toFixed(4));
    const want = pos.map(x => +x.toFixed(4));
    assert.deepEqual(got, want, meter);
    wholeBars(A);
    const abc = toAbc(A, A.startBar);
    assert.ok(abc.includes(`M:${meter}`) && !/NaN|undefined/.test(abc), meter + '\n' + abc);
    const xml = toMusicXml(A, { title: 't', date: '2026-01-01' });
    assert.ok(!/NaN|undefined/.test(xml), meter);
    assert.ok(toMidi(A).length > 30);
  }
});

test('custom meters: tempo unit in ABC and MusicXML', () => {
  const unit = (meter) => toAbc(analyze(take([0, 1, 2, 3], { meter }), DEFAULT_OPT, LAT)).split('\n').find(l => l.startsWith('Q:'));
  assert.equal(unit('7/8'), 'Q:1/8=100');
  assert.equal(unit('2/2'), 'Q:1/2=100');
  assert.equal(unit('3/8'), 'Q:3/8=100');
  assert.equal(unit('4/4'), 'Q:1/4=100');
  const xml = toMusicXml(analyze(take([0, 1, 2, 3], { meter: '2/2' }), DEFAULT_OPT, LAT), { title: 't' });
  assert.ok(xml.includes('<beat-unit>half</beat-unit>') && xml.includes('tempo="200"'));
});

test('custom meters and odd tempos survive a share link', () => {
  for (const [meter, bpm] of [['7/8', 140], ['11/8', 90], ['2/2', 60], ['15/8', 50], ['4/4', 8], ['4/4', 1200], ['3/4', 700]]) {
    const A = analyze(take([0, 1, 2, 2.5, 3, 4, 5, 6, 7], { meter, bpm, jitter: 0 }), DEFAULT_OPT, LAT);
    const r = rhythmOf(A);
    const code = RC.encode(r), back = RC.decode(code);
    assert.equal(back.meter, meter); assert.equal(back.bpm, bpm);
    const B = analyze(takeFromRhythm(back), {}, LAT);
    const notes = X => X.notes.map(n => (n.start - X.startBar * X.barTicks) / X.tpb + '-' + (n.end - X.startBar * X.barTicks) / X.tpb).join();
    assert.equal(notes(B), notes(A), meter + ' ' + bpm);
    assert.ok(!/NaN|undefined/.test(RC.toAbc(back)));
  }
  // version 1 codes are unchanged for the original meters and tempos
  const A = analyze(take([0, 1, 2, 2.5, 3], { meter: '4/4', jitter: 0 }), DEFAULT_OPT, LAT);
  assert.equal(RC.decode(RC.encode(rhythmOf(A))).u, undefined);
});

test('counting in custom meters counts the beat', () => {
  const info = METERS['2/2'];
  assert.deepEqual(RC.syllables([{ start: 0, end: 12 }, { start: 12, end: 24 }, { start: 24, end: 48 }], info, 'count'), ['1', '&', '2']);
  const e = METERS['7/8'];
  assert.deepEqual(RC.syllables([{ start: 0, end: 3 }, { start: 3, end: 6 }, { start: 6, end: 12 }], e, 'count'), ['1', '&', '2']);
});

test('practice rhythms fill custom meters', () => {
  for (const meter of ['7/8', '5/8', '11/8', '2/2', '3/2', '3/8', '15/8', '6/4', '1/4'])
    for (let level = 1; level <= 8; level++) for (let seed = 1; seed <= 6; seed++) {
      const r = generate({ meter, bars: 4, level, seed }), M = METERS[meter], tpb = M.tpb * r.u, bar = M.beats * tpb;
      const n = r.voices[0];
      assert.ok(n.every(x => Number.isInteger(x.start) && Number.isInteger(x.end) && x.end > x.start), `${meter} L${level}`);
      assert.ok(n[n.length - 1].end <= 4 * bar, `${meter} L${level} fits`);
      for (let b = 0; b < 4; b++) assert.ok(n.some(x => Math.floor(x.start / bar) === b), `${meter} L${level} s${seed} bar ${b}`);
      const ex = RC.exercise(r, 4);
      assert.equal(new Set(ex.heads).size, n.length, `${meter} L${level} s${seed}: every note drawn`);
    }
});

test('additive meters: accents, beaming by group, share links', async () => {
  const { accentOf, groupStarts } = await import('../src/core/meters.js');
  const M = METERS['3+2+2/8'];
  assert.deepEqual(groupStarts(M), [0, 3, 5]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(b => accentOf(M, b)), [2, 0, 0, 1, 0, 1, 0, 2]);
  assert.deepEqual([0, 1, 4].map(b => accentOf(METERS['4/4'], b)), [2, 0, 2]);
  // eighths in 3+2+2/8: beamed 3 + 2 + 2 (spaces only at group starts)
  const A = analyze(take([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], { meter: '3+2+2/8', jitter: 0 }), DEFAULT_OPT, LAT);
  const line = toAbc(A).split('\n').find(l => l.includes('|'));
  assert.ok(line.startsWith('B6B6B6 B6B6 B6B6 |'), line);
  assert.ok(toAbc(A).includes('M:3+2+2/8'));
  // a note from beat 2 to beat 4 crosses the group at 3: written tied, not as one quarter across it
  const B = analyze(take([0, 1, 2, 4, 5, 6, 7], { meter: '3+2+2/8', jitter: 0 }), { ...DEFAULT_OPT, maxLen: 0 }, LAT);
  wholeBars(B);
  const toks = barTokens(B, B.startBar, B.voices[0].segs).tokens;
  for (const t of toks) { const s = t.at - B.startBar * B.barTicks; assert.ok(!(s < 18 && s + t.dur > 18), 'no value across the group at beat 3'); }
  // MIDI time signature: 7/8
  const midi = toMidi(A); let i = 0; while (i < midi.length - 3 && !(midi[i] === 0xff && midi[i + 1] === 0x58)) i++;
  assert.equal(midi[i + 3], 7);
  // links
  for (const meter of ['2+2+3/8', '3+3+2/8', '3+2/4', '2+3+2+2/16']) {
    const X = analyze(take([0, 1, 2, 3, 4, 5, 6, 7], { meter, jitter: 0 }), DEFAULT_OPT, LAT);
    const back = RC.decode(RC.encode(rhythmOf(X)));
    assert.equal(back.meter, meter);
    assert.ok(!/NaN|undefined/.test(RC.toAbc(back)));
  }
  // practice: groups are filled one by one, so no written value crosses a group
  for (let seed = 1; seed <= 10; seed++) for (const level of [1, 3, 5]) {
    const r = generate({ meter: '3+2+2/8', bars: 2, level, seed }), tpb = 6 * r.u;
    for (const n of r.voices[0]) for (const g of [3, 5, 7, 10, 12]) assert.ok(!(n.start < g * tpb && n.end > g * tpb), `seed ${seed} L${level}`);
  }
});

test('irrational meters (4/3, 5/6, 7/12 …): written in the next power of two, ratio by the tempo', () => {
  assert.deepEqual(parseMeter('4/3'), { beats: 4, tpb: 24, compound: false, irr: { d: 3, D: 2, p: 3, q: 2 }, written: '4/2' });
  assert.deepEqual(parseMeter('5/6').irr, { d: 6, D: 4, p: 3, q: 2 });
  assert.equal(parseMeter('6/12').compound, true);                  // written 6/8
  assert.equal(parseMeter('7/12').written, '7/8');
  assert.deepEqual(parseMeter('3/5').irr, { d: 5, D: 4, p: 5, q: 4 });
  assert.deepEqual(parseMeter('2+2+3/12').groups, [2, 2, 3]);
  assert.equal(parseMeter('5/48').written, '5/16');
  for (const [meter, ratio] of [['4/3', '3:2'], ['5/6', '3:2'], ['3/5', '5:4'], ['7/12', '3:2'], ['6/12', '3:2'], ['2+3/6', '3:2'], ['5/7', '7:4']]) {
    const A = analyze(take([0, 1, 1.5, 2, 3, 4, 4.5, 5, 6, 7], { meter, jitter: 0 }), DEFAULT_OPT, LAT);
    assert.ok(!A.empty, meter);
    wholeBars(A);
    const abc = toAbc(A);
    assert.ok(abc.includes(`M:${meter}`) && abc.includes(`Q:"${ratio}"`) && !/NaN|undefined/.test(abc), meter + '\n' + abc);
    const xml = toMusicXml(A, { title: 't' }), [wn, wd] = parseMeter(meter).written.split('/');
    assert.ok(xml.includes(`<beat-type>${wd}</beat-type>`) && !/NaN|undefined/.test(xml), meter);
    const midi = toMidi(A); let i = 0; while (i < midi.length - 4 && !(midi[i] === 0xff && midi[i + 1] === 0x58)) i++;
    assert.equal(2 ** midi[i + 4], +wd, meter + ' MIDI denominator');
    const back = RC.decode(RC.encode(rhythmOf(A)));
    assert.equal(back.meter, meter);
    assert.ok(RC.toAbc(back).includes(`M:${meter}`));
    const r = generate({ meter, bars: 2, level: 4, seed: 3 });
    assert.ok(r.voices[0].length > 0 && RC.exercise(r, 2).bars === 2, meter);
  }
});
