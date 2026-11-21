// Pro gating: which features need a licence, and the upsell bar shown when a free user reaches one.
// Gated (unchanged from the original): MusicXML, MIDI, Print/PDF export; saving and opening takes.
import { Pro } from '../services/pro.js';
import { $ } from '../ui/dom.js';

export const isPro = () => !!(Pro && Pro.active());

export function upsell(text) {
  $('#upsellText').textContent = text;
  $('#upsell').hidden = false;
}

export function bindUpsell() {
  $('#upsellClose').addEventListener('click', () => { $('#upsell').hidden = true; });
}
