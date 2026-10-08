import { expect, it } from 'vitest';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { raidNote } from '../../src/ui/overworld/raidBar';

it('raid events read as short lines; other events say nothing', () => {
  const p = newSurface(3);
  expect(raidNote({ t: 0, type: 'buff', text: 'raidSoon', amount: 50 }, p)).toBe('다음 귀환 때 습격 · 규모 50');
  expect(raidNote({ t: 0, type: 'buff', text: 'raidWon' }, p)).toBe('습격 격퇴');
  expect(raidNote({ t: 0, type: 'dead', text: 'raidLost' }, p)).toContain('코어 함락');
  expect(raidNote({ t: 0, type: 'hit' }, p)).toBeUndefined();
});

it('the day counts the trips left to the next raid; none while no raid is on its way', async () => {
  const { tripsToRaid, raidCountdown } = await import('../../src/ui/overworld/raidBar');
  const p = newSurface(3);
  expect(tripsToRaid(p)).toBeNull(); expect(raidCountdown(p)).toBe('');
  p.raidClock = 0; expect(tripsToRaid(p)).toBe(2); expect(raidCountdown(p)).toContain('2회');
  p.raidClock = 1; expect(tripsToRaid(p)).toBe(1);
  p.raidReady = { size: 40, sides: [0] }; expect(tripsToRaid(p)).toBe(0); expect(raidCountdown(p)).toBe('');
});
