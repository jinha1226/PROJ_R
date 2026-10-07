import { DIRS, dist, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, damage, entOf, levelDmg, occupied, posOf, type Party } from './partyCore';
import { applyStatus } from './status';

/** how far the well reaches, and how many turns it pulls before it collapses */
export const GRAVITY_REACH = 3;
export const GRAVITY_TURNS = 2;
export interface Well { at: Cell; by: string; until: number; next: number }

/** The gravity grenade lands: a well that pulls for two turns, then collapses. */
export function dropWell(p: Party, by: string, at: Cell, t: number): void {
  (p.wells ??= []).push({ at: { ...at }, by, until: t + GRAVITY_TURNS, next: t + 0.5 });
}

/**
 * Every half turn each foe within reach steps to the free floor cell beside it that is nearest the well (nearest foes first,
 * so they pack in without stacking or entering walls); at the end the well collapses: foes within one cell take damage and are stunned.
 */
export function tickWells(p: Party, t: number, ev: GEvent[]): void {
  for (const w of p.wells ?? []) {
    while (w.next <= Math.min(t, w.until)) {
      const foes = p.units.filter((f) => f.side === 'foe' && alive(p, f) && dist(posOf(p, f), w.at) <= GRAVITY_REACH && dist(posOf(p, f), w.at) > 1)
        .sort((a, b) => dist(posOf(p, a), w.at) - dist(posOf(p, b), w.at));
      for (const f of foes) {
        const from = posOf(p, f), far = (c: Cell) => dist(c, w.at) * 10 + Math.hypot(c.x - w.at.x, c.y - w.at.y);
        const step = DIRS.map((d) => ({ x: from.x + d.x, y: from.y + d.y }))
          .filter((c) => walkable(tileAt(p.s.map, c)) && !occupied(p, c, f.id) && far(c) < far(from))
          .sort((a, b) => far(a) - far(b))[0];
        if (!step) continue;
        ev.push({ t: w.next, type: 'move', src: f.id, from: { ...from }, to: { ...step }, text: 'pull' });
        entOf(p, f.id)!.pos = step;
      }
      w.next += 0.5;
    }
    if (t >= w.until) {
      const src = p.units.find((u) => u.id === w.by), dmg = Math.round(14 * (src ? levelDmg(src) : 1));
      ev.push({ t: w.until, type: 'buff', src: w.by, to: { ...w.at }, text: '중력 붕괴' });
      for (const f of p.units.filter((x) => x.side === 'foe' && alive(p, x) && dist(posOf(p, x), w.at) <= 1)) {
        damage(p, w.until, w.by, f, dmg, ev, true);
        if (src && alive(p, f)) applyStatus(p, src, f, 'stun', w.until, ev);
      }
    }
  }
  p.wells = p.wells?.filter((w) => w.until > t);
}
