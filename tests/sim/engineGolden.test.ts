import { describe, it, expect } from 'vitest';
import { runHeadless } from '../../src/sim/battle/battle';
import { setupFromPresets } from '../../src/sim/battle/setup';
import type { BattleSetup } from '../../src/sim/battle/types';
import { roomBattle } from './support/balanceKit';

/** Characterization: engine extensions must not change any existing battle (arena mode). */
const digest = (setup: BattleSetup): string => {
  const r = runHeadless(setup);
  const units = r.final.units.map((u) => `${u.id}:${u.x.toFixed(3)},${u.y.toFixed(3)},${u.hp.toFixed(2)},${u.alive ? 1 : 0}`).join('|');
  let h = 2166136261;
  for (const c of `${r.outcome}/${r.ticks}/${r.events.length}/${units}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return `${r.outcome}:${r.ticks}:${h.toString(16)}`;
};

const CASES: [string, () => BattleSetup][] = [
  ['standard vs bandits', () => setupFromPresets(7, 'standard', 'bandits')],
  ['elemental vs boss', () => setupFromPresets(3, 'elemental', 'boss')],
  ['bonds vs ambush', () => setupFromPresets(11, 'bonds', 'ambush')],
  ['room battle with props', () => roomBattle(8, 2, 5)],
];

describe('engine golden results', () => {
  for (const [name, make] of CASES) it(name, () => expect(digest(make())).toMatchSnapshot());
});
