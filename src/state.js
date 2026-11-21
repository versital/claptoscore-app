// Shared, mutable app state. Modules import these objects and mutate their fields; nothing reassigns them.
import { DEFAULT_OPT } from './core/analyze.js';

// S: user settings + the current take (rec) and its analysis (A).
export const S = {
  bpm: 96, meter: '4/4', latency: 0, micLatency: 0, step: 2, subdiv: false,
  countIn: 1, clickOn: true, autoStop: true, jumpToResult: true, twoVoices: false, free: false, tempoHint: false,
  opt: { ...DEFAULT_OPT },
  rec: null, A: null,
};

// rec: the recording in progress. state: 'idle' | 'countin' | 'rec' | 'free'.
export const rec = { state: 'idle', taps: [], downbeat: null, bpm: 0, meter: '', countBeats: 0, holding: new Map(), free: false, timer: 0 };

// calib: a latency calibration run in progress.
export const calib = { active: false, taps: [], beats: [] };

export const latencies = () => ({ key: S.latency, mic: S.micLatency });
