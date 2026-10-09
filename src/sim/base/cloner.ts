import { dist, type GEvent } from '../grid/types';
import { entOf } from '../party/partyCore';
import { BASE_REACH, BODY_COST, living, print } from '../roam/roam';
import { cloneCap, moduleOn } from './modules';
import type { WorldParty } from '../overworld/worldSim';

/** how near the printer a clone must stand to ask it for a body */
export const CLONER_REACH = 2;

/** Whether the printer can make an empty body now: there is bio-matter for one and a bed free, the lab and the quarters stand, no fight on, nobody away (off the pod's ground: a clone stands by the printer). */
export function canPrintClone(p: WorldParty): boolean {
  const at = p.cloner ?? p.base, reach = p.cloner ? CLONER_REACH : BASE_REACH;
  return p.printHere && !p.away && (!!p.siege || !p.combat) && p.bio >= BODY_COST && living(p).length < cloneCap(p) && moduleOn(p, 'lab') && moduleOn(p, 'quarters')
    // on the pod's ground (base mode) the lab is used from anywhere
    && (!!p.pod || living(p).some((u) => dist(entOf(p, u.id)!.pos, at) <= reach));
}

/** The player asks the printer for a body: an empty clone wakes beside it (a soul goes in by hand). No events when it cannot. */
export function printClone(p: WorldParty): GEvent[] {
  const ev: GEvent[] = [];
  if (!canPrintClone(p)) return ev;
  const u = print(p, undefined, ev, p.cloner ?? p.s.map.start);
  if (u) p.bio -= BODY_COST;
  return ev;
}
