import { createRng } from '../../../src/core/rng';
import { CLASSES } from '../../../src/data/classes';
import { ITEMS, WEAPON_TYPE_OF_CLASS, starterWeapon } from '../../../src/data/items';
import { Battle } from '../../../src/sim/battle/battle';
import type { BattleSetup } from '../../../src/sim/battle/types';
import { generateExploration } from '../../../src/sim/explore/generate';
import { roomBattleSetup } from '../../../src/sim/explore/roomBattle';
import { autoFormation } from '../../../src/sim/roster/formation';
import { generateRecruit } from '../../../src/sim/roster/generate';
import type { Mercenary } from '../../../src/sim/roster/types';
import { newRunV2 } from '../../../src/sim/week/week';
import type { ClassId } from '../../../src/data/types';
import type { RunState, Theme } from '../../../src/sim/run/types';
import { bossBattleSetup } from '../../../src/sim/week/boss';

const PARTY: ClassId[] = ['warrior', 'berserker', 'crossbow', 'mage', 'priest'];

/** The party a player following the recommended pace would have in that week. */
export const levelForWeek = (week: number): number => Math.round(1 + 0.6 * (week - 1));

/** Company size a player realistically has by that week (visitors ~60% of weeks, from week 2). */
export const sizeForWeek = (week: number): number => Math.min(5, 1 + Math.ceil(week / 2));

export function standardParty(week: number, seed: number): Mercenary[] {
  const rng = createRng(seed);
  const used = new Set<string>();
  const level = levelForWeek(week);
  return PARTY.slice(0, sizeForWeek(week)).map((classId, i) => {
    const m = generateRecruit(rng, { level, usedNames: used, classId, id: `m${i}` });
    const better = Object.values(ITEMS).find((it) => it.slot === 'weapon' && it.weaponType === WEAPON_TYPE_OF_CLASS[classId] && it.tier > 0);
    // what a player's purse actually buys (measured with the weekly bot in weekRun.test.ts):
    // cheap vests early, and only the front pair upgraded late
    const front = i < 2;
    const weapon = week >= 8 && front && better ? better.id : starterWeapon(classId);
    const armor = week >= 9 && front ? 'chain_mail' : week >= 3 ? 'padded_vest' : 'ragged_clothes';
    const passives = level >= 7 ? ['toughness', 'sharpEdge'] : level >= 4 ? ['toughness'] : [];
    const lv = level >= 8 ? 3 : level >= 5 ? 2 : 1;
    const skillLevels = Object.fromEntries(CLASSES[classId].actives.map((a) => [a, lv]));
    return { ...m, protagonist: i === 0, gear: { weapon, armor }, passives, skillLevels, traits: [] };
  });
}

function runWith(party: Mercenary[], week: number, seed: number): RunState {
  const r = newRunV2(seed, 'x');
  return { ...r, week, roster: { ...r.roster, mercs: party, relations: [] } };
}

/** A room battle in a fresh exploration of that difficulty (entry-side spawns, room props as cover). */
export function roomBattle(week: number, stars: 1 | 2 | 3, seed: number, theme: Theme = 'dungeon', elite = false): BattleSetup {
  const party = standardParty(week, seed);
  const run0 = runWith(party, week, seed);
  let e = generateExploration(seed, week, { theme, stars, reward: 'gold', rooms: 8 }, party.map((m) => m.id));
  const target = Object.values(e.rooms).find((r) => r.type === (elite ? 'elite' : 'battle'))!;
  const door = Object.keys(target.doors)[0] as 'n';
  e = { ...e, at: target.id, enteredFrom: door };
  const formation = Object.fromEntries(autoFormation(party).map(({ merc, col, row }) => [merc.id, { col, row }]));
  return roomBattleSetup({ ...run0, exploration: e }, target.id, formation);
}

/** Week-12 boss fight with the recommended party — the same setup the game uses. */
export function bossBattle(seed: number): BattleSetup {
  const party = standardParty(12, seed);
  const run = runWith(party, 12, seed);
  const formation = Object.fromEntries(autoFormation(party).map(({ merc, col, row }) => [merc.id, { col, row }]));
  return { ...bossBattleSetup(run, formation), seed };
}

export function winRate(make: (seed: number) => BattleSetup, n: number): { rate: number; avgSec: number } {
  let wins = 0;
  let ticks = 0;
  for (let s = 0; s < n; s++) {
    const b = new Battle(make(s * 7 + 1));
    while (!b.outcome) b.step();
    if (b.outcome === 'victory') wins++;
    ticks += b.state.tick;
  }
  return { rate: wins / n, avgSec: ticks / n / 20 };
}
