import { beatUnit, writtenMeter } from './meters.js';
import { barTokens } from './engrave.js';

// MusicXML 4.0 export (Pro). One percussion part; one voice = hand clap, two voices = snare (up) + kick (down).
// written value in 1/48 notes -> MusicXML type and dots (1.5 = a 32nd, only at the finer tuplet resolution)
const XML_TYPE = { 72: ['whole', 1], 48: ['whole', 0], 36: ['half', 1], 24: ['half', 0], 18: ['quarter', 1], 12: ['quarter', 0], 9: ['eighth', 1], 6: ['eighth', 0], 3: ['16th', 0], 1.5: ['32nd', 0] };

// opts.title: work title; opts.date: encoding date (YYYY-MM-DD), defaults to today.
export function toMusicXml(A, { title, date = new Date().toISOString().slice(0, 10) }) {
  const { M, R, barTicks } = A, u = A.tpb / M.tpb;  // u > 1: finer ticks for tuplets (divisions 12u)
  const [num, den] = writtenMeter(R.meter, M).split('/');  // 4/3 is written (and exported) as 4/2
  const unit = beatUnit(M), quarterBpm = R.bpm * unit.quarters;
  const two = A.twoVoice;
  // voice 1: clap (one voice) or snare (two voices) on C5/B4 stems up; voice 2: kick on F4 stems down
  const voices = (two ? [1, 2] : [A.voices[0].v]).map(v => ({
    v, segs: A.voices.find(x => x.v === v)?.segs ?? [{ start: A.startBar * barTicks, end: A.endBar * barTicks, rest: true }],
    step: two ? (v === 2 ? ['F', 4] : ['C', 5]) : ['B', 4], stem: two ? (v === 2 ? 'down' : 'up') : null,
    inst: two ? (v === 2 ? 'P1-I2' : 'P1-I1') : 'P1-I1', tieIn: false,
  }));
  const esc = x => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const noteXml = (t, vo, voiceNo, beam) => {
    const [type, dots] = XML_TYPE[t.notated / u] || ['16th', 0];
    const ties = [vo.tieIn && '<tie type="stop"/>', t.tie && '<tie type="start"/>'].filter(Boolean).join('');
    const tied = [vo.tieIn && '<tied type="stop"/>', t.tie && '<tied type="start"/>'].filter(Boolean).join('');
    const tup = t.trip && t.trip.pos !== 'mid' ? `<tuplet type="${t.trip.pos}" bracket="yes"/>` : '';
    const x = ['<note>',
      t.rest ? '<rest/>' : `<unpitched><display-step>${vo.step[0]}</display-step><display-octave>${vo.step[1]}</display-octave></unpitched>`,
      `<duration>${Math.round(t.dur)}</duration>`, t.rest ? '' : ties, t.rest ? '' : `<instrument id="${vo.inst}"/>`,
      `<voice>${voiceNo}</voice>`, `<type>${type}</type>`, '<dot/>'.repeat(dots),
      t.trip ? `<time-modification><actual-notes>${t.trip.p}</actual-notes><normal-notes>${t.trip.q}</normal-notes></time-modification>` : '',
      !t.rest && vo.stem ? `<stem>${vo.stem}</stem>` : '', beam ? `<beam number="1">${beam}</beam>` : '',
      (tied && !t.rest) || tup ? `<notations>${t.rest ? '' : tied}${tup}</notations>` : '', '</note>'].join('');
    if (!t.rest) vo.tieIn = t.tie;
    return x;
  };
  const beams = tokens => {
    // beam runs of eighth-or-shorter notes that share a beat
    const b = tokens.map(() => null);
    let i = 0;
    while (i < tokens.length) {
      let j = i;
      const ok = t => !t.rest && t.notated <= 9 * u;
      if (ok(tokens[i])) while (j + 1 < tokens.length && ok(tokens[j + 1]) && tokens[j + 1].beat === tokens[i].beat) j++;
      if (j > i) for (let k = i; k <= j; k++) b[k] = k === i ? 'begin' : k === j ? 'end' : 'continue';
      i = j + 1;
    }
    return b;
  };
  const measures = [];
  for (let bar = A.startBar, n = 1; bar < A.endBar; bar++, n++) {
    let m = `<measure number="${n}">`;
    if (n === 1) {
      m += `<attributes><divisions>${12 * u}</divisions><key><fifths>0</fifths></key><time><beats>${num}</beats><beat-type>${den}</beat-type></time><clef><sign>percussion</sign></clef></attributes>`;
      m += `<direction placement="above"><direction-type><metronome><beat-unit>${unit.xml}</beat-unit>${unit.dot ? '<beat-unit-dot/>' : ''}<per-minute>${Math.round(R.bpm)}</per-minute></metronome></direction-type><sound tempo="${+quarterBpm.toFixed(2)}"/></direction>`;
    }
    voices.forEach((vo, k) => {
      if (k) m += `<backup><duration>${barTicks}</duration></backup>`;
      const { measureRest, tokens } = barTokens(A, bar, vo.segs);
      if (measureRest) { m += `<note><rest measure="yes"/><duration>${barTicks}</duration><voice>${k + 1}</voice></note>`; vo.tieIn = false; return; }
      const bm = beams(tokens);
      tokens.forEach((t, i) => { m += noteXml(t, vo, k + 1, bm[i]); });
    });
    if (bar === A.endBar - 1) m += '<barline location="right"><bar-style>light-heavy</bar-style></barline>';
    measures.push(m + '</measure>');
  }
  const insts = two
    ? '<score-instrument id="P1-I1"><instrument-name>Snare</instrument-name></score-instrument><score-instrument id="P1-I2"><instrument-name>Kick</instrument-name></score-instrument><midi-instrument id="P1-I1"><midi-channel>10</midi-channel><midi-unpitched>39</midi-unpitched></midi-instrument><midi-instrument id="P1-I2"><midi-channel>10</midi-channel><midi-unpitched>37</midi-unpitched></midi-instrument>'
    : '<score-instrument id="P1-I1"><instrument-name>Hand clap</instrument-name></score-instrument><midi-instrument id="P1-I1"><midi-channel>10</midi-channel><midi-unpitched>40</midi-unpitched></midi-instrument>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>${esc(title)}</work-title></work><identification><encoding><software>Claptoscore</software><encoding-date>${date}</encoding-date></encoding></identification><part-list><score-part id="P1"><part-name>${two ? 'Drums' : 'Rhythm'}</part-name>${insts}</score-part></part-list><part id="P1">${measures.join('')}</part></score-partwise>`;
}
