import { newSurface, type WorldParty } from '../../sim/overworld/worldSim';
import { place } from '../../sim/base/buildings';
import { setPost } from '../../sim/base/posts';
import { raidSize, startRaid } from '../../sim/base/raids';
import { gainXp, LEVEL_XP, pickTrait } from '../../sim/party/partyLevel';
import { implant, living, print } from '../../sim/roam/roam';
import type { BaseClass } from '../../sim/party/partyDefs';
import type { TraitId } from '../../sim/party/traitDefs';

/**
 * A sound first layout: the clones stand in the ring of twelve cells round the pod (the first below it, then above, then to
 * the right), barricades close the rest of the ring, and what is left of the stock shields the second clone, then the third.
 */
export function ringLayout(p: WorldParty): void {
  const b = p.base, ids = living(p).map((u) => u.id);
  const spots = [{ x: b.x, y: b.y + 2 }, { x: b.x, y: b.y - 1 }, { x: b.x + 2, y: b.y }].slice(0, ids.length);
  const shield = [[{ x: b.x - 1, y: b.y - 2 }, { x: b.x, y: b.y - 2 }, { x: b.x + 1, y: b.y - 2 }], [{ x: b.x + 3, y: b.y - 1 }, { x: b.x + 3, y: b.y }, { x: b.x + 3, y: b.y + 1 }]];
  ids.slice(0, spots.length).forEach((id, i) => setPost(p, id, spots[i]!));
  for (let y = b.y - 1; y <= b.y + 2; y++) for (let x = b.x - 1; x <= b.x + 2; x++) if ((x < b.x || x > b.x + 1 || y < b.y || y > b.y + 1) && !spots.some((c) => c.x === x && c.y === y)) place(p, { x, y });
  for (let i = 1; i < spots.length; i++) for (const c of shield[i - 1]!) place(p, c);
}

/**
 * `?demo=raid&n=<raids done>`: a base with three level-8 clones (a warrior, a mage, a cleric; each has taken the first card
 * offered at every level) at their posts in a ring of barricades, and a raid under way — to watch the horde pile up on the
 * plug and fire the ultimates. `n` is how many raids the base has already seen (4 by default): it sets the horde's size and make-up.
 */
export function raidArena(seed: number, raids = 4): WorldParty {
  const p = newSurface(seed);
  p.ore = 100; p.bio = 30; p.crystal = 10;
  const first = p.units.find((u) => u.side === 'hero')!;
  const team: BaseClass[] = ['warrior', 'mage', 'cleric'];
  team.forEach((cls, i) => {
    const u = i === 0 ? first : print(p, undefined, [], p.s.map.start)!;
    implant(p, u, cls, []); u.wentDown = true; gainXp(p, u, LEVEL_XP[7]!, []);
    for (let k = 0; k < 40 && u.picks && u.offer?.length; k++) pickTrait(p, u.id, u.offer[0]! as TraitId);
  });
  p.raidsDone = Math.max(0, raids);
  ringLayout(p);
  p.raidReady = { size: raidSize(p), sides: [0, 2] };
  startRaid(p);
  return p;
}
