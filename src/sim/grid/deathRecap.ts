import type { GridState } from './types';

/** Resolve the lethal event while this action's foes and events are still available. */
export function recordDeath(s: GridState): void {
  if (s.hero.alive || s.run.killedBy) return;
  const death = s.events.find((e) => e.type === 'die' && e.dst === s.hero.id);
  const foe = s.foes.find((f) => f.id === death?.src);
  if (foe) s.run.killedBy = foe.elite ? { kind: foe.kind, elite: true } : { kind: foe.kind };
  else {
    const src = death?.src;
    const kind = src && ['trap', 'burn', 'poison', 'blast'].includes(src) ? src
      : src === s.hero.id && s.events.some((e) => e.type === 'explode' && e.src === src && e.t === death?.t) ? 'blast' : 'self';
    s.run.killedBy = { kind };
  }
}
