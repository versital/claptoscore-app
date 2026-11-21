// Claptoscore Pro licence on this browser. Keeps the key, the Lemon Squeezy instance id and a signed token
// (valid 30 days) in localStorage, and re-checks the licence with the server about once a week.
window.Pro = (() => {
  const KEY = 'claptoscore.pro', WEEK = 7 * 24 * 3600 * 1000;
  const listeners = [];
  let st = null;
  try { st = JSON.parse(localStorage.getItem(KEY)); } catch {}
  const save = () => { try { st ? localStorage.setItem(KEY, JSON.stringify(st)) : localStorage.removeItem(KEY); } catch {} };
  const emit = () => listeners.forEach(f => { try { f(active()); } catch {} });
  const active = () => !!(st && st.token && st.exp * 1000 > Date.now());

  // The server's messages are English; the build adds them to each language's dictionary (api/index.mjs, error: '…').
  const T = window.T || (s => s);
  async function api(path, body, token) {
    const r = await fetch('/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error ? T(j.error) : T('Could not reach the licence server. Try again.')); e.status = r.status; e.revoked = !!j.revoked; throw e; }
    return j;
  }
  async function activate(key) {
    key = String(key || '').trim();
    const j = await api('activate', { key });
    st = { key, instanceId: j.instanceId, token: j.token, exp: j.exp, checkedAt: Date.now() };
    save(); emit();
  }
  // Right after Stripe checkout: exchange the session for a license key, activated on this browser.
  async function claim(sessionId) {
    const j = await api('claim', { sessionId });
    st = { key: j.key, instanceId: j.instanceId, token: j.token, exp: j.exp, checkedAt: Date.now() };
    save(); emit();
    return j.key;
  }
  async function refresh() {
    if (!st) return;
    try {
      const j = await api('refresh', { key: st.key, instanceId: st.instanceId });
      Object.assign(st, { token: j.token, exp: j.exp, checkedAt: Date.now() });
    } catch (e) {
      if (e.revoked) st = null; // refunded or disabled; network errors keep the current token until it expires
    }
    save(); emit();
  }
  async function deactivate() {
    if (st) { try { await api('deactivate', { key: st.key, instanceId: st.instanceId }); } catch {} }
    st = null; save(); emit();
  }
  const lesson = slug => api('lessons/' + encodeURIComponent(slug), null, st && st.token);
  const info = () => st && { key: st.key, short: st.key.replace(/^(.{9}).*(.{4})$/, '$1…$2'), exp: st.exp };
  const onChange = f => { listeners.push(f); };

  if (st && (!st.checkedAt || Date.now() - st.checkedAt > WEEK)) setTimeout(refresh, 1500);
  addEventListener('storage', e => { if (e.key === KEY) { try { st = JSON.parse(e.newValue); } catch { st = null; } emit(); } });
  return { active, activate, claim, deactivate, refresh, lesson, info, onChange };
})();
