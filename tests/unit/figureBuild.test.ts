import { expect, it } from 'vitest';
import { foeLook } from '../../src/view/grid/species';
import { lookOf } from '../../src/ui/party/partyPick';
import type { UalLook } from '../../src/view/grid/ualActor';

const base: UalLook = { body: '#fff', trim: '#fff', scale: 1, weapon: 'blade', idle: 'Idle_Loop' };

it('goblins stand well under a person; the ogre keeps its height but not its waist', () => {
  expect(foeLook(base, 'minion', 'goblin').scale).toBeLessThan(0.7);
  const ogre = foeLook({ ...base, scale: 1.22 }, 'brute', 'goblin');
  expect(ogre.scale).toBeGreaterThan(1);
  expect(ogre.species).toBe('orc');
  const belly = ogre.shape!.scale.spine_01 as number[];
  expect(belly[0]).toBeGreaterThan(1.2);
});

it('builds and weapons tell the party apart: twin daggers in both hands, casters hold their staff', () => {
  expect(lookOf('rogue', 'daggers').off).toBe('dagger');
  expect(lookOf('mage', 'staff').weapon).toBe('staff');
  expect(lookOf('warrior', 'greataxe').scale).toBeGreaterThan(lookOf('rogue', 'daggers').scale);
});

it('the empty clone is plainly smaller than any soul-bearer', () => {
  expect(lookOf('shell', 'fists').scale).toBeLessThan(lookOf('rogue', 'daggers').scale);
});
