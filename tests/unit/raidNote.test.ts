import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { raidNote } from '../../src/ui/overworld/raidBar';

it('raid events read as short lines; other events say nothing', () => {
  const p = newSurface(3);
  expect(raidNote({ t: 0, type: 'buff', text: 'raidSoon', amount: 50 }, p)).toMatch(/^다음 귀환 때 습격 · 규모 50 \/ 방어력 \d+$/);
  expect(raidNote({ t: 0, type: 'buff', text: 'raidWon' }, p)).toBe('습격 격퇴');
  expect(raidNote({ t: 0, type: 'dead', text: 'raidLost' }, p)).toContain('포드 함락');
  expect(raidNote({ t: 0, type: 'hit' }, p)).toBeUndefined();
});
