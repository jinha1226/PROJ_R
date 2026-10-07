import { newDelve, type DelveParty } from '../../sim/delve/delveSim';
import { alive, entOf, type Unit } from '../../sim/party/partyCore';
import { gainXp, LEVEL_XP } from '../../sim/party/partyLevel';
import { blank, clones, implant, print } from '../../sim/roam/roam';
import { spawnFoe } from '../../sim/grid/foes';
import { dist, idx, walkable, tileAt, type Cell } from '../../sim/grid/types';
import { distanceMap } from '../../sim/grid/path';
import type { BaseClass } from '../../sim/party/partyDefs';
import type { MemoryId } from '../../sim/party/memories';

/** how many foes the arena packs in, and the health of the weak ones (a blow or two) */
const HORDE = 28;
const FODDER_HP = 10;

/** The three clones of the chain demo, each with cards that set each other off (fire and lightning mage, marking archer, hit-back warrior). */
const BUILDS: { cls: BaseClass; traits: Record<string, number>; memory: MemoryId }[] = [
  { cls: 'warrior', memory: 'frostGrave', traits: { battleCry: 2, thorns: 2, quake: 2, rage: 2, combo: 1, steadfast: 1 } },
  { cls: 'mage', memory: 'burnt', traits: { meteor: 1, fireball: 1, fireSpread: 1, chainLightning: 1, overcurrent: 1, boltAmp: 1 } },
  { cls: 'archer', memory: 'lightning', traits: { huntMark: 2, pierce: 2, rapidFire: 2, poisonArrow: 2, cruel: 1, finish: 2 } },
];

/**
 * `?demo=chains`: a floor's first room packed with awake foes and a level-8 party built for chains, left to fight by itself.
 * The foes stand in a tight crowd a few cells off so blasts and leaping lightning have bodies to reach.
 */
export function chainArena(seed: number): DelveParty {
  const p = newDelve(seed, 3);
  const first = clones(p)[0]!;
  implant(p, first, { cls: BUILDS[0]!.cls, memory: BUILDS[0]!.memory }, []);
  for (const b of BUILDS.slice(1)) print(p, { cls: b.cls, memory: b.memory }, []);
  clones(p).forEach((u, i) => dress(p, u, BUILDS[i]!));
  packHorde(p);
  return p;
}

/** Every foe on the floor gathers awake in a crowd a few cells from the clones: a horde, most of it fodder, a few tough ones. */
export function packHorde(p: DelveParty): void {
  // every foe on the floor gathers in a crowd near the party, awake
  const m = p.s.map, d = distanceMap(m, m.start), taken = new Set(clones(p).map((u) => idx(m, entOf(p, u.id)!.pos)));
  const spots: Cell[] = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = { x, y }, k = idx(m, c), r = d[k]!;
    if (r >= 3 && r <= 9 && walkable(tileAt(m, c)) && !taken.has(k)) spots.push(c);
  }
  const centre = spots.sort((a, b) => d[idx(m, a)]! - d[idx(m, b)]!)[Math.floor(spots.length / 3)] ?? m.start;
  spots.sort((a, b) => dist(a, centre) - dist(b, centre));
  // a horde, survivor style: the floor's foes plus goblins to make up the crowd; nearly all fall to a blow or two, a few hold
  const foes = p.units.filter((u) => u.side === 'foe');
  for (let k = foes.length; k < HORDE && k < spots.length; k++) {
    const e = spawnFoe(p.s, 'minion', spots[k]!, true);
    const f: Unit = { ...blank(), id: e.id, side: 'foe', foe: 'goblin', foeScale: 1, group: 900, nextAt: 0 };
    p.units.push(f); foes.push(f);
  }
  foes.forEach((f, i) => {
    const e = entOf(p, f.id)!, at = spots[i];
    if (!at || i >= HORDE) { e.alive = false; return; }
    const tough = i % 8 === 0;
    e.pos = { ...at }; e.hp = e.maxHp = tough ? Math.round(e.maxHp * 1.5) : FODDER_HP; f.asleep = false; f.nextAt = 0.5 + 0.05 * i;
  });
}

function dress(p: DelveParty, u: Unit, b: (typeof BUILDS)[number]): void {
  u.level = 1; u.xp = 0; gainXp(p, u, LEVEL_XP[7]!, []);
  u.traits = { ...b.traits }; u.picks = 0; u.offer = undefined;
  const e = entOf(p, u.id)!; e.hp = e.maxHp;
}

/** Whether the fight is over either way (time to stage it again). */
export const arenaOver = (p: DelveParty): boolean =>
  !p.units.some((u) => u.side === 'foe' && alive(p, u)) || !clones(p).some((u) => alive(p, u));
