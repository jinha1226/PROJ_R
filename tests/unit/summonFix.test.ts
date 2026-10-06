import { expect, it } from 'vitest';
import { partyRoom, tick } from '../../src/sim/party/partySim';
import { entOf } from '../../src/sim/party/partyCore';
import { summon } from '../../src/sim/party/kitEffects';
import { useUltimate } from '../../src/sim/party/ultimate';
import type { GEvent } from '../../src/sim/grid/types';
it('dead host raises at most three nearby corpses and consumes them', () => {
  const p = partyRoom(), u = p.units[0]!; u.cls = 'necromancer'; u.weapon = 'staff';
  entOf(p, u.id)!.pos = { x: 3, y: 4 };
  const corpse = p.units.find(f => f.side === 'foe')!;
  for (let i = 0; i < 5; i++) {
    const id = `corpse-${i}`; p.units.push({ ...corpse, id });
    p.s.foes.push({ ...entOf(p, corpse.id)!, id, alive: false, pos: { x: i === 4 ? 13 : 4 + i, y: 4 } });
  }
  const first = useUltimate(p, u.id).filter(e => e.type === 'summon'); expect(first).toHaveLength(3);
  u.ultReady = 0;
  expect(useUltimate(p, u.id).filter(e => e.type === 'summon')).toHaveLength(0);
  for (const e of first) { entOf(p, e.dst!)!.alive = false; }
  u.ultReady = 0;
  expect(useUltimate(p, u.id).filter(e => e.type === 'summon')).toHaveLength(1);
  u.ultReady = 0; expect(useUltimate(p, u.id).filter(e => e.type === 'summon')).toHaveLength(0);
});
it('expired summons are removed from both simulation arrays during the tick', () => {
  const p = partyRoom(), u = p.units[0]!, ev: GEvent[] = [];
  summon(p, u, { x: 5, y: 4 }, 0, ev); const id = ev[0]!.dst!;
  for (const v of p.units) v.nextAt = 100;
  tick(p, 11); expect(p.units.some(v => v.id === id)).toBe(false); expect(p.s.foes.some(e => e.id === id)).toBe(false);
});
