import type { Cell, GEvent } from '../grid/types';
import { alive, damage, entOf, type Unit } from '../party/partyCore';
import type { WorldParty } from '../overworld/worldSim';
import { clones } from '../roam/roam';
import { domeR, SIEGE_GROUP, type SiegeSpawn } from './siege';
import { worth } from './tree';

/**
 * Shards (spec 2026-10-09 §5): what the horde leaves where it falls, and the base's only coin for its skill tree. A shard
 * lying within a cell of the dome's rim is drawn in by the dome; one farther out is picked up by a clone that comes near —
 * and between waves the clones go out for them. Places are told in cell middles (a cell's own number is its middle).
 */
export interface Drop { id: number; x: number; y: number; n: number }

/** game time per real second at normal speed (the surface's clock) */
const SEC = 3.6;
/** what a raider is worth by its kind on the first wave, how that grows a wave, and a cleared wave's own prize (in fodder) */
export const BOUNTY = { fodder: 1, elite: 6, general: 40, growth: 1.06, clear: 5 };
/** how far from the dome's rim a shard is drawn in, how near a clone must come to pick one up, how far from the dome clones go out for them */
export const ABSORB = 1, PICKUP = 1.5, FETCH_FAR = 14;
/** more shards than this on the ground are heaped together */
export const DROPS_MAX = 250;
/** how far the dome's gun reaches past the dome's rim, and how far a shot leaps on from one foe to the next */
export const GUN_REACH = 5, GUN_LEAP = 3.5;
/** the readings (income, damage) are smoothed over about this long */
const SMOOTH = 10 * SEC;

export const bountyOf = (kind: SiegeSpawn['kind'], wave: number): number => (kind === 'fodder' ? BOUNTY.fodder : kind === 'general' ? BOUNTY.general : BOUNTY.elite) * BOUNTY.growth ** (Math.max(1, wave) - 1);
const centre = (p: WorldParty): { x: number; y: number } => ({ x: p.base.x + 0.5, y: p.base.y + 0.5 });
/** where a unit stands, told in cell middles (the horde's fodder walk between them) */
const at = (p: WorldParty, u: Unit): { x: number; y: number } => (u.sx !== undefined ? { x: u.sx - 0.5, y: u.sy! - 0.5 } : entOf(p, u.id)!.pos);

/** Shards fall on a spot (a heap already lying there grows instead). */
export function dropShards(p: WorldParty, x: number, y: number, n: number): void {
  if (!(n > 0)) return;
  const list = (p.drops ??= []);
  let near: Drop | undefined, best = list.length >= DROPS_MAX ? Infinity : 0.4;
  for (const d of list) { const k = Math.hypot(d.x - x, d.y - y); if (k < best) { best = k; near = d; } }
  if (near) near.n += n; else list.push({ id: (p.nextDrop = (p.nextDrop ?? 0) + 1), x, y, n });
}

/** Shards come in (the readings take note). */
export function gainShards(p: WorldParty, n: number): void {
  p.shards += n;
  if (p.siege) { p.siege.gained = (p.siege.gained ?? 0) + n; p.siege.waveGain = (p.siege.waveGain ?? 0) + n; }
}

/** What lies near the dome's rim is drawn in; what lies near a clone is picked up. */
export function collectShards(p: WorldParty): void {
  if (!p.drops?.length) return;
  const c = centre(p), pull = domeR(p) + ABSORB + worth(p, 'reach'), near = PICKUP + worth(p, 'reach');
  const hands = clones(p).filter((u) => alive(p, u)).map((u) => entOf(p, u.id)!.pos);
  p.drops = p.drops.filter((d) => {
    if (Math.hypot(d.x - c.x, d.y - c.y) > pull && !hands.some((h) => Math.hypot(d.x - h.x, d.y - h.y) <= near)) return true;
    gainShards(p, d.n);
    return false;
  });
}

/** The nearest heap a clone standing at `from` could go out for (not one another clone is already after: `taken` holds their ids). */
export function fetchDrop(p: WorldParty, from: Cell, taken: Set<number>): Drop | undefined {
  const c = centre(p);
  let best: Drop | undefined, bd = Infinity;
  for (const d of p.drops ?? []) {
    if (taken.has(d.id) || Math.hypot(d.x - c.x, d.y - c.y) > FETCH_FAR) continue;
    const k = Math.hypot(d.x - from.x, d.y - from.y);
    if (k < bd) { bd = k; best = d; }
  }
  return best;
}

/** A wave is cleared: its prize, and the pace the base earns at is taken (what came in over the wave and the breath after it). */
export function waveCleared(p: WorldParty, gap: number, ev: GEvent[]): void {
  const s = p.siege!, t = p.time, prize = BOUNTY.clear * BOUNTY.growth ** (Math.max(1, s.wave) - 1) * worth(p, 'bounty');
  gainShards(p, prize);
  const rate = (s.waveGain ?? 0) / Math.max(1, t - (s.waveAt ?? t) + gap);
  s.pace = s.pace ? s.pace * 0.6 + rate * 0.4 : rate;
  s.waveGain = 0;
  ev.push({ t, type: 'buff', text: `waveClear:${s.wave}`, amount: Math.round(prize) });
}

/** The dome's gun (the tree's 포격): every so often a shot at the raider nearest the dome, leaping on to others close by. */
export function gunTick(p: WorldParty, ev: GEvent[]): void {
  const s = p.siege!, t = p.time, dmg = worth(p, 'gun');
  if (!dmg || s.downUntil || t < (s.gunAt ?? 0)) return;
  const c = centre(p), reach = domeR(p) + GUN_REACH;
  const foes = p.units.filter((u) => u.side === 'foe' && u.group === SIEGE_GROUP && alive(p, u)).map((u) => ({ u, at: at(p, u) }));
  let from = { x: c.x, y: c.y }, left = foes.filter((f) => Math.hypot(f.at.x - c.x, f.at.y - c.y) <= reach), far = Infinity;
  if (!left.length) return;
  // (a leap may land on any raider near the last one struck, in the gun's own reach or not — but on none twice)
  const first = left.reduce((a, b) => (Math.hypot(a.at.x - c.x, a.at.y - c.y) <= Math.hypot(b.at.x - c.x, b.at.y - c.y) ? a : b));
  left = [first, ...foes.filter((f) => f !== first)];
  s.gunAt = t + worth(p, 'gunRate');
  for (let shots = 1 + worth(p, 'gunChain'); shots > 0 && left.length; shots--) {
    const next = left.reduce((a, b) => (Math.hypot(a.at.x - from.x, a.at.y - from.y) <= Math.hypot(b.at.x - from.x, b.at.y - from.y) ? a : b));
    if (Math.hypot(next.at.x - from.x, next.at.y - from.y) > far) break;
    ev.push({ t, type: 'buff', text: 'domeShot', from: { ...from }, to: { ...next.at } });
    damage(p, t, 'dome', next.u, Math.max(1, Math.round(dmg)), ev, true);
    // (the first shot goes as far as the gun reaches; each leap, only a little way on)
    from = next.at; far = GUN_LEAP; left = left.filter((f) => f !== next && alive(p, f.u));
  }
}

/** The readings shown on the screen: what comes in and what is dealt, per turn, smoothed. */
export function readings(p: WorldParty, dt: number): void {
  const s = p.siege!, k = 1 - Math.exp(-dt / SMOOTH), tally = (p.tally ??= { dmg: 0 });
  if (!(dt > 0)) return;
  s.income = (s.income ?? 0) + ((s.gained ?? 0) / dt - (s.income ?? 0)) * k;
  s.dps = (s.dps ?? 0) + (tally.dmg / dt - (s.dps ?? 0)) * k;
  s.gained = 0; tally.dmg = 0;
}

/** A clone comes back up: while it was below (`turns` of the floor's own time) the base went on earning a share of its pace — if its siege was running. */
export function awayIncome(p: WorldParty, turns: number, ev: GEvent[]): void {
  const s = p.siege;
  if (!s || !(turns > 0) || !s.pace || (s.phase !== 'gap' && s.phase !== 'wave')) return;
  const n = s.pace * turns * worth(p, 'away');
  p.shards += n;
  if (n >= 1) ev.push({ t: p.time, type: 'buff', text: 'awayShards', amount: Math.floor(n) });
}
