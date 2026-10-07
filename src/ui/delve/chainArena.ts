import { newDelve, type DelveParty } from '../../sim/delve/delveSim';
import { alive, entOf, type Unit } from '../../sim/party/partyCore';
import { gainXp, LEVEL_XP } from '../../sim/party/partyLevel';
import { clones, implant, print } from '../../sim/roam/roam';
import { dist, idx, walkable, tileAt, type Cell } from '../../sim/grid/types';
import { distanceMap } from '../../sim/grid/path';
import type { BaseClass } from '../../sim/party/partyDefs';

/** The three clones of the chain demo, each with cards that set each other off (fire and lightning mage, marking archer, hit-back warrior). */
const BUILDS: { cls: BaseClass; traits: Record<string, number>; memory: string }[] = [
  { cls: 'warrior', memory: 'frostGrave', traits: { battleCry: 2, thorns: 2, quake: 2, rage: 2, combo: 1, steadfast: 1 } },
  { cls: 'mage', memory: 'burnt', traits: { elemCycle: 2, chainReact: 2, combust: 2, reactAmp: 1, arcChain: 2, overload: 1 } },
  { cls: 'archer', memory: 'lightning', traits: { huntMark: 2, pierce: 2, rapidFire: 2, poisonArrow: 2, cruel: 1, finish: 2 } },
];

/**
 * `?demo=chains`: a floor's first room packed with awake foes and a level-8 party built for chains, left to fight by itself.
 * The foes stand in a tight crowd a few cells off so blasts and leaping lightning have bodies to reach.
 */
export function chainArena(seed: number): DelveParty {
  const p = newDelve(seed, 3);
  const first = clones(p)[0]!;
  implant(p, first, { cls: BUILDS[0]!.cls }, []);
  for (const b of BUILDS.slice(1)) print(p, { cls: b.cls }, []);
  clones(p).forEach((u, i) => dress(p, u, BUILDS[i]!));
  // every foe on the floor gathers in a crowd near the party, awake
  const m = p.s.map, d = distanceMap(m, m.start), taken = new Set(clones(p).map((u) => idx(m, entOf(p, u.id)!.pos)));
  const spots: Cell[] = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = { x, y }, k = idx(m, c), r = d[k]!;
    if (r >= 3 && r <= 7 && walkable(tileAt(m, c)) && !taken.has(k)) spots.push(c);
  }
  const centre = spots.sort((a, b) => d[idx(m, a)]! - d[idx(m, b)]!)[Math.floor(spots.length / 3)] ?? m.start;
  spots.sort((a, b) => dist(a, centre) - dist(b, centre));
  const foes = p.units.filter((u) => u.side === 'foe');
  foes.forEach((f, i) => {
    const e = entOf(p, f.id)!, at = spots[i];
    if (!at || i >= 12) { e.alive = false; return; }
    e.pos = { ...at }; e.hp = e.maxHp = Math.round(e.maxHp * 2.5); f.asleep = false; f.nextAt = 0.5 + 0.1 * i;
  });
  return p;
}

function dress(p: DelveParty, u: Unit, b: (typeof BUILDS)[number]): void {
  u.level = 1; u.xp = 0; gainXp(p, u, LEVEL_XP[7]!, []);
  u.traits = { ...b.traits }; u.picks = 0; u.offer = undefined; u.memory = b.memory;
  const e = entOf(p, u.id)!; e.hp = e.maxHp;
}

/** Whether the fight is over either way (time to stage it again). */
export const arenaOver = (p: DelveParty): boolean =>
  !p.units.some((u) => u.side === 'foe' && alive(p, u)) || !clones(p).some((u) => alive(p, u));
