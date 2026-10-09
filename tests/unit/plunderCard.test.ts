import { expect, it } from 'vitest';
import { entOf } from '../../src/sim/party/partyCore';
import { action, emit } from '../../src/sim/party/triggers';
import { TRAITS } from '../../src/sim/party/traitDefs';
import type { GEvent } from '../../src/sim/grid/types';
import { necroScene } from './support/necroScene';

it('the plunderer pays 3 ore for an elite kill and nothing for a common one; no bio-matter anywhere', () => {
  const { p, u, put } = necroScene();
  u.traits = { plunder: 1 };
  expect(TRAITS.plunder!.text).toBe('엘리트 처치 → 광석 +3');
  const common = put(0, 9, 6, 10), elite = put(1, 10, 6, 10);
  entOf(p, elite.id)!.elite = true;
  const ore = p.ore, ev: GEvent[] = [];
  action(p, () => emit(p, 'kill', { t: 0, src: u, target: common, ev }));
  expect(p.ore).toBe(ore);
  action(p, () => emit(p, 'kill', { t: 1, src: u, target: elite, ev }));
  expect(p.ore).toBe(ore + 3); expect('bio' in p).toBe(false);
});
