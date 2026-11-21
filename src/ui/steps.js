// Which of the two step panels (1 Tempo, 2 Rhythm) is highlighted.
import { S } from '../state.js';
import { $ } from './dom.js';

export function setStep(n) {
  S.step = n;
  $('#p1').classList.toggle('active', n === 1); $('#p2').classList.toggle('active', n === 2);
}
