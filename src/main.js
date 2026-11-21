// Entry point: wire every feature to the page, then boot in the same order as the original inline script.
import { S } from './state.js';
import { METERS } from './core/meters.js';
import { exampleTake, takeFromRhythm } from './core/takes.js';
import { RhythmCode } from './core/rhythmCode.js';
import { T } from './services/i18n.js';
import { store } from './services/store.js';
import { Pro } from './services/pro.js';
import { MidiIn } from './input/midiIn.js';
import { noteGroup } from './ui/noteIcons.js';
import { $, $$, toast } from './ui/dom.js';
import { buildDots, startBeatDisplay } from './ui/beatDots.js';
import { mountBuddy } from './ui/buddy.js';
import { bindHelpDialogs } from './ui/helpDialogs.js';
import { offerLanguage } from './ui/langOffer.js';
import { bindKeyboard, bindPad } from './input/keyboard.js';
import { bindMic, setMicHandler } from './input/mic.js';
import { bindMidi } from './input/midiToggle.js';
import { tapDown } from './input/taps.js';
import { bindPlayback } from './audio/playback.js';
import { render } from './features/notation.js';
import { bindChart } from './features/chart.js';
import { bindTempo, subIcon, updateHint, fitBpm } from './features/tempo.js';
import { bindCalibration, showLatency } from './features/calibration.js';
import { bindRecorder } from './features/recorder.js';
import { bindRecordOptions, setVoices, setTiming } from './features/recordOptions.js';
import { bindCleanup, buildFinest, syncControls } from './features/cleanup.js';
import { bindShare } from './features/share.js';
import { bindCountMode } from './features/counting.js';
import { bindExportMenu } from './features/exportMenu.js';
import { bindUpsell } from './features/proGate.js';
import { bindTakes } from './features/takes.js';
import { bindPractice } from './features/practice.js';
import { bindClickVolume } from './features/clickVolume.js';
import { fillMeterSelect, bindMeterSelect } from './features/meterPicker.js';

// The original scripts were globals other site pages relied on; keep them reachable.
Object.assign(window, { Pro, MidiIn, RhythmCode, noteGroup });

// ---------- wiring ----------
bindKeyboard();
bindPad();
bindRecordOptions();
bindTempo();
bindCalibration();
bindRecorder();
setMicHandler(perf => tapDown(perf, { src: 'mic', v: 1 }));
bindMidi();
bindPlayback();
bindExportMenu();
bindUpsell();
bindShare();
bindCountMode(render);
bindTakes();
// blur buttons after click so the space bar stays a tap key
document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); });
bindCleanup();
bindChart(render);
let rT = 0; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(render, 150); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', render);
new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ---------- boot ----------
const sb = store.get('bpm'), sm = store.get('meter'), sl = store.get('latency'), sml = store.get('micLatency'), so = store.get('opt'), sr = store.get('rec');
if (sb) S.bpm = sb;
{ const qs = new URLSearchParams(location.search), qb = +qs.get('bpm'), qm = qs.get('meter');
  if (qb >= 1 && qb <= 9999) S.bpm = Math.round(qb);
  if (qm && METERS[qm]) S.meter = qm; }
if (sm && METERS[sm]) S.meter = sm;  // note: a stored meter wins over ?meter= (original behaviour)
if (typeof sl === 'number') S.latency = sl;
if (typeof sml === 'number') S.micLatency = sml;
if (so) Object.assign(S.opt, so);
bindMic();  // restores the stored mic sensitivity
$('#bpm').value = S.bpm; fitBpm(); fillMeterSelect($('#meter'), S.meter); subIcon();
bindMeterSelect($('#meter')); bindMeterSelect($('#prMeter'));
showLatency(); updateHint(); buildDots(S.meter);
setVoices(!!store.get('twoVoices')); setTiming(!!store.get('free'));
S.rec = sr && sr.taps && sr.taps.length ? sr : exampleTake(S.latency);
// /?r=<code>: "Open in Claptoscore" on a shared rhythm. Loaded once, then the address is cleaned up so a
// reload does not replace the next take with the shared one again.
{ const code = new URLSearchParams(location.search).get('r');
  if (code) {
    try { S.rec = takeFromRhythm(RhythmCode.decode(code)); store.set('rec', S.rec); setTimeout(() => toast(T('shared rhythm opened')), 300); }
    catch { setTimeout(() => toast(T('that rhythm link is broken')), 300); }
    const qs = new URLSearchParams(location.search); qs.delete('r');
    history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash);
  } }
buildFinest(); syncControls();
// remember which "more" sections are open
$$('details.more').forEach(d => {
  const k = 'fold.' + d.id, v = store.get(k);
  if (typeof v === 'boolean') d.open = v;
  d.addEventListener('toggle', () => { store.set(k, d.open); if (d.id === 'more3' && d.open) render(); });
});
startBeatDisplay();
bindPractice();
bindClickVolume();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
render();

// formerly theme.js / lang.js (deferred scripts): the LCD buddy, the ? popups, the language offer bar
mountBuddy();
bindHelpDialogs();
offerLanguage();
