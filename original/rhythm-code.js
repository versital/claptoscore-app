/* Rhythm codes and counting syllables, shared by the main tool, the lesson engine, the share page (/r/<code>)
   and the server function that draws link previews.

   A rhythm code is a whole rhythm packed into a short URL-safe string, so a link carries the rhythm itself and
   nothing is stored anywhere. Layout (version 1), base64url:
     byte 0  version (1)
     byte 1  meter index (low 4 bits) | flags (high bits: 16 = notes hidden for dictation, 32 = two voices)
     varint  tempo in BPM (beats as written: quarter notes, or dotted quarters in compound meters)
     per voice: varint note count, then per note varint gap (rest before it) and varint length, in ticks
     rest    the title, UTF-8
   Ticks: 12 per quarter note (16th = 3, eighth triplet = 4); a compound beat (dotted quarter) is 18.
   With two voices, voice 1 is the high voice (snare, stems up) and voice 2 the low voice (kick). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.RhythmCode = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const METERS = {
  '2/4': { beats: 2, tpb: 12, compound: false },
  '3/4': { beats: 3, tpb: 12, compound: false },
  '4/4': { beats: 4, tpb: 12, compound: false },
  '5/4': { beats: 5, tpb: 12, compound: false },
  '6/8': { beats: 2, tpb: 18, compound: true },
  '9/8': { beats: 3, tpb: 18, compound: true },
  '12/8': { beats: 4, tpb: 18, compound: true },
};
const METER_IDS = ['2/4', '3/4', '4/4', '5/4', '6/8', '9/8', '12/8'];
const MAX_BARS = 16, MAX_NOTES = 400, MAX_TITLE = 60;
const HIDE = 16, TWO = 32;

// ---------- bytes ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function b64u(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (i + 1 < bytes.length ? B64[n >> 6 & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '');
  }
  return s;
}
function unb64u(s) {
  const out = [];
  for (let i = 0; i < s.length; i += 4) {
    const c = [0, 1, 2, 3].map(k => i + k < s.length ? B64.indexOf(s[i + k]) : 0);
    const n = (c[0] << 18) | (c[1] << 12) | (c[2] << 6) | c[3];
    out.push(n >> 16 & 255);
    if (i + 2 < s.length) out.push(n >> 8 & 255);
    if (i + 3 < s.length) out.push(n & 255);
  }
  return out;
}
const putVar = (a, n) => { n = Math.max(0, Math.floor(n)); while (n >= 128) { a.push((n & 127) | 128); n = Math.floor(n / 128); } a.push(n); };
function getVar(a, pos) {
  let n = 0, mul = 1;
  for (let k = 0; k < 4; k++) {
    if (pos.i >= a.length) throw new Error('truncated');
    const b = a[pos.i++]; n += (b & 127) * mul;
    if (!(b & 128)) return n;
    mul *= 128;
  }
  throw new Error('varint too long');
}

// A title is shown on the page and in the link preview, so it is kept short and plain: no control or
// direction characters, and nothing that looks like a web address, email or phone number.
function cleanTitle(s) {
  if (!s) return '';
  let t = String(s).normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  t = Array.from(t).slice(0, MAX_TITLE).join('').trim();
  if (/https?:|www\.|[a-z0-9-]\.(com|net|org|info|biz|io|co|ru|cn|xyz|top|link|click|app|site|online|me|ly|gg|tk|nl|de|uk)\b|@|(?:\d[\s().+-]*){9,}/i.test(t)) return '';
  return t;
}

// ---------- encode / decode ----------
// r: { meter, bpm, voices: [[{start, end}], ...] (ticks from the first barline), title, hide }
function encode(r) {
  const mi = METER_IDS.indexOf(r.meter);
  if (mi < 0) throw new Error('meter');
  const two = r.voices.length > 1;
  const bytes = [1, mi | (r.hide ? HIDE : 0) | (two ? TWO : 0)];
  putVar(bytes, Math.max(20, Math.min(400, Math.round(r.bpm))));
  for (const v of (two ? r.voices.slice(0, 2) : r.voices.slice(0, 1))) {
    const notes = [...v].sort((a, b) => a.start - b.start);
    putVar(bytes, notes.length);
    let cur = 0;
    for (const n of notes) { putVar(bytes, n.start - cur); putVar(bytes, n.end - n.start); cur = n.end; }
  }
  const title = cleanTitle(r.title);
  if (title) bytes.push(...new TextEncoder().encode(title));
  return b64u(bytes);
}

function decode(code) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{4,800}$/.test(code)) throw new Error('not a rhythm code');
  const a = unb64u(code), pos = { i: 2 };
  if (a[0] !== 1) throw new Error('unknown version');
  const meter = METER_IDS[a[1] & 15];
  if (!meter) throw new Error('meter');
  const M = METERS[meter], barTicks = M.beats * M.tpb, limit = MAX_BARS * barTicks;
  const bpm = getVar(a, pos);
  if (bpm < 20 || bpm > 400) throw new Error('tempo');
  const two = !!(a[1] & TWO), voices = [];
  let total = 0;
  for (let k = 0; k < (two ? 2 : 1); k++) {
    const count = getVar(a, pos), notes = [];
    total += count;
    if (total > MAX_NOTES) throw new Error('too many notes');
    let cur = 0;
    for (let j = 0; j < count; j++) {
      const start = cur + getVar(a, pos), len = getVar(a, pos), end = start + len;
      if (len < 1 || end > limit) throw new Error('note out of range');
      notes.push({ start, end }); cur = end;
    }
    voices.push(notes);
  }
  if (!total) throw new Error('no notes');
  // every beat is split one way: sixteenths (or eighths in compound meters), or eighth triplets
  const kinds = new Map();
  for (const n of voices.flat()) for (const t of [n.start, n.end]) {
    const b = Math.floor(t / M.tpb), p = t - b * M.tpb;
    if (!p) continue;
    const kind = p % 3 === 0 ? 'd' : (!M.compound && p % 4 === 0) ? 't' : 'x';
    if (kind === 'x' || (kinds.has(b) && kinds.get(b) !== kind)) throw new Error('unsupported subdivision');
    kinds.set(b, kind);
  }
  let title = '';
  if (pos.i < a.length) { try { title = cleanTitle(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(a.slice(pos.i)))); } catch { title = ''; } }
  return { meter, bpm, voices, title, hide: !!(a[1] & HIDE), two };
}

// ---------- layout: bars, beats, and engraving tokens (same rules as the main tool) ----------
const REPR = [72, 48, 36, 24, 18, 12, 9, 6, 3];
const REPR_SET = new Set(REPR), DOTTED = new Set([9, 18, 36, 72]);

function layout(r) {
  const M = METERS[r.meter], tpb = M.tpb, barTicks = M.beats * tpb;
  const all = r.voices.flat();
  const endBar = Math.max(1, Math.ceil(Math.max(...all.map(n => n.end)) / barTicks));
  const grid = new Map();
  for (const n of all) for (const t of [n.start, n.end]) { const b = Math.floor(t / tpb), p = t - b * tpb; if (!M.compound && p % 4 === 0 && p % 3 !== 0) grid.set(b, 3); }
  const segsOf = notes => {
    const segs = []; let cur = 0, id = 0;
    for (const n of [...notes].sort((x, y) => x.start - y.start)) {
      if (n.start > cur) segs.push({ start: cur, end: n.start, rest: true });
      segs.push({ start: n.start, end: n.end, rest: false, id: id++ }); cur = n.end;
    }
    if (cur < endBar * barTicks) segs.push({ start: cur, end: endBar * barTicks, rest: true });
    return segs;
  };
  return { M, tpb, barTicks, startBar: 0, endBar, grid, segsOf };
}

// Engraving decisions for one bar of one voice. Each token is one written note or rest: dur = sounding ticks,
// notated = written ticks (differs inside triplets), tie = tied into the next token, trip = triplet group info.
function barTokens(A, bar, segs) {
  const { M, tpb, barTicks, grid } = A, b0 = bar * barTicks;
  if (segs.some(s => s.rest && s.start <= b0 && s.end >= b0 + barTicks)) return { measureRest: true, tokens: [] };
  let pieces = [];
  for (let j = 0; j < M.beats; j++) {
    const bs = b0 + j * tpb, be = bs + tpb;
    const trip = !M.compound && grid.get(bar * M.beats + j) === 3;
    const inBeat = [];
    for (const s of segs) {
      if (s.end <= bs || s.start >= be) continue;
      const ps = Math.max(s.start, bs), pe = Math.min(s.end, be);
      inBeat.push({ start: ps - b0, len: pe - ps, rest: s.rest, id: s.id, tieOut: !s.rest && s.end > pe, tieIn: !s.rest && s.start < ps, beat: j, trip });
    }
    if (inBeat.length === 1 || inBeat.every(x => x.len % 6 === 0 && x.start % 6 === 0)) inBeat.forEach(x => { x.trip = false; });
    pieces.push(...inBeat);
  }
  const mid = (M.beats % 2 === 0 && M.beats >= 4) ? barTicks / 2 : null;
  const canMerge = (x, y) => {
    if (x.trip || y.trip || y.start !== x.start + x.len) return false;
    const same = (x.rest && y.rest) || (!x.rest && !y.rest && x.tieOut && x.id === y.id);
    if (!same || x.start % tpb || x.len % tpb) return false;
    const L = x.len + y.len;
    if (!REPR_SET.has(L)) return false;
    if (y.len % tpb) { if (M.compound || x.rest || x.len !== tpb || y.len !== tpb / 2) return false; }
    if (x.rest && !M.compound && DOTTED.has(L)) return false;
    if (mid !== null && x.start !== 0 && x.start < mid && x.start + L > mid) return false;
    return true;
  };
  for (let i = 0; i + 1 < pieces.length;) {
    const x = pieces[i], y = pieces[i + 1];
    if (canMerge(x, y)) { x.len += y.len; x.tieOut = y.tieOut; pieces.splice(i + 1, 1); } else i++;
  }
  const split = len => { const out = []; for (const r of REPR) while (len >= r) { out.push(r); len -= r; } if (len > 0) out.push(len); return out; };
  const tokens = [];
  const push = (p, scale, trip) => {
    let at = b0 + p.start;
    split(p.len * scale).forEach((l, k, parts) => {
      tokens.push({ rest: p.rest, dur: l / scale, notated: l, beat: p.beat, beatStart: k === 0 && p.start % tpb === 0,
        tie: !p.rest && (k < parts.length - 1 || p.tieOut), onset: !p.rest && k === 0 && !p.tieIn, at, trip, id: p.id });
      at += l / scale;
    });
  };
  for (let i = 0; i < pieces.length;) {
    const p = pieces[i];
    if (p.trip) {
      const first = tokens.length;
      while (i < pieces.length && pieces[i].trip && pieces[i].beat === p.beat) push(pieces[i++], 1.5, true);
      const grp = tokens.slice(first);
      grp.forEach((t, k) => { t.trip = { n: grp.length, pos: k === 0 ? 'start' : k === grp.length - 1 ? 'stop' : 'mid' }; });
    } else { push(p, 1, null); i++; }
  }
  return { measureRest: false, tokens };
}

// ---------- counting syllables ----------
// info: { beats, tpb, compound } for a standard meter, or { labels, clickTicks } for a click-defined cycle
// (flamenco compás: one label per count). notes: [{start, end}] in ticks from the first barline.
// mode 'count' gives 1 e & a / 1 trip let / 1 la li; mode 'kodaly' gives ta, ti-ti, tika-tika, tri-o-la, syn-co-pa.
function countSyllable(start, info) {
  if (info.labels) {
    const ct = info.clickTicks, i = Math.floor(start / ct), off = start - i * ct;
    if (!off) return info.labels[i % info.labels.length];
    if (ct === 18) return off === 6 ? 'la' : off === 12 ? 'li' : '&';  // dotted-quarter click: its thirds are eighths, as in 6/8
    return off * 2 === ct ? '&' : off * 4 === ct ? 'e' : off * 4 === 3 * ct ? 'a' : off * 3 === ct ? 'trip' : off * 3 === 2 * ct ? 'let' : '·';
  }
  const b = Math.floor(start / info.tpb), p = start - b * info.tpb, num = String(b % info.beats + 1);
  if (!p) return num;
  if (info.compound) return p === 6 ? 'la' : p === 12 ? 'li' : '&';
  return { 3: 'e', 6: '&', 9: 'a', 4: 'trip', 8: 'let' }[p] || '·';
}
const longTa = dur => { const n = Math.floor(dur / 12); return 'ta' + '-a'.repeat(Math.max(0, n - 1)) + (dur % 12 >= 6 ? '-i' : ''); };
function kodaly(notes, info) {
  const out = notes.map(() => ''), tpb = info.tpb;
  const d = k => notes[k].end - notes[k].start;
  for (let i = 0; i < notes.length; i++) {
    if (out[i]) continue;
    const b = Math.floor(notes[i].start / tpb);
    const grp = []; let j = i;
    while (j < notes.length && Math.floor(notes[j].start / tpb) === b) grp.push(j++);
    const pos = grp.map(k => notes[k].start - b * tpb), key = pos.join(',');
    let syl = null;
    if (!info.compound) {
      if (key === '0,6' && d(grp[0]) === 6 && d(grp[1]) === 12 && j < notes.length && notes[j].start === (b + 1) * tpb + 6 && d(j) <= 6) {
        out[grp[0]] = 'syn'; out[grp[1]] = 'co'; out[j] = 'pa'; i = j; continue;
      }
      if (key === '0' && d(i) >= tpb) syl = [longTa(d(i))];
      else if (key === '0') syl = [d(i) === 9 ? 'tim' : 'ti'];
      else if (pos.some(x => x % 3)) syl = { '0,4,8': ['tri', 'o', 'la'], '0,8': ['ta', 'la'], '0,4': ['tri', 'o'], '4,8': ['o', 'la'] }[key] || pos.map(x => x === 0 ? 'tri' : x === 4 ? 'o' : 'la');
      else syl = { '0,6': ['ti', 'ti'], '0,3,6,9': ['ti', 'ka', 'ti', 'ka'], '0,6,9': ['ti', 'ti', 'ka'], '0,3,6': ['ti', 'ka', 'ti'], '0,9': ['tim', 'ka'], '0,3,9': ['ti', 'ti', 'ka'], '0,3': ['ti', 'ka'] }[key]
        || (pos[0] === 0 ? pos.map(x => x % 6 ? 'ka' : 'ti') : pos.map((x, m) => m % 2 ? 'ka' : 'ti'));
    } else {
      if (key === '0' && d(i) >= tpb) syl = ['ta' + '-i'.repeat(Math.max(0, Math.round(d(i) / 6) - 1))];
      else if (key === '0' || key === '6') syl = [d(i) >= 12 ? 'ta' : 'ti'];
      else if (key === '0,12') syl = d(grp[0]) >= 12 ? ['ta', 'ti'] : ['ti', 'ti'];
      else if (key === '0,6') syl = d(grp[1]) >= 12 ? ['ti', 'ta'] : ['ti', 'ti'];
      else syl = { '0,6,12': ['tri', 'o', 'la'], '6,12': ['ti', 'ti'], '12': ['ti'], '0,3,6,9,12,15': ['ti', 'ka', 'ti', 'ka', 'ti', 'ka'], '0,9,12': ['tim', 'ka', 'ti'] }[key]
        || pos.map(x => x % 6 ? 'ka' : 'ti');
    }
    grp.forEach((k, m) => { out[k] = syl[m] || ''; });
    i = j - 1;
  }
  return out;
}
function syllables(notes, info, mode) {
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  return mode === 'kodaly' && !info.labels ? kodaly(sorted, info) : sorted.map(n => countSyllable(n.start, info));
}
const lyricEsc = s => s.replace(/-/g, '\\-').replace(/ /g, '~');

// ---------- ABC for a decoded rhythm (the share page and its exercise card) ----------
function toAbc(r, { count = 'off', perLine = 4, font = 'Geist 9' } = {}) {
  const A = layout(r), M = A.M;
  const head = ['X:1', `M:${r.meter}`, 'L:1/48', `Q:${M.compound ? '3/8' : '1/4'}=${Math.round(r.bpm)}`];
  const systems = [];
  for (let bar = 0; bar < A.endBar; bar += perLine) systems.push([bar, Math.min(A.endBar, bar + perLine)]);
  const barAbc = (bar, segs, letter) => {
    const { measureRest, tokens } = barTokens(A, bar, segs);
    if (measureRest) return { abc: 'Z', tokens };
    let out = '';
    tokens.forEach((t, i) => {
      if (t.beatStart && i) out += ' ';
      if (t.trip && t.trip.pos === 'start') out += `(3:2:${t.trip.n}`;
      out += (t.rest ? 'z' : letter) + t.notated + (t.tie ? '-' : '');
    });
    return { abc: out, tokens };
  };
  const line = (segs, letter, [b0, b1], last) => {
    const bars = [], toks = [];
    for (let b = b0; b < b1; b++) { const x = barAbc(b, segs, letter); bars.push(x.abc); toks.push(...x.tokens); }
    return { abc: bars.join(' | ') + (last ? ' |]' : ' |'), tokens: toks };
  };
  const two = r.voices.length > 1;
  if (!two) {
    const segs = A.segsOf(r.voices[0]);
    let syl = null;
    if (count !== 'off') {
      const sorted = [...r.voices[0]].sort((a, b) => a.start - b.start), sy = syllables(sorted, M, count);
      syl = new Map(sorted.map((n, k) => [n.start, sy[k]]));
    }
    const body = [];
    if (syl) body.push(`%%vocalfont ${font}`);
    systems.forEach((s, k) => {
      const l = line(segs, 'B', s, k === systems.length - 1);
      body.push(l.abc);
      if (syl) body.push('w: ' + l.tokens.filter(t => !t.rest).map(t => t.onset ? lyricEsc(syl.get(t.at) || '*') : '*').join(' '));
    });
    return [...head, 'K:C clef=perc stafflines=1', ...body].join('\n');
  }
  const body = [];
  systems.forEach((s, k) => {
    const last = k === systems.length - 1;
    body.push('[V:1] ' + line(A.segsOf(r.voices[0]), 'c', s, last).abc);
    body.push('[V:2] ' + line(A.segsOf(r.voices[1]), 'F', s, last).abc);
  });
  return [...head, '%%score (1 2)', 'V:1 clef=perc stem=up', 'V:2 clef=perc stem=down', 'K:C clef=perc', ...body].join('\n');
}

// ---------- exercise data for the lesson engine ----------
// onsets in sixteenth-note units (the engine's unit), merged across voices; heads maps every written note head,
// in the order abcjs draws them, to its onset; low marks onsets played by the low voice only.
function exercise(r, perLine = 4) {
  const A = layout(r);
  const times = [...new Set(r.voices.flat().map(n => n.start))].sort((a, b) => a - b);
  const idx = new Map(times.map((t, k) => [t, k]));
  const highAt = new Set((r.voices.length > 1 ? r.voices[0] : r.voices.flat()).map(n => n.start));
  const heads = [];
  for (let bar = 0; bar < A.endBar; bar += perLine) {
    for (const v of r.voices) {
      const segs = A.segsOf(v);
      for (let b = bar; b < Math.min(A.endBar, bar + perLine); b++) {
        for (const t of barTokens(A, b, segs).tokens) {
          if (t.rest) continue;
          const note = v.find(n => n.start <= t.at && t.at < n.end);
          heads.push(idx.get(note ? note.start : t.at));
        }
      }
    }
  }
  return { onsets: times.map(t => t / 3), low: times.map(t => !highAt.has(t)), total: A.endBar * A.barTicks / 3, heads, bars: A.endBar };
}
// The click for a standard meter: quarter notes, or dotted quarters in compound meters, accent on the downbeat.
const clickFor = meter => { const M = METERS[meter]; return { beats: M.beats, upb: M.tpb / 3, accents: [0] }; };

// ---------- exercise strings of the lessons (ABC with L:1/16) ----------
// Returns written tokens with start ticks, so the engine can put syllables under them.
function parseSrc(src) {
  const toks = src.match(/\(3(?::\d+:\d+)?|[Bz]\d*-?|\|/g) || [];
  let pos = 0, trip = 0, tieNext = false;
  const tokens = [];
  for (const tok of toks) {
    if (tok === '|') continue;
    if (tok.startsWith('(3')) { const p = tok.split(':'); trip = p.length === 3 ? +p[2] : 3; continue; }
    const rest = tok[0] === 'z', tie = tok.endsWith('-');
    const len = (+tok.slice(1).replace('-', '') || 1) * 3;
    const dur = trip > 0 ? len * 2 / 3 : len;
    if (trip > 0) trip--;
    tokens.push({ rest, at: pos, dur, onset: !rest && !tieNext, tie: !rest && tie });
    tieNext = !rest && tie;
    pos += dur;
  }
  return { tokens, total: pos };
}
// w: line for an exercise string; info as for syllables()
function srcLyrics(src, info, mode) {
  const { tokens } = parseSrc(src);
  const notes = [];
  tokens.forEach(t => {
    if (t.rest) return;
    if (t.onset) notes.push({ start: t.at, end: t.at + t.dur });
    else if (notes.length) notes[notes.length - 1].end = t.at + t.dur;
  });
  const syl = syllables(notes, info, mode), byStart = new Map(notes.map((n, k) => [n.start, syl[k]]));
  return tokens.filter(t => !t.rest).map(t => t.onset ? lyricEsc(byStart.get(t.at) || '*') : '*').join(' ');
}

// ---------- link-preview model: the rhythm as rows of lit steps ----------
function grid(r) {
  const A = layout(r), M = A.M, tpb = A.tpb;
  const pts = r.voices.flat().flatMap(n => [n.start, n.end]);
  const steps = (M.compound ? [1, 3, 6] : [1, 2, 4, 3, 6, 12]).find(s => pts.every(t => (t % tpb) % (tpb / s) === 0)) || (M.compound ? 6 : 12);
  const step = tpb / steps, perBar = M.beats * steps;
  const lanes = r.voices.map(v => {
    const bars = [];
    for (let b = 0; b < A.endBar; b++) {
      const cells = new Array(perBar).fill('');
      for (const n of v) for (let c = 0; c < perBar; c++) {
        const t = b * A.barTicks + c * step;
        if (t === n.start) cells[c] = 'on'; else if (t > n.start && t < n.end) cells[c] = 'hold';
      }
      bars.push(cells);
    }
    return bars;
  });
  return { bars: A.endBar, beats: M.beats, steps, perBar, lanes };
}

// T: the page language's lookup (see i18n.py); English by default
const describe = (r, T = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => v[k])) => {
  const bars = layout(r).endBar, v = { n: bars, meter: r.meter, bpm: Math.round(r.bpm) };
  return { bars, text: bars === 1 ? T('{n} bar in {meter} at {bpm} BPM', v) : T('{n} bars in {meter} at {bpm} BPM', v) };
};

return { METERS, METER_IDS, MAX_BARS, MAX_TITLE, encode, decode, cleanTitle, layout, barTokens, toAbc, exercise, clickFor,
  syllables, countSyllable, parseSrc, srcLyrics, grid, describe };
});
