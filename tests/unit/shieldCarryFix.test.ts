import { expect, it } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { KITS } from '../../src/sim/party/classKit';
import { CATALOG } from '../../src/sim/delve/catalog';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { heal } from '../../src/sim/party/kitEffects';
import { useUltimate } from '../../src/sim/party/ultimate';
import { newDelve } from '../../src/sim/delve/delveSim';
import { living } from '../../src/sim/roam/roam';
import { placeParty, takeParty } from '../../src/sim/roam/carry';
it('every shield source shares a cap of thirty', () => {
  const p = partyRoom(), u = p.units[0]!, ev: import('../../src/sim/grid/types').GEvent[] = [];
  const defs = [KITS.cleric.innate[1]!, CATALOG.leather!.triggers[0]!, CATALOG.swordShield!.triggers[0]!, CATALOG.guardOath!.triggers[0]!,
    ...['unyielding', 'unyieldingShield', 'elementVeil'].map(id => TRAITS[id]!.trigger!(3))];
  for (const def of defs) { u.shield = 29; def.run(p, { t: 0, src: u, target: u, depth: 0, ev }); expect(u.shield, def.id).toBe(30); }
  u.cls = 'healer'; u.shield = 29; heal(p, u, u, 100, 0, ev); expect(u.shield).toBe(30);
  for (const cls of ['warrior', 'guardian'] as const) { u.cls = cls; u.ultReady = 0; u.shield = 29; useUltimate(p, u.id); expect(u.shield).toBe(30); }
});
it('carry clears shields when taking and placing the party', () => {
  const p = newDelve(2), u = living(p)[0]!; u.shield = 30;
  const c = takeParty(p); expect(c.clones[0]!.unit.shield).toBe(0);
  c.clones[0]!.unit.shield = 30; const q = newDelve(4); placeParty(q, c); expect(living(q)[0]!.shield).toBe(0);
});
