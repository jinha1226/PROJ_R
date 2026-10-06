import { expect, it } from 'vitest';
import { damage, entOf, unitOf } from '../../src/sim/party/partyCore';
import { nextWave, partyRoom, promote, tick } from '../../src/sim/party/partySim';
import { queueUltimate, useUltimate } from '../../src/sim/party/ultimate';

type P = ReturnType<typeof partyRoom>;
const heroesAlive = (p: P) => p.units.filter((u) => u.side === 'hero' && entOf(p, u.id)!.alive).length;
const foesAlive = (p: P) => p.units.filter((u) => u.side === 'foe' && entOf(p, u.id)!.alive);
const run = (p: P, n: number) => { for (let i = 0; i < n && heroesAlive(p) && foesAlive(p).length; i++) tick(p, 0.1); };

it('left alone, the party closes in and fights the first band to an end', () => {
  const p = partyRoom();
  run(p, 900);
  expect(foesAlive(p).length === 0 || heroesAlive(p) === 0).toBe(true);
});

it('the three picked classes and weapons are the party', () => {
  const p = partyRoom([{ cls: 'cleric', weapon: 'symbol' }, { cls: 'rogue', weapon: 'daggers' }, { cls: 'mage', weapon: 'wand' }]);
  expect(p.units.filter((u) => u.side === 'hero').map((u) => [u.id, u.cls, u.weapon])).toEqual([['hero', 'cleric', 'symbol'], ['ally-1', 'rogue', 'daggers'], ['ally-2', 'mage', 'wand']]);
  expect(entOf(p, 'hero')!.maxHp).toBe(50);
});

it('a move order walks the hero there, then it holds that cell and fights from it', () => {
  const p = partyRoom();
  unitOf(p, 'ally-2')!.order = { kind: 'move', cell: { x: 2, y: 8 } };
  for (let i = 0; i < 60; i++) tick(p, 0.1);
  expect(entOf(p, 'ally-2')!.pos).toEqual({ x: 2, y: 8 });
  expect(unitOf(p, 'ally-2')!.order?.kind).toBe('hold');
  for (let i = 0; i < 100 && entOf(p, 'ally-2')!.alive; i++) tick(p, 0.1);
  if (entOf(p, 'ally-2')!.alive) expect(entOf(p, 'ally-2')!.pos).toEqual({ x: 2, y: 8 });
});

it('a queued ultimate waits for the actor moment', () => {
  const p=partyRoom(); queueUltimate(p,'hero'); expect(unitOf(p,'hero')!.ultQueued).toBe(true);
  tick(p,0.1); expect(unitOf(p,'hero')!.ultReady).toBeGreaterThan(0);
});
it('sanctuary makes incoming blows harmless', () => {
  const p=partyRoom([{cls:'cleric',weapon:'symbol'},{cls:'archer',weapon:'longbow'},{cls:'mage',weapon:'staff'}]);
  useUltimate(p,'hero');const a=unitOf(p,'ally-1')!,hp=entOf(p,a.id)!.hp;
  damage(p,0,'trap',a,10,[]);expect(entOf(p,a.id)!.hp).toBe(hp);
});

it('the shield of a sword-and-board warrior takes a quarter off each blow', () => {
  const p = partyRoom();
  const e = entOf(p, 'hero')!;
  damage(p, 0, foesAlive(p)[0]!.id, unitOf(p, 'hero')!, 8, []);
  expect(e.maxHp - e.hp).toBe(6);
});

it('kill counters cannot unlock a promotion', () => {
  const p=partyRoom(),u=unitOf(p,'hero')!;u.progress=999;u.level=8;
  expect(promote(p,'hero')).toEqual([]);
});

it('the next band comes only once the field is clear, and there are three', () => {
  const p = partyRoom();
  expect(nextWave(p)).toBe(false);
  const clear = () => { for (const f of foesAlive(p)) damage(p, 0, 'x', f, 999, []); };
  clear();
  expect(nextWave(p)).toBe(true);
  expect(foesAlive(p).length).toBe(7);
  clear();
  expect(nextWave(p)).toBe(true);
  clear();
  expect(nextWave(p)).toBe(false);
});

it('a great axe also cuts the foe beside the one it swings at', () => {
  const p = partyRoom([{ cls: 'warrior', weapon: 'greataxe' }, { cls: 'archer', weapon: 'longbow' }, { cls: 'mage', weapon: 'staff' }]);
  const [a, b] = foesAlive(p);
  entOf(p, a!.id)!.pos = { x: 4, y: 4 }; entOf(p, b!.id)!.pos = { x: 4, y: 5 };
  let both = false;
  for (let i = 0; i < 40 && !both; i++) {
    const swing = tick(p, 0.1).filter((e) => e.type === 'hit' && e.src === 'hero');
    both = new Set(swing.map((e) => e.dst)).size >= 2;
  }
  expect(both).toBe(true);
});
