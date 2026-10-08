import { entOf } from '../party/partyCore';
import type { WorldParty } from '../overworld/worldSim';

/** what a raider's fall pays (spec 2026-10-09 §2.5: about a quarter of the old raids — the dungeon is where the income is) */
const PAY: Record<string, { ore: number; crystal: number }> = { goblin: { ore: 1, crystal: 0 }, brute: { ore: 1, crystal: 0 }, archer: { ore: 1, crystal: 0 }, warlord: { ore: 0, crystal: 2 } };

/** Pays for every raider fallen since last time: kept whether the raid is won or lost. Most of the fodder (`lean`) pay nothing. */
export function payRaidKills(p: WorldParty): void {
  if (!p.raid) return;
  const loot = (p.raidLoot ??= { kills: 0, ore: 0, crystal: 0 });
  for (const u of p.units) {
    if (u.paid || u.side !== 'foe' || u.group !== p.raid.group || entOf(p, u.id)?.alive !== false) continue;
    u.paid = true; loot.kills++;
    if (u.lean) continue;
    const pay = PAY[u.foe ?? ''] ?? { ore: 1, crystal: 0 };
    loot.ore += pay.ore; loot.crystal += pay.crystal;
    p.ore += pay.ore; p.crystal += pay.crystal;
  }
}
