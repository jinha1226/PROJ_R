import { expect, it } from 'vitest';
import * as THREE from 'three';
import { TUNE, tuneHolder, bodyTune } from '../../src/view/grid/figureTune';
import { lookOf } from '../../src/ui/party/partyPick';
import { BASE_CLASSES, CLASSES, WEAPONS } from '../../src/sim/party/partyDefs';

it('the tune file has an entry for every held look and every class', () => {
  for (const w of Object.values(WEAPONS)) if (w.look !== 'none') expect(TUNE.weapons[w.look], w.look).toBeDefined();
  for (const c of ['shell', ...BASE_CLASSES]) expect(TUNE.classes[c], c).toBeDefined();
});

it('a held thing sits in a holder carrying its tuned offset, turn and size', () => {
  TUNE.weapons.sword = { pos: [0.1, -0.05, 0.02], rot: [90, 0, -45], scale: 1.2 };
  const h = tuneHolder('sword');
  expect(h.position.toArray()).toEqual([0.1, -0.05, 0.02]);
  expect(h.rotation.x).toBeCloseTo(Math.PI / 2); expect(h.rotation.z).toBeCloseTo(-Math.PI / 4);
  expect(h.scale.x).toBeCloseTo(1.2);
  expect(tuneHolder('nothing') instanceof THREE.Group).toBe(true);
  TUNE.weapons.sword = { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 };
});

it('a class’s height and build reach its look', () => {
  TUNE.classes.warrior = { height: 1.1, girth: 1.2 };
  const look = lookOf('warrior', CLASSES.warrior.weapons[0]!);
  expect(look.height).toBeCloseTo(1.1); expect(look.girth).toBeCloseTo(1.2);
  expect(bodyTune('nobody')).toEqual({ height: 1, girth: 1 });
  TUNE.classes.warrior = { height: 1, girth: 1 };
});
