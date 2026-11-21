# Claptoscore (modular local build)

Tap, clap or play a rhythm and get clean rhythm notation. This is the claptoscore.com main tool, taken from a
saved copy of the page (`original/`) and split from one ~1,350-line inline script into small ES modules, with the
same features and the same output. **Feature log: [FEATURES.md](FEATURES.md).**

> The original code is claptoscore.com's (by Edwin de Jong). This build is for local study and development.
> Get the author's permission before you publish or redistribute it.

## Run
ES modules need a web server (they do not load from `file://`):

```
npm run dev        # python -m http.server 5173, then open http://127.0.0.1:5173/
npm test           # golden tests: the new core vs. the original code
```

The microphone and Web MIDI need a secure context; `localhost`/`127.0.0.1` counts as one.

## Layout
```
index.html            markup only (from the saved page, with extension junk and pre-rendered output removed)
styles/               site.css (shared chrome) · fonts.css · app.css (was the inline <style>) · theme.css · practice.css
vendor/               abcjs (notation engraver, sets window.ABCJS); patched so every tuplet gets a bracket
                      (search `e.hasBeam=!1&&` to find it; redo it when updating abcjs)
original/             the zip as received: kept for reference and used by the golden tests
src/
  main.js             wiring + boot, in the original order
  state.js            S (settings, current take, analysis), rec (recording), calib
  core/               pure logic, no DOM, runs in Node
    meters.js           meters, tick grid, note-value tables
    stats.js            median, fitLine (weighted ridge regression)
    quantize.js         per-beat subdivision choice
    analyze.js          take -> notes, voices, bars (latency, double taps, tempo following, lengths)
    freeTempo.js        tempo + downbeat inference for free-tempo takes
    engrave.js          barTokens: one bar -> written notes/rests/ties/triplets (shared by every writer)
    abc.js              ABC output (+ counting lyrics)
    musicxml.js         MusicXML 4.0 output
    midiFile.js         Standard MIDI File output
    rhythmCode.js       share-link codec, counting syllables, exercise/grid helpers
    takes.js            example take, shared rhythm -> take, analysis -> shareable rhythm
    tuplets.js          tuplet cells, how each is written (p:q), tick-resolution factor u
    practice.js         practice tab: random rhythms by level, scoring a run (accuracy)
    abcText.js          tokens -> ABC text (shared by abc.js and rhythmCode.js)
  audio/              context.js · sounds.js · metronome.js · playback.js · onsetWorklet.js
  input/              taps.js (router) · keyboard.js (keys + pad) · mic.js · midiIn.js · midiToggle.js
  features/           one file per panel/feature: tempo, calibration, recorder, recordOptions, notation (render),
                      chart, cleanup (fine-tune), counting, share, exportMenu, takes, proGate, takeInfo,
                      practice (the Practice tab, #practice)
  services/           i18n.js (T, plural) · store.js (localStorage) · pro.js (licence)
  ui/                 dom.js helpers · beatDots · steps · noteIcons · buddy · helpDialogs · langOffer
tests/golden.test.js  runs the original functions (cut from original/claptoscore.html) side by side with src/core
                      (with the Tuplets option off: the golden options leave it out)
tests/tuplets.test.js tuplet detection, engraving invariants, writers and share-link round trips
tests/practice.test.js practice rhythms (every level and meter) and scoring
```

### Meters
`METERS` holds the seven original meters and parses any other "n/d" (d = 2, 4, 8) on first use (`parseMeter`):
`M.tpb` is then 24 (half-note beat), 6 (eighth-note beat), 3 (sixteenth) or 18 (compound). Additive meters (2+2+3/8) add
`M.groups`; use `groupStarts(M)` / `accentOf(M, beat)`. Use `beatUnit(M)` for the tempo's note
value; never assume a beat is a quarter.

### Ticks and tuplets
An analysis `A` has `A.tpb` ticks per beat: 12 per quarter normally, times a factor `u` when a tuplet (5-let, 7-let,
32nds …) needs a finer grid (`A.tpb / A.M.tpb === u`). Code that works in ticks should use `A.tpb` / `A.barTicks`,
never the literal 12 or 48. With the Tuplets option, `A.cells` maps each covered beat to `{ b0, span, s }`; use
`cellAt(A, beat)` from `core/tuplets.js`, which falls back to `A.grid`.

### Dependency direction
`core` ← `audio` / `services` / `ui` ← `input` / `features` ← `main.js`.
`core/` never touches the DOM or `window`; features talk to each other through plain function imports, and the
one "something changed, redraw" call is `render()` in `features/notation.js`.

## Adding a feature
1. Pure logic (anything you can test without a browser) goes in `src/core/`, with a test in `tests/`.
2. UI goes in a new `src/features/<name>.js` exporting a `bind<Name>()`; call it from `main.js`.
3. To react to every new analysis, use `onRender(A => …)` from `features/notation.js` instead of editing `render()`.
4. New export format: add an entry to `EXPORTERS` in `features/exportMenu.js` and a `<button data-x>` in `index.html`.
5. Persist settings with `store` (`tapscore.*` keys) or `rawJson` (full keys) from `services/store.js`.
6. Log it in [FEATURES.md](FEATURES.md).

Changing anything in `core/` that alters output will fail the golden tests on purpose. When a change is
intended (a new feature, not a refactor), give the new behaviour its own tests and limit the golden comparison
to the cases that should stay the same.
