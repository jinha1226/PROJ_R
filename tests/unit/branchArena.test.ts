import { expect, it } from 'vitest';
import { branchArena, branchMenuHtml } from '../../src/ui/delve/branchArena';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { clones } from '../../src/sim/roam/roam';
import { BRANCHES } from '../../src/sim/party/branches';
import { entOf } from '../../src/sim/party/partyCore';
import { delveTick } from '../../src/sim/delve/delveSim';

it('a branch demo body holds every card of the branch at top rank, at level 8, before an awake horde', () => {
  const p = branchArena(7, 'shell:blast'), u = clones(p)[0]!;
  expect(Object.keys(u.traits ?? {}).sort()).toEqual(['blastAmp', 'chainBlast', 'grenade', 'overheat']);
  for (const [id, r] of Object.entries(u.traits!)) expect(r).toBe(TRAITS[id]!.ranks);
  expect(u.level).toBe(8); expect(u.cls).toBe('shell');
  expect(p.units.filter((f) => f.side === 'foe' && !f.asleep).length).toBeGreaterThan(10);
});

it('a line without branches gives its whole line', () => {
  const u = clones(branchArena(7, 'warrior'))[0]!;
  expect(u.cls).toBe('warrior');
  expect(Object.keys(u.traits ?? {}).every((id) => TRAITS[id]!.pool === 'warrior')).toBe(true);
});

it('the menu lists every class with its three branches as links', () => {
  const html = branchMenuHtml();
  for (const b of BRANCHES) expect(html).toContain(`?demo=branch&b=${b.id}`);
  expect(BRANCHES).toHaveLength(21);
  for (const name of ['빈 몸', '전사', '마법사', '궁수', '성직자', '도적', '강령술사']) expect(html).toContain(`<b>${name}</b>`);
});

it.each(BRANCHES.map((b) => b.id))('the %s demo fights on its own: foes fall, nothing throws', (b) => {
  const p = branchArena(7, b), foes = () => p.units.filter((f) => f.side === 'foe' && entOf(p, f.id)?.alive).length, start = foes();
  for (let k = 0; k < 300; k++) delveTick(p, 0.1);
  expect(foes()).toBeLessThan(start);
});
