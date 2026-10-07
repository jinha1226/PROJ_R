import { SHIELD_CAP } from '../../src/sim/party/shield';
import { expect, it } from 'vitest';
import { partyRoom } from '../../src/sim/party/partySim';
import { KITS } from '../../src/sim/party/classKit';
import { CATALOG } from '../../src/sim/delve/catalog';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { newDelve } from '../../src/sim/delve/delveSim';
import { living } from '../../src/sim/roam/roam';
import { placeParty, takeParty } from '../../src/sim/roam/carry';
it('every shield source shares one cap', () => {
  const p = partyRoom(), u = p.units[0]!, ev: import('../../src/sim/grid/types').GEvent[] = [];
  const defs = [KITS.cleric.innate.find((d) => d.id === '축복')!, CATALOG.leather!.triggers[0]!, CATALOG.swordShield!.triggers[0]!, CATALOG.guardOath!.triggers[0]!,
    TRAITS.unyielding!.trigger!(2), ...TRAITS.divineShield!.triggers!(2)];
  for (const def of defs) { u.shield = SHIELD_CAP - 1; def.run(p, { t: 0, src: u, target: u, depth: 0, ev }); expect(u.shield, def.id).toBe(SHIELD_CAP); }
});
it('carry clears shields when taking and placing the party', () => {
  const p = newDelve(2), u = living(p)[0]!; u.shield = 30;
  const c = takeParty(p); expect(c.clones[0]!.unit.shield).toBe(0);
  c.clones[0]!.unit.shield = 30; const q = newDelve(4); placeParty(q, c); expect(living(q)[0]!.shield).toBe(0);
});
it('carry shifts every numeric Unit deadline and keeps expired buffs expired', () => {
  const p = newDelve(2), u = living(p)[0]!; p.time = 900;
  Object.assign(u, { damageBuffUntil: 905, immuneUntil: 905, gritReady: 905, hiddenUntil: 905, hasteUntil: 905,
    guardReady: 905, mendReady: 905, slamReady: 905, rollReady: 905, ultReady: 905, nextAt: 905, dotAt: 905, furyUntil: 899 });
  u.trig.test = 905; u.status.burn = { until: 905, next: 901 }; u.ready = [905, 899];
  const q = newDelve(4); placeParty(q, takeParty(p)); const v = living(q)[0]!;
  for (const key of ['damageBuffUntil', 'immuneUntil', 'gritReady', 'hiddenUntil', 'hasteUntil', 'guardReady', 'mendReady', 'slamReady', 'rollReady', 'ultReady', 'nextAt', 'dotAt'] as const)
    expect(v[key], key).toBe(5);
  expect(v.furyUntil).toBe(-1); expect(v.trig.test).toBe(5); expect(v.status.burn).toEqual({ until: 5, next: 1 }); expect(v.ready).toEqual([5, -1]);
});
