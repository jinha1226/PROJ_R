import { buffOn } from './buffs';
import { dist, idx, type Cell, type GridState } from './types';

const LOUD = 6;
/** chance a sleeper that sees the hero wakes, by distance: beside 50%, two cells 35%, farther 25% */
const SIGHT_WAKE = [0, 0.5, 0.35, 0.25];

/**
 * A noise of radius r: loud ones (shots, blasts, alarms) wake every sleeper in reach; quiet ones (a step 1, a door 2,
 * a blow 3) wake each with a chance that falls off with distance.
 */
export function noise(s: GridState, at: Cell, r: number, sure = r >= LOUD): void {
  for (const f of s.foes) {
    const d = dist(f.pos, at);
    if (f.alive && !f.awake && d <= r && (sure || s.rng.chance((r + 1 - d) / (r + 2)))) wake(s, f.id);
  }
}

export function wake(s: GridState, id: string): void {
  const f = s.foes.find((x) => x.id === id)!;
  if (f.awake) return;
  f.awake = true;
  f.lastSeen = { ...s.hero.pos };
  s.events.push({ t: s.time, type: 'wake', src: f.id, to: { ...f.pos } });
}

/**
 * Sleepers who see the hero may wake (and rouse their room) — rolled once per action (`roll`); awake foes remember
 * where the hero is.
 */
export function updateAwareness(s: GridState, roll = true): void {
  // nobody notices an invisible hero
  if (buffOn(s.hero, 'invis', s.time)) return;
  for (const f of s.foes) {
    if (!f.alive || !s.visible.has(idx(s.map, f.pos)) || dist(f.pos, s.hero.pos) > 8) continue;
    // a sleeper that sees the hero may sleep on a while (closer is likelier to wake): a careful approach can catch it asleep
    if (!f.awake && (!roll || !s.rng.chance(SIGHT_WAKE[Math.min(3, dist(f.pos, s.hero.pos))]!))) continue;
    if (!f.awake) for (const g of s.foes) if (g.alive && g.group === f.group) wake(s, g.id);
    f.lastSeen = { ...s.hero.pos };
  }
}
