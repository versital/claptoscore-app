// Keybinds: which keys do what. Each action has its own list of keys (any number, also none); a key belongs to at
// most one action. Keys are stored as KeyboardEvent.code values, so they stay on the same physical key whatever
// the keyboard layout. Edited in the Keys window (features/keybindsUI.js), read by input/keyboard.js.
import { store } from './store.js';

export const ACTIONS = [
  { id: 'high', name: 'Tap', hint: 'the rhythm; the high voice with two voices' },
  { id: 'low', name: 'Low voice', hint: 'with two voices; with one voice these tap too' },
  { id: 'tempo', name: 'Tap tempo', hint: 'Notate tab, when not recording' },
  { id: 'stop', name: 'Stop', hint: 'a recording, a practice run or Listen' },
];
export const DEFAULT_KEYS = { high: ['Space', 'KeyJ', 'KeyK'], low: ['KeyF', 'KeyD'], tempo: ['KeyT'], stop: ['Enter', 'Escape'], anyInPractice: true };

const KEY = 'keybinds';
export const keys = load();
function load() {
  const s = store.get(KEY), k = structuredClone(DEFAULT_KEYS);
  if (s && typeof s === 'object') {
    for (const a of ACTIONS) if (Array.isArray(s[a.id])) k[a.id] = s[a.id].filter(c => typeof c === 'string' && c).slice(0, 40);
    if (typeof s.anyInPractice === 'boolean') k.anyInPractice = s.anyInPractice;
  }
  return k;
}
const save = () => store.set(KEY, keys);
const listeners = [];
export const onKeysChange = fn => listeners.push(fn);
const changed = () => { save(); listeners.forEach(f => f()); };

// The action a key belongs to, or null.
export const actionOf = code => ACTIONS.find(a => keys[a.id].includes(code))?.id ?? null;
// Add a key to an action (taking it away from another action if it had it). Returns the action it came from.
export function bind(action, code) {
  const from = actionOf(code);
  if (from === action) return null;
  if (from) keys[from] = keys[from].filter(c => c !== code);
  keys[action].push(code);
  changed();
  return from;
}
export function unbind(action, code) { keys[action] = keys[action].filter(c => c !== code); changed(); }
export function setAnyInPractice(on) { keys.anyInPractice = on; changed(); }
export function resetKeys() { Object.assign(keys, structuredClone(DEFAULT_KEYS)); changed(); }

// Keys that cannot be bound: modifiers (used for shortcuts) and Tab (moves focus).
export const BINDABLE = code => !!code && !/^(Shift|Control|Alt|Meta|OS)(Left|Right)?$|^(Tab|CapsLock|ContextMenu|Fn|FnLock)$/.test(code);

// A short label for a key code.
const NAMES = { Space: 'Space', Enter: 'Enter', Escape: 'Esc', Backspace: '⌫', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=',
  Backquote: '`', NumpadEnter: 'Num Enter', NumpadAdd: 'Num +', NumpadSubtract: 'Num −', NumpadMultiply: 'Num ×', NumpadDivide: 'Num ÷',
  NumpadDecimal: 'Num .', IntlBackslash: '\\', Delete: 'Del', Insert: 'Ins', PageUp: 'PgUp', PageDown: 'PgDn' };
export function keyName(code) {
  if (NAMES[code]) return NAMES[code];
  let m;
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
  if ((m = /^Digit(\d)$/.exec(code))) return m[1];
  if ((m = /^Numpad(\d)$/.exec(code))) return 'Num ' + m[1];
  return code.replace(/(Left|Right)$/, ' $1');
}
export const keyNames = list => list.map(keyName).join(' / ');
