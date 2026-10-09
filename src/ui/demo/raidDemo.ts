import { newSurface, type WorldParty } from '../../sim/overworld/worldSim';
import { gainXp, LEVEL_XP, pickTrait } from '../../sim/party/partyLevel';
import { implant, print } from '../../sim/roam/roam';
import { SIEGE_MODE } from '../../sim/base/siege';
import type { BaseClass } from '../../sim/party/partyDefs';
import type { TraitId } from '../../sim/party/traitDefs';

/**
 * `?demo=raid&n=<wave>`: the besieged base with three level-8 clones (a warrior, a mage, a cleric; each has taken the first
 * card offered at every level), the siege already at wave `n` (12 by default) — to watch the horde come down on the dome
 * and fire the ultimates.
 */
export function raidArena(seed: number, wave = 12): WorldParty {
  const p = newSurface(seed);
  p.ore = 100; p.crystal = 10;
  const first = p.units.find((u) => u.side === 'hero')!;
  const team: BaseClass[] = ['warrior', 'mage', 'cleric'];
  team.forEach((cls, i) => {
    const u = i === 0 ? first : print(p, undefined, [], p.s.map.start)!;
    implant(p, u, cls, []); u.wentDown = true; gainXp(p, u, LEVEL_XP[7]!, []);
    for (let k = 0; k < 40 && u.picks && u.offer?.length; k++) pickTrait(p, u.id, u.offer[0]! as TraitId);
  });
  const s = p.siege!;
  SIEGE_MODE.on = true;
  s.wave = Math.max(0, wave - 1); s.best = s.wave; s.phase = 'gap'; s.nextAt = p.time + 4;
  return p;
}
