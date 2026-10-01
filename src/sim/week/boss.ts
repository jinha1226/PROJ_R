import { enemyFromDef } from '../battle/setup';
import type { BattleSetup } from '../battle/types';
import { roomBattleSetup } from '../explore/roomBattle';
import type { Exploration, Room } from '../explore/types';
import { LAST_WEEK, type RunState, type Slot } from '../run/types';

export const BOSS_STAGE = 10;
/** the boss's escorts are weaker than a week-12 room, so the fight is about the knight */
export const ESCORT_STAGE = 8;

/** The week-12 arena: a pillared hall entered from the west. */
export const BOSS_ROOM: Room = {
  id: 'boss', gx: 0, gy: 0, type: 'elite', doors: { w: 'gate' }, done: false,
  props: [{ kind: 'pillar', x: -5, y: -4.5, r: 0.7 }, { kind: 'pillar', x: -5, y: 4.5, r: 0.7 }, { kind: 'pillar', x: 6, y: -4.5, r: 0.7 }, { kind: 'pillar', x: 6, y: 4.5, r: 0.7 }],
  enemies: [{ enemyId: 'ashen_knight', x: 3, y: 0 }, { enemyId: 'skeleton_archer', x: 5.5, y: -2.5 }, { enemyId: 'skeleton_archer', x: 5.5, y: 2.5 }],
};

export function bossExploration(party: string[]): Exploration {
  return {
    seed: 1212, theme: 'dungeon', stars: 1, reward: 'gold', week: LAST_WEEK, rooms: { boss: BOSS_ROOM }, at: 'boss',
    visited: ['boss'], enteredFrom: 'w', loot: { gold: 0, items: [] }, party, rested: false,
  };
}

/** Allies enter the hall from the west gate in their formation; the boss and two archers wait inside. */
export function bossBattleSetup(run: RunState, formation: Record<string, Slot>): BattleSetup {
  const party = Object.keys(formation).filter((id) => run.roster.mercs.some((m) => m.id === id && m.alive));
  const base = roomBattleSetup({ ...run, exploration: bossExploration(party) }, 'boss', formation);
  const enemies = base.enemies.map((u, i) => ({ ...enemyFromDef(BOSS_ROOM.enemies![i]!.enemyId, 2, 0, i === 0 ? BOSS_STAGE : ESCORT_STAGE, i), spawn: u.spawn, facing: u.facing }));
  return { ...base, enemies };
}
