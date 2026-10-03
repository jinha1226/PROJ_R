import { dist, idx, type Cell, type GridState } from './types';

/** Sleepers within `r` tiles of a loud noise wake up. */
export function noise(s: GridState, at: Cell, r: number): void {
  for (const f of s.foes) if (f.alive && !f.awake && dist(f.pos, at) <= r) wake(s, f.id);
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
  for (const f of s.foes) {
    if (!f.alive || !s.visible.has(idx(s.map, f.pos)) || dist(f.pos, s.hero.pos) > 8) continue;
    if (!f.awake) for (const g of s.foes) if (g.alive && g.group === f.group) wake(s, g.id);
    f.lastSeen = { ...s.hero.pos };
  }
}
