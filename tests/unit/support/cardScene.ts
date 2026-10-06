import { partyRoom } from '../../../src/sim/party/partySim';
import { entOf, type Party, type Unit } from '../../../src/sim/party/partyCore';
import type { ClassId } from '../../../src/sim/party/partyDefs';

/** A party room with one hero of `cls` at (4,4) and foes parked far away, ready to be placed by a test. */
export function scene(cls: ClassId = 'warrior'): { p: Party; u: Unit; foes: Unit[] } {
  const p = partyRoom(), u = p.units.find((x) => x.side === 'hero')!;
  u.cls = cls; u.traits = {}; u.level = 1;
  for (const h of p.units) if (h.side === 'hero' && h !== u) entOf(p, h.id)!.alive = false;
  entOf(p, u.id)!.pos = { x: 4, y: 4 };
  const foes = p.units.filter((x) => x.side === 'foe');
  foes.forEach((f, i) => { const e = entOf(p, f.id)!; e.pos = { x: 20 + i, y: 1 }; e.hp = e.maxHp = 200; f.nextAt = 999; });
  return { p, u, foes };
}
/** Puts a foe at a cell, awake, with `hp`. */
export function put(p: Party, f: Unit, x: number, y: number, hp = 200): void {
  const e = entOf(p, f.id)!; e.pos = { x, y }; e.hp = e.maxHp = hp; e.alive = true; f.asleep = false;
}
