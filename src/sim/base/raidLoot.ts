import { entOf } from '../party/partyCore';
import type { WorldParty } from '../overworld/worldSim';

/** what each raider's fall pays (bio-matter comes as from any foe): fodder a little ore, elites more, the general crystal */
const PAY: Record<string, { ore: number; crystal: number }> = { goblin: { ore: 1, crystal: 0 }, brute: { ore: 3, crystal: 0 }, archer: { ore: 3, crystal: 0 }, warlord: { ore: 0, crystal: 6 } };

/** Pays for every raider fallen since last time (spec 2026-10-08 §5): kept whether the raid is won or lost. */
export function payRaidKills(p: WorldParty): void {
  if (!p.raid) return;
  const loot = (p.raidLoot ??= { kills: 0, ore: 0, crystal: 0 });
  for (const u of p.units) {
    if (u.paid || u.side !== 'foe' || u.group !== p.raid.group || entOf(p, u.id)?.alive !== false) continue;
    u.paid = true;
    const pay = PAY[u.foe ?? ''] ?? { ore: 1, crystal: 0 };
    loot.kills++; loot.ore += pay.ore; loot.crystal += pay.crystal;
    p.ore += pay.ore; p.crystal += pay.crystal;
  }
}
