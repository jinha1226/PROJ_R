import { afterEach, expect, it } from 'vitest';
import { Playback } from '../../src/view/grid/playback';
import { FEELS, feel, setFeel } from '../../src/view/grid/feel';
import type { GEvent } from '../../src/sim/grid/types';

afterEach(() => setFeel('classic'));
const burst: GEvent[] = [
  { t: 0, type: 'engrave', src: 'hero', text: 'dash' }, { t: 0, type: 'move', src: 'hero', text: 'dash', to: { x: 1, y: 0 } },
  { t: 0, type: 'die', src: 'hero', dst: 'f1' }, { t: 0, type: 'shoot', src: 'hero', dst: 'f2' }, { t: 0, type: 'die', src: 'hero', dst: 'f2' },
];
/** seconds of playback a zero-time burst takes (holds only) */
function length(): number {
  const pb = new Playback();
  pb.push(burst.map(e => ({ ...e })), 0);
  let t = 0;
  while (pb.busy && t < 10) { pb.update(1 / 60); t += 1 / 60; }
  return t;
}
it('the kata feel drops per-engraving slow motion and gives kills and shots their own beat', () => {
  expect(FEELS.classic.engraveSlow).not.toBeNull();
  setFeel('kata');
  expect(feel().engraveSlow).toBeNull();
  expect(feel().chainSlow).toBeNull();
  const kata = length();
  setFeel('classic');
  const classic = length();
  // classic leans on slow motion; its holds alone leave kills and shots unspaced
  expect(kata).toBeGreaterThan(classic);
  expect(kata).toBeGreaterThan(FEELS.kata.dieHold * 2);
});
