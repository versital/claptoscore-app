// MIDI in: a note-on from any connected MIDI input acts as a tap, with the time the browser received it.
// Bluetooth MIDI devices appear here as ordinary inputs once they are paired with the computer or phone,
// so they need nothing extra. The switch lives on the main tool; other pages follow it through wanted().
export const MidiIn = (() => {
  const KEY = 'tapscore.midi';
  let access = null, h = {};
  const supported = () => !!navigator.requestMIDIAccess;
  const wanted = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
  const names = () => access ? [...access.inputs.values()].filter(i => i.state !== 'disconnected').map(i => i.name || (window.T ? T('MIDI device') : 'MIDI device')) : [];
  function message(e) {
    const [status, note, velocity] = e.data, type = status & 0xf0, ch = status & 0x0f, key = 'm' + ch + '.' + note;
    const t = e.timeStamp || performance.now();
    if (type === 0x90 && velocity > 0) {
      // Two voices: on the drum channel the kick is the low voice; on any other channel, notes below middle C.
      const low = ch === 9 ? note === 35 || note === 36 : note < 60;
      if (h.down) h.down(t, { key, low, note, velocity });
    } else if (type === 0x80 || type === 0x90) { if (h.up) h.up(t, key); }
  }
  function attach() {
    for (const i of access.inputs.values()) i.onmidimessage = message;
    if (h.state) h.state(names());
  }
  // handlers: down(time, {key, low, note, velocity}), up(time, key), state(deviceNames)
  async function enable(handlers) {
    if (!supported()) throw new Error('unsupported');
    h = handlers || {};
    access = await navigator.requestMIDIAccess();
    access.onstatechange = attach;
    attach();
    try { localStorage.setItem(KEY, '1'); } catch {}
    return names();
  }
  function disable() {
    if (access) { for (const i of access.inputs.values()) i.onmidimessage = null; access.onstatechange = null; }
    access = null; h = {};
    try { localStorage.removeItem(KEY); } catch {}
  }
  return { supported, wanted, enable, disable, names };
})();
