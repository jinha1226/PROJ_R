import { expect, it } from 'vitest';
import { newDelve } from '../../src/sim/delve/delveSim';
import { implant } from '../../src/sim/roam/roam';
import { gainXp, LEVEL_XP } from '../../src/sim/party/partyLevel';
import { unitOf } from '../../src/sim/party/partyCore';
import * as kit from '../../src/sim/party/classKit';
import * as sim from '../../src/sim/party/partySim';
import { CLASSES } from '../../src/sim/party/partyDefs';

it('a clone grows to the top level and stays its class: there are no promotions', () => {
  const p = newDelve(3, 1), u = unitOf(p, 'hero')!;
  implant(p, u, 'warrior', []);
  gainXp(p, u, LEVEL_XP[14]!, []);
  expect(u.level).toBe(15);
  expect(u.cls).toBe('warrior');
  expect('promote' in kit || 'promotionOptions' in kit || 'promote' in sim).toBe(false);
  expect('veteran' in CLASSES).toBe(false);
});
