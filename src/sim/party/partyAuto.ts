import { dist } from '../grid/types';
import { alive, canHit, entOf, posOf, targetOf, type Party, type Unit } from './partyCore';
import { CLASSES, type SkillId } from './partyDefs';

/**
 * A companion reaching for its own skills (the player can still queue one for it): mend the hurt, shield a crowded fight,
 * draw foes off the weak, sweep when surrounded, and spend its attacks when a target is in reach.
 */
export function autoSkill(p: Party, u: Unit): void {
  if (u.queued !== undefined) return;
  const t = p.time, me = posOf(p, u);
  const heroes = p.units.filter((x) => x.side === 'hero' && alive(p, x));
  const foes = p.units.filter((x) => x.side === 'foe' && alive(p, x) && !x.asleep);
  if (!foes.length) return;
  const ratio = (x: Unit) => entOf(p, x.id)!.hp / entOf(p, x.id)!.maxHp;
  const near = (c: { x: number; y: number }, r: number) => foes.filter((f) => dist(posOf(p, f), c) <= r).length;
  const target = targetOf(p, u, t);
  const want = (s: SkillId): boolean => {
    switch (s) {
      case 'heal': return heroes.some((h) => ratio(h) < 0.5);
      case 'ward': return near(me, 3) >= 2 || heroes.some((h) => ratio(h) < 0.6 && dist(posOf(p, h), me) <= 4);
      case 'taunt': return heroes.some((h) => h !== u && near(posOf(p, h), 1) >= 1 && ratio(h) < 0.7) || near(me, 2) >= 2;
      case 'whirl': return near(me, 1) >= 2;
      case 'frenzy': return near(me, 1) >= 1;
      case 'stealth': return near(me, 2) >= 1 && ratio(u) < 0.6;
      case 'fireball': return !!target && canHit(p, u, target) && (near(posOf(p, target), 1) >= 2 || entOf(p, target.id)!.hp > 15);
      case 'backstab': return !!target && dist(posOf(p, target), me) <= 5;
      default: return !!target && canHit(p, u, target);
    }
  };
  const skills = CLASSES[u.cls!].skills;
  for (let k = 0; k < skills.length; k++) if (t >= u.ready[k]! && want(skills[k]!)) { u.queued = k as 0 | 1; return; }
}
