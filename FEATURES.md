# Feature log

Every user-facing feature, where it lives, and its status. Update this file whenever a feature is added,
changed or removed.

Status: ✅ shipped & verified · 🟡 shipped, partly verified · ⛔ present but cannot work in this local build · 💡 proposed

**Baseline:** sections 1–3 and App-wide list what the original claptoscore.com page does (snapshot in `original/`).
The refactor (v0.1.0) kept every one of them. With the new **Tuplets** key off, `npm test` checks that the analysis,
ABC, MusicXML, MIDI, free-tempo, example-take and rhythm-code output is byte-for-byte the same as the original code.
Features added in this build are in section 4, and rows marked **new** change an original row.

---

## Current features (v0.1.0, carried over from the original)

### 1 · Tempo panel
| Feature | Module | Status |
|---|---|---|
| Tempo field 30–300 BPM: click to type, Enter sets it, Esc reverts, ↑/↓ steps by 1 (Shift: 10) | `features/tempo.js` | ✅ |
| − / + buttons | `features/tempo.js` | ✅ |
| Tap tempo (TAP button or **T** key): median-filtered, resets after 2.2 s | `features/tempo.js` | ✅ |
| Meters 2/4, 3/4, 4/4, 5/4, 6/8, 9/8, 12/8 | `core/meters.js` | ✅ |
| Preview metronome, accented downbeat, beat dots | `audio/metronome.js`, `ui/beatDots.js` | ✅ |
| Subdivision clicks (eighths, or triplet eighths in compound meters) | `audio/metronome.js` | ✅ |
| Running preview restarts on tempo/meter change (600 ms debounce for typing/tap tempo) | `features/tempo.js` | ✅ |
| Separate latency for keyboard/clicks/MIDI and for the microphone, typed in ms | `features/calibration.js` | ✅ |
| Latency calibration: 4 clicks, tap 12; median offset and spread; picks mic or key by majority | `features/calibration.js` | 🟡 start/cancel checked; full run needs real taps |

### 2 · Rhythm panel (recording)
| Feature | Module | Status |
|---|---|---|
| Inputs: Space/J, F (low voice), click/touch pad, microphone claps, MIDI notes | `input/*` | ✅ keys & pad · 🟡 mic & MIDI need hardware |
| Tap router: calibration › recording › tap tempo › start a take | `input/taps.js` | ✅ |
| With-metronome mode: 1- or 2-bar count-in, big count display, bar.beat display | `features/recorder.js` | ✅ |
| Click while tapping on/off (count-in always clicks) | `features/recorder.js` | ✅ |
| Auto-stop after 2 silent bars; hard limit 64 bars | `features/recorder.js` | 🟡 |
| Free-tempo mode: no click, tempo and barlines inferred afterwards | `core/freeTempo.js` | ✅ |
| Free tempo: optional tempo hint (searches ±25 % around the set BPM) | `core/freeTempo.js` | ✅ (golden test) |
| Free tempo auto-stop after a long pause (≥ 2.5 s or 4× typical gap); 3-minute limit | `features/recorder.js` | 🟡 |
| Two voices: F / left half of pad / MIDI below middle C or kick = low voice | `input/keyboard.js`, `input/midiIn.js` | ✅ |
| Held-key note lengths (key/pointer/MIDI release is recorded) | `features/recorder.js` | ✅ |
| Live provisional notation of the last 2 bars while recording | `features/recorder.js` | ✅ |
| Enter / Esc stops; Esc also cancels calibration | `input/keyboard.js` | ✅ |
| Mic: AudioWorklet onset detector behind two 2.4 kHz high-passes; sensitivity 1–10; level meter | `input/mic.js`, `audio/onsetWorklet.js` | 🟡 needs a mic |
| Mic on → metronome switches to low sine tones the filter rejects | `audio/sounds.js` | ✅ |
| A stray mic noise never starts a count-in (only free-tempo takes start from a clap) | `input/taps.js` | ✅ |
| MIDI in (Web MIDI, incl. paired Bluetooth MIDI), hot-plug device list, remembered on/off | `input/midiIn.js`, `input/midiToggle.js` | 🟡 needs a device |

### 3 · Notation panel
| Feature | Module | Status |
|---|---|---|
| Quantisation: per-beat subdivision balancing timing error vs. simplicity | `core/quantize.js` | ✅ |
| **new** Tuplets and 32nds: see section 4 | `core/quantize.js`, `core/tuplets.js` | ✅ |
| Writes quarters, eighths, sixteenths, dotted values, ties, rests, eighth triplets, compound meters | `core/engrave.js`, `core/abc.js` | ✅ |
| Two voices on a percussion staff (snare up, kick down) | `core/abc.js` | ✅ |
| Engraved with abcjs; auto-shrinks dense bars on narrow screens | `features/notation.js` | ✅ |
| Stats: note count (low/high split with two voices), bar count | `features/notation.js` | ✅ |
| Source tag: Example / Shared: title | `features/notation.js` | ✅ |
| Play score (woodblock/kick over click) and play raw taps | `audio/playback.js` | 🟡 audio not audible in headless check |
| Counting under the notes: Off / 1 e & a / Kodály (one-voice only) | `features/counting.js`, `core/rhythmCode.js` | ✅ |
| **Fine-tune** (instant, on the last take): | `features/cleanup.js` | ✅ |
| · Grid: quarter / eighth / sixteenth, triplets on/off | | ✅ |
| · Simplicity 0–10 | | ✅ |
| · Tempo correction: Off / Steady / Follow drift | `core/analyze.js` | ✅ |
| · Note lengths: until next tap / as held | | ✅ |
| · Longest note: no limit (1 beat with two voices) / 1 beat / 2 beats / 1 bar | | ✅ |
| · Ignore double taps 0–150 ms (per voice) | | ✅ |
| · ½× / 2× tempo; move barlines ◀ ▶ by a beat | | ✅ |
| Timing chart: taps vs click, written positions, colour by error, ms labels | `features/chart.js` | ✅ |
| Click a tap in the chart to ignore / restore it (hover preview with × / +) | `features/chart.js` | 🟡 click path untested |
| ABC source view | `features/notation.js` | ✅ |
| Copy ABC (free) | `features/exportMenu.js` | 🟡 clipboard needs a gesture |
| MusicXML export (Pro) | `core/musicxml.js` | ✅ output (golden) · gate ✅ |
| MIDI file export (Pro) | `core/midiFile.js` | ✅ output (golden) · gate ✅ |
| Print / PDF (Pro) | `features/exportMenu.js` | ✅ gate |
| Share link: rhythm packed in the URL, optional name, "hide the notes" dictation mode, 16-bar cap, Web Share | `features/share.js`, `core/rhythmCode.js` | ✅ |
| **new** Share links point back to this page (`?r=<code>`) instead of claptoscore.com's `/r/` page, so they work wherever the app is hosted (e.g. GitHub Pages) | `features/share.js` | ✅ |
| Open a shared rhythm via `?r=<code>` (exact, ignores clean-up settings), URL cleaned afterwards | `main.js`, `core/takes.js` | ✅ (golden decode) |
| Saved takes (Pro): name, save up to 200, open, two-step delete | `features/takes.js` | ✅ gate · ⛔ cannot unlock locally |

### App-wide
| Feature | Module | Status |
|---|---|---|
| Settings and the last take persist in localStorage (same keys as the live site) | `services/store.js` | ✅ |
| Open/closed state of every "more" section remembered | `main.js` | ✅ |
| `?bpm=` and `?meter=` URL params (a stored meter still wins — original behaviour) | `main.js` | ✅ |
| Example take on first visit | `core/takes.js` | ✅ |
| Light/dark theme follows the OS or `data-theme`; re-renders on change | `main.js`, `styles/` | ✅ |
| Hardware-style theme and the LCD "buddy" that reacts to beats/taps/recording via CSS | `styles/theme.css`, `ui/buddy.js` | ✅ |
| `?` help popups (keys, calibrate, options, fine-tune, share) | `ui/helpDialogs.js` | ✅ |
| Language offer bar for nl/es/fr/pt/zh browsers | `ui/langOffer.js` | ✅ |
| i18n hook: `window.T` dictionary, English as key | `services/i18n.js` | ⛔ dictionaries not in the zip |
| Pro licence: activate / claim / refresh weekly / deactivate | `services/pro.js` | ⛔ needs the `/api` server |
| Print stylesheet (score only) | `styles/app.css` | ✅ |
| Reduced-motion support | `styles/app.css`, `ui/dom.js` | ✅ |

### 4 · Added in this build
| Feature | Module | Status |
|---|---|---|
| **Tuplets key** (Fine-tune, *n*-let icon next to the triplet key; on by default): detects 5-, 6-, 7-, 9-, 10-, 11-, 12- and 13-lets within a beat | `core/quantize.js`, `core/meters.js` | ✅ tests |
| Tuplets over several beats in simple meters: quarter-note triplets (3 over 2 beats), half-note triplets (3 over 4), 5 and 7 over 2 or 4 beats | `core/quantize.js` (DP over beats) | ✅ tests |
| Compound meters (6/8, 9/8, 12/8): duplets, quadruplets, 5-, 7-, 8-, 10-, 11-, 13-lets per dotted quarter (a duplet whose notes fit the plain grid is written as two dotted eighths) | `core/quantize.js`, `core/engrave.js` | ✅ tests |
| Grid: 32nd notes (4th Grid key) | `core/meters.js` `allowedDivs` | ✅ tests |
| False-tuplet guards: a tuplet needs ≥ 60 % of its slots tapped (`MIN_FILL`), must fit at least ~2× better than the best plain reading (`TUPLET_GAIN` 0.45; not for 3-note spans), and each empty slot costs `EMPTY_SLOT_COST` 2.5 × Simplicity/3 | `core/quantize.js` | ✅ |
| Tempo fit with tuplets: fitted on the plain grid first (so drift is not "explained" by tuplets), and also with tuplets from the start; the tuplet-first reading is kept only when it is better by more than Simplicity (it rescues takes made mostly of tuplets). The live provisional score skips the second fit | `core/analyze.js` | ✅ measured (Follow drift): false tuplets 0 % at ≤ 16 ms jitter, 1.7 % at 22 ms, 2.2 % on plain rhythms drifting 1–2 %; found: 5-let 100 %, 6-let 98 %, 7-let 87 %, quarter triplets 100 %, 5 over 2 beats 99 %, 7 over 2 beats 93 %, 6/8 duplets 100 %, 6/8 quadruplets 68–85 %, whole takes of 5/6/7-lets 95 % |
| Tuplet notation: `(p:q:r` brackets in ABC, `<time-modification>` + `<tuplet>` in MusicXML, exact timing in MIDI | `core/engrave.js`, `core/abcText.js`, `core/musicxml.js`, `core/midiFile.js` | ✅ tests · abcjs drawing checked in the browser |
| 10- to 13-lets on screen: abcjs reads one digit per bracket, so the drawn score splits such a group into brackets of ≤ 9 notes whose one-digit ratios add up to exactly the real length (11:8 = 7 notes at 7:5 + 4 at 4:3), then the page writes the real number back and merges the brackets into one. Bars keep their exact length, so two voices stay lined up. The ABC source / Copy ABC keep the exact `(11:8:11` | `core/abcText.js` `drawPlan`, `features/notation.js` `relabelTuplets` | ✅ abcjs parse test (0 warnings, exact bar lengths, 0 px voice drift) · checked in the browser |
| Finer tick grid on demand: 12 ticks per quarter × u, with u the smallest factor that puts every chosen tuplet on whole ticks (u = 1 when no tuplet needs it) | `core/tuplets.js` `scaleFor` | ✅ tests |
| Share links for tuplet rhythms: rhythm-code **version 2** (adds u). Version 1 is written only when it reopens exactly; version-1 links open with the original app's rules (identical results), version-2 links with the tuplet rules plus the notes' end points | `core/rhythmCode.js`, `core/takes.js`, `core/analyze.js` | ✅ 2999/3000 random links reopen with identical notes |
| Long links are cut by bars to stay under 400 notes and the length limit (instead of making a link the page refuses); the share note says how many bars the link holds | `core/takes.js` `rhythmOf`, `features/share.js` | ✅ |
| Fix: a shared two-voice rhythm no longer cuts every note to one beat when it opens (original behaviour) | `core/analyze.js` | ✅ |
| Fix: the 32nd grid also works with the Tuplets key off | `core/meters.js` | ✅ |
| Counting under tuplet notes shows `·` (1 e & a / Kodály have no syllables for 5-, 7-lets …) | `core/rhythmCode.js` | ✅ |
| Timing chart draws each tuplet's slots | `features/chart.js` | ✅ |
| Free-tempo tempo search ignores tuplets (they would fit almost any tempo); the notation afterwards uses them | `core/freeTempo.js` | ✅ golden |

| **Custom keybinds** (v0.5.1): the ? Keys window lists every action (Tap, Low voice, Tap tempo, Stop) with its keys; + then a key press adds one, × removes one, any number per action (also none). A key belongs to one action (adding it elsewhere moves it, with a note). Option: in Practice every letter and digit key taps too. Reset to defaults; remembered; the pad labels and practice hint follow. Keys are stored as physical key codes | `services/keybinds.js`, `features/keybindsUI.js`, `input/keyboard.js` | ✅ browser (real key presses) |
| **Additive meters** (v0.5.0): Custom… also takes groups such as 2+2+3/8, 3+3+2/8, 3+2/4 or 2+3+2+2/16 (up to 32 beats), and /16 meters (7/16 …). The metronome plays a medium accent on each group start, the beat dots leave a gap between groups, notes are beamed by group and never merged across one, practice rhythms are built group by group; the time signature is drawn stacked (3+2+2 over 8). Share links: meter index 14 | `core/meters.js` `groupStarts`, `accentOf`; `core/engrave.js`; `audio/sounds.js` `click` | ✅ `tests/meters.test.js` · browser |
| **Rhythm mix** (v0.4.1, Practice): one slider per kind of rhythm in the level (Rare · Less · Normal · More · Lots = ×0.1 … ×5), so e.g. septuplets in level 8 can be made rare without removing them; remembered; Reset to normal | `core/practice.js` `MIX`, `poolFor({ mix })` | ✅ test (Rare: < ⅓ as many 7-lets, still present) · browser |
| Practice line scrolls by hand while stopped (drag, sideways wheel/trackpad, Shift+wheel); a click that does not move still starts a run, during a run every press is a tap | `features/practice.js` `scrollLine` | ✅ browser |
| Every tuplet gets a bracket, also when one beam covers exactly its notes (abcjs left those with just the number, so 5- and 7-lets looked different from triplets). One-line patch in `vendor/abcjs-basic-min.js` (`e.hasBeam=!1&&…` in the triplet layout) | `vendor/abcjs-basic-min.js` | ✅ browser |
| Setting **Jump to the notation when stopped** (Rhythm options, on by default, remembered): off keeps the page where it is after a take | `features/recorder.js`, `features/recordOptions.js` | ✅ browser |
| **Custom meters** (v0.4.0): "Custom…" in both meter menus takes any n/2, n/4 or n/8 (n up to 32); added meters are remembered in both menus. n/4 and n/2 count quarter and half notes, n/8 with n divisible by 3 (3/8, 15/8) counts dotted quarters like 6/8, other n/8 (5/8, 7/8, 11/8) count eighths. Detection, notation, counting, MusicXML/MIDI tempo, share links (rhythm-code v2, meter index 15 + n, d) and practice rhythms all follow | `core/meters.js` `parseMeter`, `features/meterPicker.js` | ✅ `tests/meters.test.js` · browser |
| **No tempo limits** (v0.4.0): 1–9999 BPM (was 30–300) in both tabs, `?bpm=` and share links (tempos outside 20–400 use rhythm-code v2); 4-digit tempos get a smaller display font | `features/tempo.js`, `core/rhythmCode.js` | ✅ tests · browser |
| Fix (v0.4.0): the Practice beat dots followed the Notate meter (e.g. 2 dots for a 9/8 rhythm when Notate was on 6/8), and opening Practice rebuilt the Notate dots with the Practice meter. Each row now follows its own meter | `ui/beatDots.js` | ✅ browser |
| **Metronome volume** slider (0–150 %, remembered) in the Tempo panel and the Practice tab, kept in sync. All clicks go through their own gain node, so the rhythm sounds keep their level | `features/clickVolume.js`, `audio/context.js` `clickBus` | ✅ browser |
| Listen (v0.3.3) scrolls the line with the sound: count-in dots, the playhead follows the audio clock and each note turns blue as it sounds; Esc stops it | `features/practice.js` `listen` | ✅ browser |
| More tap keys (v0.3.1): Space / J / K for the high voice, F / D for the low voice (with one voice F and D tap too), so fast passages can alternate fingers | `input/keyboard.js` | ✅ browser |

### 5 · Practice tab (v0.3.0)
| Feature | Module | Status |
|---|---|---|
| **Practice** tab in the site nav (`#practice`), next to Notate; same body, keys and paper as the notation tool. Switching tabs stops a recording or a run | `features/practice.js`, `styles/practice.css` | ✅ checked in the browser |
| Random rhythms by level: 1 whole/half/quarter notes · 2 eighths · 3 triplets, dotted quarters, syncopation · 4 sixteenths, ties · 5 dotted eighths, sixteenth rests · 6 sextuplets, quarter and sixteenth triplets · 7 quintuplets · 8 septuplets, broken tuplets. A level mixes in everything below it; its new material weighs as much as all the older material together. Compound meters get their own set (duplets, quadruplets …) | `core/practice.js` `GROUPS`, `generate` | ✅ tests (every level × meter × 15 seeds: whole bars, every note drawn, link round trip) |
| **Custom** level: tick any kinds of rhythm | `core/practice.js` `poolFor` | ✅ tests |
| Tempo (30–300 BPM), meter (all 7), length (2–32 bars, default 8), click on/off; remembered | `features/practice.js` | ✅ |
| One bar of count-in (beat dots), then the music scrolls past a fixed yellow playhead: the head moves to 30 % of the stage, the line scrolls under it, and at the end the head runs to the last barline | `features/practice.js` `place` (time → x from note heads and barlines) | ✅ checked in the browser |
| Notes turn green (within 30 ms), ochre (hit, but off) or red (missed) as you play | `features/practice.js` `liveMark` | ✅ |
| Results: **accuracy %** ring, notes-hit ring, misses, extra taps, average early/late, the whole rhythm in colour, New rhythm / Replay | `core/practice.js` `scoreRun` | ✅ tests |
| Scoring: each note has a window of up to 150 ms (at most 45 % of the gap to its neighbours, so windows never overlap); within 30 ms = full marks, then down to half marks at the window edge; accuracy = points ÷ (notes + extra taps). Latency settings are applied | `core/practice.js` | ✅ tests |
| **Hold** mode: each note's release is scored against its written end too (keys, mouse, touch) | `core/practice.js` `scoreRun({ hold })` | ✅ tests · browser |
| Input: space and every letter and digit key (alternate keys for fast rhythms; each key is held on its own), the stage itself (mouse, touch), microphone and MIDI; Esc or Stop ends a run; Listen plays the rhythm on a woodblock | `input/taps.js` routes taps to the tab that is showing | ✅ |

**Performance:** `fitLine` (Follow drift, the default) runs in plain loops and skips points whose weight
underflows to exactly 0: about 3× faster, with bit-identical results (golden tests). With the Tuplets key the
per-point fits only sum points within 8 window widths (`localFits`, O(n·window)). The page reuses the last analysis
when only the view changed (resize, theme, counting, panels), and slider drags redraw at most once per frame.
64-bar takes in Node (original app → now): ordinary 515 taps 41 → 17 ms; 1024 sixteenths 46 → 20 ms;
mixed tuplets 303 → 98 ms; 2047 32nds 421 → 133 ms; 3236 13-let notes 1427 → 320 ms.

---

## Removed in the local build (not features)
- Browser-extension markup baked into the saved page (Brisk Teaching, Web Highlights, Give Freely).
- Pre-rendered score SVGs from the save (they are redrawn at boot).
- Google AdSense loader (`f.txt`) and its meta tag. `ads.js` and `config.js` were referenced but not in the zip.

## Known gaps (from the zip, not the refactor)
- Other site pages (lessons, rhythms, metronome, guide, pro, `/r/` share page) are not included; nav links still point to claptoscore.com.
- Version-2 share codes (tuplets) can only be opened by this build, not by claptoscore.com.
- Tuplet limits (by design): a person cannot tap a clean 5-let much above ~200 BPM or a 7-let above ~150 BPM within the
  35 ms timing tolerance; in a take of only a few taps the tempo fit has too little to go on and may miss a tuplet;
  with Tempo correction Off, drifting playing can still read as tuplets; free-tempo tempo detection ignores tuplets,
  so a take that is mostly tuplets can get a wrong tempo; two voices in one beat share one division.
- Pro cannot be activated locally (no `/api`), so Pro-gated features only show the upsell.

---

## Planned / proposed features

Nothing here is committed. Add an entry when we decide to build something, then move it to "Current" when it ships.

| # | Idea | Where it would plug in | Status |
|---|---|---|---|
| P1 | More meters (7/8, 5/8, 3/8, 6/4, irregular groupings) | `core/meters.js` (+ rhythm-code version 3, since the meter index is stored in links) | 💡 |
| P2 | Accents / dynamics from tap velocity (MIDI velocity, mic peak) | `analyze` → token `accent` → `abc.js`, `musicxml.js`, `midiFile.js` | 💡 |
| P3 | Swing / shuffle feel detection | `core/quantize.js` | 💡 |
| P4 | Edit the written rhythm directly (click a note to split/merge/rest) | new `features/editor.js`, `onRender` hook | 💡 |
| P5 | Undo / redo for fine-tune and chart edits | new `features/history.js` around `setOpt`, `shiftBars`, chart toggle | 💡 |
| P6 | Practice loop: play a rhythm, tap it back, score each note | `features/notation.js` `onRender` hook + `core/rhythmCode.exercise()` | 💡 |
| P7 | Selectable sound kits for playback and click | `audio/sounds.js` | 💡 |
| P8 | WAV export of the playback | new `audio/render.js` with `OfflineAudioContext` | 💡 |
| P9 | Offline / installable (PWA) | `manifest.json`, service worker | 💡 |
| P10 | Local share page so `/r/<code>` links work offline | new `share.html` using `core/rhythmCode.js` | 💡 |

---

## Change history
| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-11-19 | Split the single inline script into ES modules; same features and output; golden tests added. |
| 0.2.0 | 2026-11-19 | Tuplets (5- to 13-lets, sextuplets, multi-beat and compound tuplets), 32nd grid, rhythm-code v2, share links to `?r=`; `tests/tuplets.test.js`; faster Follow-drift fit, analysis reuse and coalesced slider redraws. |
| 0.2.1 | 2026-11-19 | After an adversarial test round: abcjs-drawable 10–13-lets, false-tuplet guards and plain-first tempo fit, exact share-link round trips (v1 = original rules, v2 with note ends), link size limits, 32nds with Tuplets off, two-voice shared rhythms keep long notes; *n*-let key icon. |
| 0.2.2 | 2026-11-19 | After a second adversarial round: drawn 10–13-lets keep exact bar lengths (split brackets, no voice drift); tuplet-first tempo fit as a second opinion (better on tuplet-heavy takes); windowed local fits (dense takes 3–4× faster); share note shows the real bar count. |
| 0.3.0 | 2026-11-21 | Practice tab: random rhythms by level (1–8 + custom), tempo, meter, length, count-in, scrolling line with a fixed playhead, live note colours, accuracy %; Tap and Hold modes. `tests/practice.test.js`. |
| 0.3.1 | 2026-11-21 | More tap keys: J / K / Space high, F / D low (both tap with one voice); in Practice every letter and digit key taps. Fix: practice runs ended at once (the hidden-tab end timer started before the start time was known). |
| 0.3.2 | 2026-11-21 | Metronome volume slider (Tempo panel and Practice tab). |
| 0.3.3 | 2026-11-21 | Practice: Listen scrolls the music along with the sound and lights each note as it plays. |
| 0.4.0 | 2026-11-21 | Custom meters (n/2, n/4, n/8), no tempo limits (1–9999 BPM), practice beat dots follow the practice meter. `tests/meters.test.js`. |
| 0.4.1 | 2026-11-21 | Rhythm mix sliders in Practice, scroll the practice line while stopped, brackets on every tuplet (abcjs patch), setting to not jump to the notation after a take. |
| 0.5.0 | 2026-11-21 | Additive meters (2+2+3/8 …) with group accents and beaming, /16 meters. |
| 0.5.1 | 2026-11-21 | Custom keybinds in the Keys window: any number of keys for tap, low voice, tap tempo and stop. |
