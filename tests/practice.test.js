import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, scoreRun, noteTimes, levelName, groupsFor, MAX_LEVEL, windows } from '../src/core/practice.js';
import { METERS, METER_IDS } from '../src/core/meters.js';
import { toAbc, exercise, encode, decode } from '../src/core/rhythmCode.js';

test('generated rhythms fill every bar exactly and can be written', () => {
  for (const meter of METER_IDS) for (let level = 1; level <= MAX_LEVEL; level++) for (let seed = 1; seed <= 15; seed++) {
    const r = generate({ meter, bpm: 100, bars: 8, level, seed });
    const M = METERS[meter], tpb = M.tpb * r.u, n = r.voices[0];
    assert.ok(n.length > 0);
    for (let k = 0; k < n.length; k++) {
      assert.ok(Number.isInteger(n[k].start) && Number.isInteger(n[k].end), `${meter} L${level} whole ticks`);
      assert.ok(n[k].end > n[k].start);
      if (k) assert.ok(n[k].start >= n[k - 1].end, 'no overlaps');
    }
    assert.ok(n[n.length - 1].end <= 8 * M.beats * tpb);
    for (let bar = 0; bar < 8; bar++) assert.ok(n.some(x => Math.floor(x.start / (M.beats * tpb)) === bar), `${meter} L${level} s${seed} bar ${bar} has a note`);
    const abc = toAbc(r, { perLine: 8 });
    assert.ok(!/NaN|undefined/.test(abc), abc);
    const ex = exercise(r, 8);
    assert.equal(ex.bars, 8);
    assert.equal(new Set(ex.heads).size, n.length, `${meter} L${level} s${seed}: every note drawn`);
    assert.deepEqual(decode(encode(r)).voices[0].map(x => x.start), n.map(x => x.start));
  }
});

test('levels: names, and tuplets only from the tuplet levels', () => {
  assert.equal(levelName('4/4', 3), 'Triplets, dotted quarters, syncopation');
  assert.equal(levelName('4/4', 7), 'Quintuplets');
  for (const meter of ['4/4', '6/8']) {
    for (let level = 1; level <= 5; level++) for (let seed = 1; seed <= 20; seed++) assert.equal(generate({ meter, level, seed }).u, 1);
    const us = [1, 2, 3, 4, 5, 6].map(seed => generate({ meter, level: 7, seed }).u);
    assert.ok(us.filter(u => u % 5 === 0).length >= 4, String(us));
  }
  const r = generate({ meter: '4/4', level: 1, seed: 5 });
  for (const x of r.voices[0]) assert.equal(x.start % 12, 0, 'level 1: notes on beats');
  // custom: only sixteenths
  const c = generate({ meter: '4/4', custom: ['sixteenths'], seed: 2 });
  assert.ok(c.voices[0].every(x => x.start % 3 === 0));
  assert.ok(groupsFor('6/8').some(g => g.id === 'duplets'));
});

test('scoring: hits, misses, extras, accuracy', () => {
  const notes = [0, 500, 1000, 1500].map(t => ({ t, end: t + 500 }));
  let s = scoreRun(notes, notes.map(n => ({ t: n.t + 5 })));
  assert.equal(s.hits, 4); assert.equal(s.accuracy, 1);
  s = scoreRun(notes, []);
  assert.equal(s.misses, 4); assert.equal(s.accuracy, 0);
  s = scoreRun(notes, [{ t: 0 }, { t: 250 }, { t: 1000 }, { t: 1500 }]);
  assert.equal(s.hits, 3); assert.equal(s.extras, 1); assert.equal(s.misses, 1);
  assert.ok(Math.abs(s.accuracy - 3 / 5) < 1e-9);
  // double tap on one note: one hit, one extra, the closer tap counts
  s = scoreRun(notes, [{ t: 80 }, { t: 2 }, { t: 500 }, { t: 1000 }, { t: 1500 }]);
  assert.equal(s.notes[0].err, 2); assert.equal(s.extras, 1);
  // late but within the window: partial credit
  s = scoreRun(notes, notes.map(n => ({ t: n.t + 90 })));
  assert.equal(s.hits, 4); assert.ok(s.accuracy > 0.5 && s.accuracy < 1); assert.equal(s.meanErr, 90);
  // hold: releases count
  const held = scoreRun(notes, notes.map(n => ({ t: n.t, up: n.end - 10 })), { hold: true });
  assert.equal(held.accuracy, 1);
  const short = scoreRun(notes, notes.map(n => ({ t: n.t, up: n.t + 50 })), { hold: true });
  assert.ok(short.accuracy <= 0.5 + 1e-9);
  // windows never overlap
  const w = windows([0, 100, 130, 400]);
  assert.ok(w[1] + w[2] < 30);
});

test('note times follow the tempo', () => {
  const r = generate({ meter: '4/4', bpm: 120, level: 1, seed: 1 });
  const t = noteTimes(r);
  assert.equal(t[0].t, 0);
  assert.ok(t.every(x => x.t % 500 === 0));
  const c = generate({ meter: '6/8', bpm: 60, level: 2, seed: 1 });
  assert.ok(noteTimes(c).every(x => Math.abs(x.t / (1000 / 3) - Math.round(x.t / (1000 / 3))) < 1e-6));
});
