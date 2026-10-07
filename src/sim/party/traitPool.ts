import type { Party, Unit } from './partyCore';
import { TRAITS, rank, type TraitDef } from './traitDefs';
import { tagsOf } from './classKit';
import { duoActive, lineOf } from './cardsSupport';
import { alive } from './partyCore';

/**
 * The cards on offer at a level-up (spec §2): two of the clone's own line (an advanced class draws from the class it grew from),
 * one from the commons, the duos its party could open and the upgrades of what it holds. Cards with a tag it already has come
 * twice as often. The first level-up offers only laws of the line; an oath joins as a fourth at levels 10 and 14 until one is
 * held; the scholar's memory adds one more common. Fewer when the pools run dry.
 */
export function rollOffer(p: Party, u: Unit): string[] {
  const tags = tagsOf(u), line = lineOf(u);
  const available = Object.values(TRAITS).filter((d) => rank(u, d.id) < d.ranks);
  const draw = (pool: TraitDef[], n: number): string[] => {
    const result: string[] = [];
    while (pool.length && result.length < n) {
      const weights = pool.map((d) => (d.tags.some((t) => (tags[t] ?? 0) > 0) ? 2 : 1)), total = weights.reduce((a, b) => a + b, 0);
      let r = p.s.rng.next() * total, index = 0;
      while (index < pool.length - 1 && r >= weights[index]!) r -= weights[index++]!;
      result.push(pool.splice(index, 1)[0]!.id);
    }
    return result;
  };
  const first = (u.level ?? 1) === 2;
  const own = available.filter((d) => d.pool === line && (!first || d.kind === 'law'));
  const lines = new Set(p.units.filter((x) => x.side === 'hero' && !x.summoner && alive(p, x)).map(lineOf));
  const duos = available.filter((d) => d.pool === 'duo' && !!line && d.duo!.includes(line) && d.duo!.every((c) => lines.has(c)) && !duoActive(p, d.id));
  const extra = u.memory === 'scholar' ? 2 : 1;
  const cards = [...draw(own, 2), ...draw([...available.filter((d) => d.pool === 'common'), ...duos], extra)];
  const due = u.pendingKeystones ?? ([10, 14].includes(u.level ?? 1) ? 1 : 0);
  if (due > 0 && !Object.keys(u.traits ?? {}).some((id) => TRAITS[id]?.pool === 'keystone')) {
    cards.push(...draw(available.filter((d) => d.pool === 'keystone'), 1));
    if (u.pendingKeystones !== undefined) u.pendingKeystones--;
  }
  return cards;
}
