import { buffOn } from './buffs';
import { dist, idx, type Cell, type GridState } from './types';

const LOUD = 6;
const SIGHT_WAKE = 0.25;
const SIGHT_SURE = 2;

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

/** After the hero's turn: anyone who can see the hero wakes (and rouses their room), awake foes remember where the hero is. */
export function updateAwareness(s: GridState): void {
  // nobody notices an invisible hero
  if (buffOn(s.hero, 'invis', s.time)) return;
  for (const f of s.foes) {
    if (!f.alive || !s.visible.has(idx(s.map, f.pos)) || dist(f.pos, s.hero.pos) > 8) continue;
    // a sleeper that sees the hero up close wakes; from farther off it may sleep on a while
    if (!f.awake && dist(f.pos, s.hero.pos) > SIGHT_SURE && !s.rng.chance(SIGHT_WAKE)) continue;
    if (!f.awake) for (const g of s.foes) if (g.alive && g.group === f.group) wake(s, g.id);
    f.lastSeen = { ...s.hero.pos };
  }
}
