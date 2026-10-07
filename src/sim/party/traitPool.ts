import type { Party, Unit } from './partyCore';
import { TRAITS, rank, type TraitDef } from './traitDefs';
import { tagsOf } from './classKit';
import { hasMemory, linesOf } from './body';

/**
 * The cards on offer at a level-up (C3 spec §2.2). The first pick is a branch: the signatures of the body's lines (three for
 * one line; three of six for two, one of each line at least; a line not yet split into branches gives a law as before).
 * Later: a card of each line (two for one line), one common (two for the scholar), the duos of the lines held, upgrades;
 * a card of a branch already held weighs ×3, of a tag held ×2, and one card of a held branch is guaranteed while any is left.
 * An oath joins as a fourth at levels 10 and 14 until one is held. Fewer when the pools run dry.
 */
export function rollOffer(p: Party, u: Unit): string[] {
  // the empty body is a class of its own: its line is the shell cards
  const tags = tagsOf(u), lines: string[] = linesOf(u).length ? linesOf(u) : u.cls === 'shell' ? ['shell'] : [];
  const available = Object.values(TRAITS).filter((d) => rank(u, d.id) < d.ranks);
  const held = new Set(Object.entries(u.traits ?? {}).flatMap(([id, r]) => (r && TRAITS[id]?.branch ? [TRAITS[id]!.branch!] : [])));
  const weight = (d: TraitDef) => (d.branch && held.has(d.branch) ? 3 : d.tags.some((t) => (tags[t] ?? 0) > 0) ? 2 : 1);
  const draw = (pool: TraitDef[], n: number): string[] => {
    const result: string[] = [];
    while (pool.length && result.length < n) {
      const weights = pool.map(weight), total = weights.reduce((a, b) => a + b, 0);
      let r = p.s.rng.next() * total, index = 0;
      while (index < pool.length - 1 && r >= weights[index]!) r -= weights[index++]!;
      result.push(pool.splice(index, 1)[0]!.id);
    }
    return result;
  };
  const first = (u.level ?? 1) === 2;
  // the first pick chooses a branch
  if (first && !held.size) {
    const sigsOf = (line: string) => available.filter((d) => d.pool === line && d.sig);
    if (lines.some((l) => sigsOf(l).length)) {
      const pick: string[] = [];
      for (const line of lines) pick.push(...(sigsOf(line).length ? draw(sigsOf(line), 1) : draw(available.filter((d) => d.pool === line && d.kind === 'law'), 1)));
      const rest = lines.flatMap((l) => sigsOf(l)).filter((d) => !pick.includes(d.id));
      pick.push(...draw(rest, Math.max(0, 3 - pick.length)));
      return pick;
    }
  }
  const own: string[] = [];
  const ofLine = (line: string) => available.filter((d) => d.pool === line && (!first || d.kind === 'law') && !own.includes(d.id));
  for (const line of lines) own.push(...draw(ofLine(line), 1));
  if (lines.length === 1) own.push(...draw(ofLine(lines[0]!), 1));
  // a branch already held always shows up while it has cards left
  const branchLeft = available.filter((d) => d.branch && held.has(d.branch) && !own.includes(d.id));
  if (held.size && branchLeft.length && !own.some((id) => TRAITS[id]?.branch && held.has(TRAITS[id]!.branch!))) {
    const swap = draw(branchLeft, 1)[0]!;
    if (own.length) own[own.length - 1] = swap; else own.push(swap);
  }
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
