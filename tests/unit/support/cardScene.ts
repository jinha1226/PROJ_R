import { TRAITS } from '../../../src/sim/party/traitDefs';
import { partyRoom } from '../../../src/sim/party/partySim';
import { entOf, type Party, type Unit } from '../../../src/sim/party/partyCore';
import type { BaseClass, ClassId } from '../../../src/sim/party/partyDefs';
import { LINE } from '../../../src/sim/party/classKit';

/** A party room with one hero of `cls` at (4,4) and foes parked far away, ready to be placed by a test. */
export function scene(cls: ClassId = 'warrior'): { p: Party; u: Unit; foes: Unit[] } {
  const p = partyRoom(), u = p.units.find((x) => x.side === 'hero')!;
  const line = cls === 'shell' ? undefined : LINE[cls] ?? (cls as BaseClass);
  u.cls = cls; u.souls = line ? [{ cls: line, ultReady: 0 }] : []; u.traits = {}; u.level = 1;
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
/** `n` different cards that carry `tag`, as a clone's traits (tags count one per card). */
export function cardsOf(tag: string, n: number): Record<string, number> {
  return Object.fromEntries(Object.values(TRAITS).filter((d) => d.tags.includes(tag as never) && d.pool !== 'duo').slice(0, n).map((d) => [d.id, 1]));
}
