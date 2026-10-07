import type { Party, Unit } from './partyCore';
import { TRAITS, rank, type TraitDef } from './traitDefs';
import { tagsOf } from './classKit';
import { hasMemory, linesOf } from './body';

/**
 * The cards on offer at a level-up (solo spec §5): a card of each soul's line (two when the body has one soul), one common
 * (two for the scholar's memory), the duos of the lines the body holds and the upgrades of what it holds. Cards with a tag it
 * already has come twice as often. The first level-up offers only laws of the lines. The empty body's line is its own shell cards.
 * An oath joins as a fourth at levels 10 and 14 until one is held. Fewer when the pools run dry.
 */
export function rollOffer(p: Party, u: Unit): string[] {
  // the empty body is a class of its own: its line is the shell cards
  const tags = tagsOf(u), lines: string[] = linesOf(u).length ? linesOf(u) : u.cls === 'shell' ? ['shell'] : [];
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
  const own: string[] = [];
  const ofLine = (line: string) => available.filter((d) => d.pool === line && (!first || d.kind === 'law') && !own.includes(d.id));
  for (const line of lines) own.push(...draw(ofLine(line), 1));
  if (lines.length === 1) own.push(...draw(ofLine(lines[0]!), 1));
  const duos = available.filter((d) => d.pool === 'duo' && d.duo!.every((c) => lines.includes(c)));
  const extra = (hasMemory(u, 'scholar') ? 2 : 1) + (lines.length ? 0 : 2);
  const cards = [...own, ...draw([...available.filter((d) => d.pool === 'common'), ...duos], extra)];
  const due = u.pendingKeystones ?? ([10, 14].includes(u.level ?? 1) ? 1 : 0);
  if (due > 0 && !Object.keys(u.traits ?? {}).some((id) => TRAITS[id]?.pool === 'keystone')) {
    cards.push(...draw(available.filter((d) => d.pool === 'keystone'), 1));
    if (u.pendingKeystones !== undefined) u.pendingKeystones--;
  }
  return cards;
}
