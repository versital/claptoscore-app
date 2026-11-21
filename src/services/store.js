// localStorage wrappers. Every access is guarded: private windows and blocked storage must not break the app.
//
// Keys in use (unchanged from the original site, so existing users keep their settings):
//   tapscore.bpm / .meter / .latency / .micLatency / .opt / .rec / .twoVoices / .free / .micSens / .fold.<detailsId>
//   tapscore.midi            MIDI-in wanted ('1')            (input/midiIn.js)
//   claptoscore.count        counting mode                   (features/counting.js)
//   claptoscore.takes        saved takes                     (features/takes.js)
//   claptoscore.pro          Pro licence                     (services/pro.js)
//   claptoscore.lang         language offer choice           (ui/langOffer.js)

// The app's own settings live under the "tapscore." prefix, JSON encoded.
export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('tapscore.' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('tapscore.' + k, JSON.stringify(v)); } catch {} },
};

// Full-key JSON access for the claptoscore.* keys.
export const rawJson = {
  get(key, fallback = null) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } },
  // returns false when the write failed (e.g. storage full)
  set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; } },
};
