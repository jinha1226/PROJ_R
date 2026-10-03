import { strike } from './combat';
import { foeDmg, spawnFoe } from './foes';
import { DIRS, FOES, add, same, tileAt, walkable, type Ent, type GridState } from './types';
import { canMelee, stepToward } from './ai';
import { hurt } from './status';

/** The champion: chases and cleaves, marks a whirl around itself every third turn (it lands on the next), calls two minions once at half health. */
export function championTurn(s: GridState, f: Ent, t: number): number {
  f.turns = (f.turns ?? 0) + 1;
  const pending = s.telegraphs.find((x) => x.src === f.id);
  if (pending) {
    s.telegraphs = s.telegraphs.filter((x) => x !== pending);
    s.events.push({ t, type: 'bump', src: f.id, text: 'whirl', from: { ...f.pos }, to: { ...f.pos } });
    if (pending.cells.some((c) => same(c, s.hero.pos))) hurt(s, t, f.id, s.hero, Math.max(1, s.rng.int(pending.dmg[0], pending.dmg[1]) - (s.hero.gear.armor?.reduce ?? 0)), 'whirl');
    return 1;
  }
  if (!f.summoned && f.hp <= f.maxHp / 2) {
    f.summoned = true;
    const free = DIRS.map((d) => add(f.pos, d)).filter((c) => walkable(tileAt(s.map, c)) && !same(c, s.hero.pos) && !s.foes.some((o) => o.alive && same(o.pos, c)));
    for (const c of free.slice(0, 2)) spawnFoe(s, 'minion', c, true);
    s.events.push({ t, type: 'summon', src: f.id, to: { ...f.pos } });
    return 1;
  }
  if (f.turns % 3 === 0) {
    const cells = DIRS.map((d) => add(f.pos, d)).filter((c) => walkable(tileAt(s.map, c)));
    s.telegraphs.push({ cells, center: { ...f.pos }, src: f.id, kind: 'whirl', dmg: foeDmg(f), at: t + 1 });
    s.events.push({ t, type: 'telegraph', src: f.id, to: { ...f.pos }, text: 'whirl' });
    return 1;
  }
  if (canMelee(s, f)) {
    s.events.push({ t, type: 'bump', src: f.id, dst: s.hero.id, from: { ...f.pos }, to: { ...s.hero.pos } });
    strike(s, t, f, s.hero, FOES.champion.hit, foeDmg(f), 1, 'melee');
    return 1;
  }
  return stepToward(s, f, f.lastSeen ?? s.hero.pos, t) ? FOES.champion.move : 1;
}
