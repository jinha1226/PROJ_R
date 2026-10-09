import { expect, it } from 'vitest';
import { chainArena, arenaOver } from '../../src/ui/delve/chainArena';
import { delveTick } from '../../src/sim/delve/delveSim';
import { clones } from '../../src/sim/roam/roam';
import { alive } from '../../src/sim/party/partyCore';

it('the chain arena: three level-8 clones with their cards against an awake crowd, and the fight runs to an end with chains', () => {
  const p = chainArena(7);
  expect(clones(p).map((u) => u.cls)).toEqual(['warrior', 'mage', 'archer']);
  expect(clones(p).every((u) => (u.level ?? 1) >= 8 && Object.keys(u.traits ?? {}).length >= 6)).toBe(true);
  const foes = p.units.filter((u) => u.side === 'foe' && alive(p, u));
  expect(foes.length).toBeGreaterThanOrEqual(6); expect(foes.every((f) => !f.asleep)).toBe(true);
  let chains = 0;
  for (let i = 0; i < 2000 && !arenaOver(p); i++) chains += delveTick(p, 0.1).filter((e) => e.text === 'chain').length;
  expect(arenaOver(p)).toBe(true); expect(chains).toBeGreaterThan(0);
});

it('resource pop-ups read in Korean', async () => {
  const { lootText } = await import('../../src/view/grid/cueText');
  expect(lootText({ t: 0, type: 'loot', text: 'ore', amount: 3 })).toBe('광석 +3');
  expect(lootText({ t: 0, type: 'loot', text: '화살', amount: 3 })).toBe('+화살 3');
});
