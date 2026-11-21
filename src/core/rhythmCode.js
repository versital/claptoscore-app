/* Rhythm codes and counting syllables, shared by the main tool, the lesson engine, the share page (/r/<code>)
   and the server function that draws link previews.

   ES-module version of the original site/rhythm-code.js (kept verbatim in original/). The meter table and the
   engraving rules (barTokens) now come from ./meters.js and ./engrave.js instead of private copies.
   The server/lesson pages that require()'d the UMD build are not part of this project.

   A rhythm code is a whole rhythm packed into a short URL-safe string, so a link carries the rhythm itself and
   nothing is stored anywhere. Layout (version 1), base64url:
     byte 0  version (1)
     byte 1  meter index (low 4 bits) | flags (high bits: 16 = notes hidden for dictation, 32 = two voices)
     varint  tempo in BPM (beats as written: quarter notes, or dotted quarters in compound meters)
     per voice: varint note count, then per note varint gap (rest before it) and varint length, in ticks
     rest    the title, UTF-8
   Ticks: 12 per quarter note (16th = 3, eighth triplet = 4); a compound beat (dotted quarter) is 18.
   With two voices, voice 1 is the high voice (snare, stems up) and voice 2 the low voice (kick).

   Version 2 (this build, for tuplets and 32nds): the same, with a varint u right after the tempo; ticks are then
   12u per quarter. Version 1 is still written whenever the rhythm fits it, so ordinary links are unchanged.
   A custom meter (7/8, 2/2 …) has meter index 15 and needs version 2: two varints (numerator, denominator) follow u.
   An additive meter (2+2+3/8) has index 14: after u a varint group count, one varint per group, then the denominator.
   Version 2 also carries tempos outside the original 20–400 BPM. */
const CUSTOM = 15, GROUPED = 14, BPM_MIN = 1, BPM_MAX = 9999;
import { METERS, METER_IDS, parseMeter, beatUnit } from './meters.js';
import { barTokens } from './engrave.js';
import { abcTokens } from './abcText.js';
import { quantize } from './quantize.js';

export const MAX_BARS = 16, MAX_NOTES = 400, MAX_TITLE = 60, MAX_U = 360360;
// longest code accepted: version 1 as in the original; version 2 ticks are finer, so its numbers take more bytes
export const MAX_CODE = { 1: 800, 2: 4000 };
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
export function cleanTitle(s) {
  if (!s) return '';
  let t = String(s).normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  t = Array.from(t).slice(0, MAX_TITLE).join('').trim();
  if (/https?:|www\.|[a-z0-9-]\.(com|net|org|info|biz|io|co|ru|cn|xyz|top|link|click|app|site|online|me|ly|gg|tk|nl|de|uk)\b|@|(?:\d[\s().+-]*){9,}/i.test(t)) return '';
  return t;
}

// ---------- encode / decode ----------
// Version 1 only carries sixteenths (eighths in compound meters) or eighth triplets, one kind per beat.
function fitsV1(M, voices) {
  const kinds = new Map();
  for (const n of voices.flat()) for (const t of [n.start, n.end]) {
    const b = Math.floor(t / M.tpb), p = t - b * M.tpb;
    if (!p) continue;
    const kind = p % 3 === 0 ? 'd' : (!M.compound && p % 4 === 0) ? 't' : 'x';
    if (kind === 'x' || (kinds.has(b) && kinds.get(b) !== kind)) return false;
    kinds.set(b, kind);
  }
  return true;
}

// r: { meter, bpm, voices: [[{start, end}], ...] (ticks from the first barline), title, hide, u? (ticks are 12u per
// quarter; default 1) }
export function encode(r) {
  let mi = METER_IDS.indexOf(r.meter);
  if (mi < 0) { const M = parseMeter(r.meter); if (!M) throw new Error('meter'); mi = M.groups ? GROUPED : CUSTOM; }
  const two = r.voices.length > 1, u = r.u || 1, bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(r.bpm)));
  const v2 = r.u !== undefined || mi >= GROUPED || bpm < 20 || bpm > 400 || !fitsV1(METERS[r.meter], two ? r.voices.slice(0, 2) : r.voices.slice(0, 1));
  const bytes = [v2 ? 2 : 1, mi | (r.hide ? HIDE : 0) | (two ? TWO : 0)];
  putVar(bytes, bpm);
  if (v2) putVar(bytes, u);
  if (mi === CUSTOM) { const [n, d] = r.meter.split('/').map(Number); putVar(bytes, n); putVar(bytes, d); }
  if (mi === GROUPED) { const M = parseMeter(r.meter); putVar(bytes, M.groups.length); M.groups.forEach(g => putVar(bytes, g)); putVar(bytes, 48 / M.tpb); }
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

export function decode(code) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{4,4000}$/.test(code)) throw new Error('not a rhythm code');
  const a = unb64u(code), pos = { i: 2 };
  if (a[0] !== 1 && a[0] !== 2) throw new Error('unknown version');
  if (code.length > MAX_CODE[a[0]]) throw new Error('not a rhythm code');
  let meter = METER_IDS[a[1] & 15];
  const custom = (a[1] & 15) === CUSTOM, grouped = (a[1] & 15) === GROUPED;
  if (!meter && !custom && !grouped) throw new Error('meter');
  const bpm = getVar(a, pos), v2 = a[0] === 2;
  if (v2 ? bpm < BPM_MIN || bpm > BPM_MAX : bpm < 20 || bpm > 400) throw new Error('tempo');
  const u = v2 ? getVar(a, pos) : 1;
  if (u < 1 || u > MAX_U) throw new Error('resolution');
  if (custom) {
    if (!v2) throw new Error('meter');
    meter = getVar(a, pos) + '/' + getVar(a, pos);
    if (!parseMeter(meter)) throw new Error('meter');
  }
  if (grouped) {
    const k = v2 ? getVar(a, pos) : 0;
    if (k < 2 || k > 16) throw new Error('meter');
    const parts = []; for (let i = 0; i < k; i++) parts.push(getVar(a, pos));
    meter = parts.join('+') + '/' + getVar(a, pos);
    if (!parseMeter(meter)) throw new Error('meter');
  }
  const M = METERS[meter], barTicks = M.beats * M.tpb * u, limit = MAX_BARS * barTicks;
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
  // version 1: every beat is split one way: sixteenths (or eighths in compound meters), or eighth triplets
  if (!v2 && !fitsV1(M, voices)) throw new Error('unsupported subdivision');
  let title = '';
  if (pos.i < a.length) { try { title = cleanTitle(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(a.slice(pos.i)))); } catch { title = ''; } }
  const r = { meter, bpm, voices, title, hide: !!(a[1] & HIDE), two };
  if (v2) r.u = u;
  return r;
}

// ---------- layout: bars, beats (engraving tokens come from ./engrave.js) ----------

// Version-2 rhythms (u > 1, or tuplets) get their tuplet cells back by quantising the exact note boundaries.
const EXACT_CELLS = { finest: 3, triplets: true, tuplets: true, simplicity: 0 };
export function layout(r) {
  const M = METERS[r.meter], u = r.u || 1, tpb = M.tpb * u, barTicks = M.beats * tpb;
  const all = r.voices.flat();
  const endBar = Math.max(1, Math.ceil(Math.max(...all.map(n => n.end)) / barTicks));
  const grid = new Map();
  let cells;
  if (u > 1 || !fitsV1(M, r.voices)) {
    const pts = [...new Set(all.flatMap(n => [n.start, n.end]))].sort((a, b) => a - b).map(t => t / tpb);
    cells = quantize(pts, M, EXACT_CELLS, 1000).cells;
  } else for (const n of all) for (const t of [n.start, n.end]) { const b = Math.floor(t / tpb), p = t - b * tpb; if (!M.compound && p % 4 === 0 && p % 3 !== 0) grid.set(b, 3); }
  const segsOf = notes => {
    const segs = []; let cur = 0, id = 0;
    for (const n of [...notes].sort((x, y) => x.start - y.start)) {
      if (n.start > cur) segs.push({ start: cur, end: n.start, rest: true });
      segs.push({ start: n.start, end: n.end, rest: false, id: id++ }); cur = n.end;
    }
    if (cur < endBar * barTicks) segs.push({ start: cur, end: endBar * barTicks, rest: true });
    return segs;
  };
  return { M, tpb, barTicks, startBar: 0, endBar, grid, cells, segsOf };
}

// ---------- counting syllables ----------
// info: { beats, tpb, compound } for a standard meter, or { labels, clickTicks } for a click-defined cycle
// (flamenco compás: one label per count). notes: [{start, end}] in ticks from the first barline.
// mode 'count' gives 1 e & a / 1 trip let / 1 la li; mode 'kodaly' gives ta, ti-ti, tika-tika, tri-o-la, syn-co-pa.
export function countSyllable(start, info) {
  if (info.labels) {
    const ct = info.clickTicks, i = Math.floor(start / ct), off = start - i * ct;
    if (!off) return info.labels[i % info.labels.length];
    if (ct === 18) return off === 6 ? 'la' : off === 12 ? 'li' : '&';  // dotted-quarter click: its thirds are eighths, as in 6/8
    return off * 2 === ct ? '&' : off * 4 === ct ? 'e' : off * 4 === 3 * ct ? 'a' : off * 3 === ct ? 'trip' : off * 3 === 2 * ct ? 'let' : '·';
  }
  const b = Math.floor(start / info.tpb), p = start - b * info.tpb, num = String(b % info.beats + 1);
  if (!p) return num;
  if (!Number.isInteger(p) || (p % 3 && (info.compound || p % 4))) return '·';  // inside a 5-, 7-let …
  if (info.compound) return p === 6 ? 'la' : p === 12 ? 'li' : '&';
  return { 3: 'e', 6: '&', 9: 'a', 4: 'trip', 8: 'let' }[p] || '·';
}
const longTa = dur => { const n = Math.floor(dur / 12); return 'ta' + '-a'.repeat(Math.max(0, n - 1)) + (dur % 12 >= 6 ? '-i' : ''); };
export function kodaly(notes, info) {
  const out = notes.map(() => ''), tpb = info.tpb;
  const d = k => notes[k].end - notes[k].start;
  for (let i = 0; i < notes.length; i++) {
    if (out[i]) continue;
    const b = Math.floor(notes[i].start / tpb);
    const grp = []; let j = i;
    while (j < notes.length && Math.floor(notes[j].start / tpb) === b) grp.push(j++);
    const pos = grp.map(k => notes[k].start - b * tpb), key = pos.join(',');
    let syl = null;
    // a beat on a grid these syllables do not cover (5-, 6-, 7-lets …) gets neutral dots
    const odd = pos.some(x => !Number.isInteger(x) || (x % 3 && (info.compound || x % 4))) || (!info.compound && pos.some(x => x % 3) && pos.some(x => x % 4));
    if (odd) { grp.forEach(k => { out[k] = '·'; }); i = j - 1; continue; }
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
export function syllables(notes, info, mode) {
  // custom beat lengths (2/2, 7/8 …) count the beat like a quarter-note beat: rescale to 12 ticks per beat
  if (!info.labels && !info.compound && info.tpb && info.tpb !== 12) {
    const f = 12 / info.tpb;
    notes = notes.map(n => ({ start: n.start * f, end: n.end * f }));
    info = { ...info, tpb: 12 };
  }
  const sorted = [...notes].sort((a, b) => a.start - b.start);
  return mode === 'kodaly' && !info.labels ? kodaly(sorted, info) : sorted.map(n => countSyllable(n.start, info));
}
const lyricEsc = s => s.replace(/-/g, '\\-').replace(/ /g, '~');

// ---------- ABC for a decoded rhythm (the share page and its exercise card) ----------
export function toAbc(r, { count = 'off', perLine = 4, font = 'Geist 9' } = {}) {
  const A = layout(r), M = A.M;
  const head = ['X:1', `M:${r.meter}`, 'L:1/48', `Q:${beatUnit(M).abc}=${Math.round(r.bpm)}`];
  const u = A.tpb / M.tpb, unit = u === 1 ? x => x : notes => notes.map(n => ({ start: n.start / u, end: n.end / u }));
  const systems = [];
  for (let bar = 0; bar < A.endBar; bar += perLine) systems.push([bar, Math.min(A.endBar, bar + perLine)]);
  const barAbc = (bar, segs, letter) => {
    const { measureRest, tokens } = barTokens(A, bar, segs);
    if (measureRest) return { abc: 'Z', tokens };
    return { abc: abcTokens(tokens, letter, A.tpb / M.tpb), tokens };
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
      const sorted = [...r.voices[0]].sort((a, b) => a.start - b.start), sy = syllables(unit(sorted), M, count);
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
export function exercise(r, perLine = 4) {
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
  const sixteenth = A.tpb / 4;  // 3 ticks at the normal resolution
  return { onsets: times.map(t => t / sixteenth), low: times.map(t => !highAt.has(t)), total: A.endBar * A.barTicks / sixteenth, heads, bars: A.endBar };
}
// The click for a standard meter: quarter notes, or dotted quarters in compound meters, accent on the downbeat.
export const clickFor = meter => { const M = METERS[meter]; return { beats: M.beats, upb: M.tpb / 3, accents: [0] }; };

// ---------- exercise strings of the lessons (ABC with L:1/16) ----------
// Returns written tokens with start ticks, so the engine can put syllables under them.
export function parseSrc(src) {
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
export function srcLyrics(src, info, mode) {
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
export function grid(r) {
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
export const describe = (r, T = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => v[k])) => {
  const bars = layout(r).endBar, v = { n: bars, meter: r.meter, bpm: Math.round(r.bpm) };
  return { bars, text: bars === 1 ? T('{n} bar in {meter} at {bpm} BPM', v) : T('{n} bars in {meter} at {bpm} BPM', v) };
};

export { METERS, METER_IDS, barTokens };
export const RhythmCode = { METERS, METER_IDS, MAX_BARS, MAX_TITLE, encode, decode, cleanTitle, layout, barTokens, toAbc, exercise, clickFor,
  syllables, countSyllable, parseSrc, srcLyrics, grid, describe };
export default RhythmCode;
