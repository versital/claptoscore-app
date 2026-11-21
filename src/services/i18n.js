// Interface text: T(english, {name}) looks up the page language's dictionary (/i18n/<lang>.js, which sets
// window.T before the app loads); English is the key, so without a dictionary the English text is used.
const g = globalThis;
export const T = g.T || ((s, v) => v ? s.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m) : s);
export const LANG = g.LANG || 'en';
export const LANG_PREFIX = g.LANG_PREFIX || '';
export const plural = (n, one, many, v) => T(n === 1 ? one : many, { n, ...v });
