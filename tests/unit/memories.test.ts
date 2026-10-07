import { expect, it } from 'vitest';
import { newDelve, delveTick } from '../../src/sim/delve/delveSim';
import { newSurface } from '../../src/sim/overworld/worldSim';
import { entOf, damage } from '../../src/sim/party/partyCore';
import { implantCarried, clones } from '../../src/sim/roam/roam';
import { MEMORIES, MEMORY_IDS } from '../../src/sim/party/memories';
import { tagsOf } from '../../src/sim/party/classKit';
import { rollOffer } from '../../src/sim/party/traitPool';

const withSoul = () => {
  const p = newDelve(2);
  const s = p.souls[0]!; entOf(p, 'hero')!.pos = { ...s.pos }; delveTick(p, 0.1);
  return { p, s };
};

it('every soul lying about, below and above, carries a memory', () => {
  expect(newDelve(2).souls.every((s) => !!s.memory)).toBe(true);
  expect(newSurface(3).souls.every((s) => !!s.memory)).toBe(true);
});

it('the memory goes along when the soul is picked up and into the body when implanted, its tag counted', () => {
  const { p, s } = withSoul();
  expect(typeof p.carried[0] === 'object' && p.carried[0].memory).toBe(s.memory);
  implantCarried(p, 'hero', 0);
  const u = clones(p)[0]!; expect(u.souls![0]!.memory).toBe(s.memory); expect(u.cls).toBe(s.cls);
  expect(tagsOf(u)[MEMORIES[s.memory!].tag]).toBeGreaterThanOrEqual(1);
});

it('twelve memories, each with a tag and a line', () => {
  expect(MEMORY_IDS).toHaveLength(12);
  for (const id of MEMORY_IDS) { expect(MEMORIES[id].text.length).toBeGreaterThan(3); expect(MEMORIES[id].tag).toBeDefined(); }
});

it('frost grave: whoever hits the clone is chilled', () => {
  const { p } = withSoul(); implantCarried(p, 'hero', 0);
  const u = clones(p)[0]!; u.souls![0]!.memory = 'frostGrave';
  const f = p.units.find((x) => x.side === 'foe')!; entOf(p, f.id)!.alive = true;
  damage(p, p.time, f.id, u, 3, []);
  expect((f.status.chill?.until ?? 0) > 0).toBe(true);
});

it('scholar: one more card on offer', () => {
  const { p } = withSoul(); implantCarried(p, 'hero', 0);
  const u = clones(p)[0]!; u.level = 4; u.souls![0]!.memory = undefined;
  const plain = rollOffer(p, u).length; u.souls![0]!.memory = 'scholar';
  expect(rollOffer(p, u).length).toBe(plain + 1);
});
