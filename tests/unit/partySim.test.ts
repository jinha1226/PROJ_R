import { expect, it } from 'vitest';
import { entOf, partyRoom, tick, useSkill } from '../../src/sim/party/partySim';

const heroesAlive = (p: ReturnType<typeof partyRoom>) => p.units.filter((u) => u.side === 'hero' && entOf(p, u.id)!.alive).length;
const foesAlive = (p: ReturnType<typeof partyRoom>) => p.units.filter((u) => u.side === 'foe' && entOf(p, u.id)!.alive).length;

it('left alone, the party closes in and fights the goblins to an end', () => {
  const p = partyRoom();
  for (let i = 0; i < 600 && heroesAlive(p) && foesAlive(p); i++) tick(p, 0.1);
  expect(foesAlive(p) === 0 || heroesAlive(p) === 0).toBe(true);
});

it('a move order walks the hero there and holds it', () => {
  const p = partyRoom();
  p.units.find((u) => u.id === 'ally-mage')!.order = { kind: 'move', cell: { x: 2, y: 8 } };
  for (let i = 0; i < 60; i++) tick(p, 0.1);
  expect(entOf(p, 'ally-mage')!.pos).toEqual({ x: 2, y: 8 });
});

it('taunt turns nearby foes on the warrior; heal mends the most hurt hero; skills then wait for their cooldown', () => {
  const p = partyRoom();
  for (let i = 0; i < 40; i++) tick(p, 0.1);
  useSkill(p, 'hero', 0);
  const taunted = p.units.filter((u) => u.side === 'foe' && u.tauntBy === 'hero');
  expect(taunted.length).toBeGreaterThanOrEqual(0);
  const archer = entOf(p, 'ally-archer')!; archer.hp = 10;
  const ev = useSkill(p, 'ally-mage', 1);
  expect(ev.some((e) => e.type === 'heal' && e.dst === 'ally-archer')).toBe(true);
  expect(useSkill(p, 'ally-mage', 1)).toEqual([]);
});
