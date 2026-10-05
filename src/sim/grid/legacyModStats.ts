import type { ModSlot, ModStat } from './mods';
import type { Hero } from './types';

/** Pre-stone saves kept aggregate mod stats, not fitted IDs. Recover their slot contributions,
 * without granting new perks or altering live stats until that slot is actually replaced. */
export function legacyModStats(stats: NonNullable<Hero['modStats']>): NonNullable<Hero['legacyMods']> {
  const slots: NonNullable<Hero['legacyMods']> = {};
  const put = (slot: ModSlot, stat: ModStat, value: number | undefined) => {
    if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) > 1e-12) (slots[slot] ??= {})[stat] = value;
  };
  put('mag', 'maxCharge', stats.maxCharge);
  put('chest', 'maxHp', stats.maxHp); put('chest', 'shield', stats.shield);
  put('arms', 'meleeDmg', stats.meleeDmg); put('legs', 'evasion', stats.evasion); put('grip', 'swap', stats.swap);
  // Heavy barrel was the only gun-damage mod; its +2 noise could cancel the silencer's -2.
  const heavy = (stats.gunDmg ?? 0) > 0;
  put('barrel', 'gunDmg', stats.gunDmg); put('barrel', 'noise', heavy ? 2 : 0);
  put('back', 'noise', (stats.noise ?? 0) - (heavy ? 2 : 0));
  const hit = stats.hit ?? 0;
  // Old sight bonuses were .05/.12; .10 also tolerates a newer save missing just baseMods.
  const long = !heavy && [0.08, 0.13, 0.18, 0.20].some(n => Math.abs(hit - n) < 1e-9);
  put('barrel', 'hit', long ? 0.08 : 0); put('sight', 'hit', hit - (long ? 0.08 : 0));
  return slots;
}
