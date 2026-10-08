import { newSurface, type WorldParty } from '../../sim/overworld/worldSim';
import { place, recommendedLayout } from '../../sim/base/buildings';
import { startRaid } from '../../sim/base/raids';
import { gainXp, LEVEL_XP } from '../../sim/party/partyLevel';
import { implant, print } from '../../sim/roam/roam';
import type { BaseClass } from '../../sim/party/partyDefs';

/**
 * `?demo=raid&n=<size>`: a walled base with three level-8 clones (a warrior, a mage, a cleric) and a raid under way, to watch
 * the horde flow in and try the raid's hands (pick, send, drive, ultimates). `n` sets the horde's size (60 by default).
 */
export function raidArena(seed: number, size = 60): WorldParty {
  const p = newSurface(seed);
  p.ore = 400; p.bio = 60; p.crystal = 40;
  for (const s of recommendedLayout(p)) place(p, s.kind, s.at);
  const first = p.units.find((u) => u.side === 'hero')!;
  const team: BaseClass[] = ['warrior', 'mage', 'cleric'];
  team.forEach((cls, i) => {
    const u = i === 0 ? first : print(p, undefined, [], p.s.map.start)!;
    implant(p, u, cls, []); u.level = 1; u.xp = 0; gainXp(p, u, LEVEL_XP[7]!, []); u.picks = 0; u.offer = undefined;
  });
  p.raidsDone = Math.max(0, Math.round((size - 60) / 12));
  startRaid(p);
  return p;
}
