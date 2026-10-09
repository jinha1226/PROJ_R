import { spawnFoe } from '../grid/foes';
import { idx, same, tileAt, walkable, type Cell, type GEvent } from '../grid/types';
import { alive, entOf, occupied, posOf, stats, type Unit } from '../party/partyCore';
import { FOES, type FoeId } from '../party/partyDefs';
import { blank, clones } from '../roam/roam';
import { connect } from '../overworld/worldGen';
import type { WorldParty } from '../overworld/worldSim';
import { inDome, resetSiegePath, rimOf } from './siegePath';
import { swarmTick } from './swarm';
import { bountyOf, collectShards, dropShards, fetchDrop, gunTick, readings, waveCleared } from './shards';
import { worth } from './tree';

/**
 * The siege (spec 2026-10-09, "idle defence"): the base stands under an energy dome. The land is quiet until a clone
 * first comes back up the shaft — the drill has been heard. From then the horde comes wave after wave out of the north,
 * each a little stronger than the last: a wave cleared, the next steps out after a short breath. Nothing gets in while
 * the dome holds: the horde hacks at its rim, the clones fight before it (melee) and from inside it (ranged). When the
 * dome gives, an energy wave throws the whole horde back and the siege stops: the same wave waits until the player
 * calls it. Nothing of ours is lost by it: the cost of a breach is the time.
 */
export interface Siege {
  /** the wave now coming (0: none yet), and the highest ever reached */
  wave: number; best: number;
  /** when the next wave steps out */
  nextAt: number;
  domeHp: number;
  /** the dome is down until then (0: it stands) */
  downUntil: number;
  /** the clones fire their own ultimates (the Auto key); off: the player aims them */
  auto: boolean;
  kills: number;
  /** quiet: nothing has come yet; gap: the next wave is counted down; wave: one is out; held: the dome gave, the same wave waits for the player's word */
  phase: 'quiet' | 'gap' | 'wave' | 'held';
  /** when the wave now out stepped out */
  waveAt?: number;
  /** shards come in since the last reading, and over the wave now out; the readings themselves, per turn: what comes in, what is dealt; the pace the base earns at, wave by wave (what it goes on earning while a clone is below) */
  gained?: number; waveGain?: number; income?: number; dps?: number; pace?: number;
  /** when the dome's gun may fire next */
  gunAt?: number;
}
/** one raider waiting to step out at the north edge */
export interface SiegeSpawn { at: number; kind: 'fodder' | 'brute' | 'archer' | 'general'; cell: Cell; wave: number }

/** game time per real second at normal speed (the surface's clock): the numbers below are thought of in seconds */
const SEC = 3.6;
export const SIEGE_GROUP = 1000;
/** the dome: its reach in cells, its strength, what it wins back per turn, how long it stays down after giving */
export const DOME = { r: 5, hp: 200, regen: 3 / SEC, lull: 4 * SEC };
/** a wave pours out over four seconds; the next comes five seconds after it is cleared (time to gather what fell); the first, ten after the first return; a wave called again, three after the word */
export const WAVE_POUR = 4 * SEC, WAVE_GAP = 5 * SEC, FIRST_WAVE = 10 * SEC, RETRY_GAP = 3 * SEC;
/** a wave still out after this long has lost its way (a straggler stuck somewhere out of reach): what is left of it slinks off, and the siege goes on */
export const WAVE_LIMIT = 90 * SEC;
/** how far north of the pod the horde steps out, and how wide its front is */
export const SIEGE_REACH = 18, SIEGE_FRONT = 9;
/** a clone: how low before it falls back into the dome, how well before it goes out again, what it mends inside per turn (of its health), how long down before it rises */
export const FALL_BACK = 0.35, GO_OUT = 0.8, MEND = 0.05 / SEC, REVIVE = 12 * SEC;
/** how far before the dome a melee clone goes for a foe */
export const FRONT_GUARD = 6;

/** the dome's strength and reach, as the base's skill tree has made them */
export const domeMax = (p: WorldParty): number => (p.siege ? Math.round(DOME.hp * worth(p, 'domeHp')) : 0);
export const domeR = (p: WorldParty): number => (p.pod ? DOME.r + worth(p, 'domeSize') : 0);
/** how long a fallen clone lies before it rises (never less than three seconds) */
export const reviveTime = (p: WorldParty): number => Math.max(3 * SEC, REVIVE * worth(p, 'cloneRevive'));
export const domeUp = (p: WorldParty): boolean => !!p.siege && !p.siege.downUntil;

/** What wave n is made of: how many fodder, how tough and how hard-hitting everything in it is. */
export function waveOf(n: number): { fodder: number; hp: number; dmg: number; brutes: number; archers: number; general: boolean } {
  const k = Math.max(1, n);
  return { fodder: Math.min(40, 8 + k), hp: 1.07 ** (k - 1), dmg: 1 + 0.04 * (k - 1), brutes: k % 5 === 0 ? 1 + Math.floor(k / 10) : 0, archers: k >= 8 && k % 5 === 3 ? 1 + Math.floor(k / 12) : 0, general: k % 20 === 0 };
}

/** The pod has landed: the dome lights, and the north is opened for what will come out of it — nothing yet (the land is quiet until a clone first comes back up). */
export function startSiege(p: WorldParty): void {
  p.siege = { wave: 0, best: 0, nextAt: Infinity, domeHp: 0, downUntil: 0, auto: false, kills: 0, phase: 'quiet' };
  p.siege.domeHp = domeMax(p);
  const m = p.s.map, cells = spawnCells(p);
  for (const c of cells) { m.tiles[idx(m, c)] = 'floor'; p.ground[idx(m, c)] = 'dirt'; }
  connect(m, p.ground, cells);
  // the base watches the horde's whole way in: from the front it steps out on down to the dome
  p.watch = [];
  for (let y = Math.max(0, p.base.y - SIEGE_REACH - 1); y <= Math.min(m.h - 1, p.base.y + DOME.r + 3); y++) for (let x = Math.max(0, p.base.x - SIEGE_FRONT - 4); x <= Math.min(m.w - 1, p.base.x + SIEGE_FRONT + 5); x++) p.watch.push(idx(m, { x, y }));
  resetSiegePath(p);
}

/** the cells along the north front where raiders step out */
export function spawnCells(p: WorldParty): Cell[] {
  const m = p.s.map, y = Math.max(1, p.base.y - SIEGE_REACH), out: Cell[] = [];
  for (let dx = -SIEGE_FRONT; dx <= SIEGE_FRONT + 1; dx++) out.push({ x: Math.max(1, Math.min(m.w - 2, p.base.x + dx)), y });
  return out;
}

/** The raiders of wave n, waiting at the front: fodder first, the elites among them, the general last. */
export function planWave(p: WorldParty, n: number, t0: number): SiegeSpawn[] {
  const w = waveOf(n), cells = spawnCells(p), out: SiegeSpawn[] = [];
  const kinds: SiegeSpawn['kind'][] = [...Array<SiegeSpawn['kind']>(w.fodder).fill('fodder'), ...Array<SiegeSpawn['kind']>(w.brutes).fill('brute'), ...Array<SiegeSpawn['kind']>(w.archers).fill('archer'), ...(w.general ? ['general' as const] : [])];
  kinds.forEach((kind, k) => out.push({ at: t0 + (k / kinds.length) * WAVE_POUR, kind, cell: cells[(k * 7 + n * 3) % cells.length]!, wave: n }));
  return out;
}

/** A raider steps out: fodder are swarm units (their own coordinates, no turns); elites and the general fight on the grid. None of them teaches or feeds anyone (`lean`). */
export function spawnRaider(p: WorldParty, s: SiegeSpawn, ev: GEvent[]): void {
  const w = waveOf(s.wave), foe: FoeId = s.kind === 'fodder' ? 'goblin' : s.kind === 'general' ? 'warlord' : s.kind;
  const e = spawnFoe(p.s, s.kind === 'fodder' ? 'minion' : s.kind === 'general' ? 'champion' : s.kind, { ...s.cell }, true);
  e.group = SIEGE_GROUP;
  e.hp = e.maxHp = Math.max(1, Math.round((s.kind === 'fodder' ? FODDER_HP : FOES[foe].hp * 0.6) * w.hp));
  const u: Unit = { ...blank(), id: e.id, side: 'foe', foe, foeScale: w.dmg, asleep: false, alertUntil: Infinity, group: SIEGE_GROUP, nextAt: p.time, raider: true, lean: true, bounty: bountyOf(s.kind, s.wave) };
  if (s.kind === 'fodder') { e.swarm = true; Object.assign(u, { swarm: true, fodder: true, nextAt: Infinity, sx: s.cell.x + 0.5, sy: s.cell.y + 0.5 }); }
  p.units.push(u);
  ev.push({ t: p.time, type: 'summon', dst: e.id, to: { ...s.cell } });
}
export const FODDER_HP = 6;

/** every raider out there (dead or alive) */
export const raiders = (p: WorldParty): Unit[] => p.units.filter((u) => u.side === 'foe' && u.group === SIEGE_GROUP);

/** A blow on the dome. */
export function hitDome(p: WorldParty, n: number, src: string, at: Cell, ev: GEvent[]): void {
  const s = p.siege;
  if (!s || s.downUntil) return;
  s.domeHp = Math.max(0, s.domeHp - n);
  ev.push({ t: p.time, type: 'hit', src, dst: 'dome', to: { x: at.x, y: at.y }, amount: n });
}

/** A clone has come back up the shaft for the first time: the drill was heard, and the first wave is on its way. */
export function rouseSiege(p: WorldParty, ev: GEvent[] = []): void {
  const s = p.siege;
  if (!s || s.phase !== 'quiet') return;
  s.phase = 'gap'; s.nextAt = p.time + FIRST_WAVE;
  ev.push({ t: p.time, type: 'buff', text: 'siegeStart' });
}

/** The player's word after a breach: the dome is whole again and the wave it gave to comes once more. */
export function resumeSiege(p: WorldParty, ev: GEvent[] = []): boolean {
  const s = p.siege;
  if (!s || s.phase !== 'held') return false;
  if (s.downUntil) ev.push({ t: p.time, type: 'buff', text: 'domeUp' });
  s.downUntil = 0; s.domeHp = domeMax(p);
  s.phase = 'gap'; s.nextAt = p.time + RETRY_GAP;
  return true;
}

/** The dome gives: an energy wave throws the whole horde back (none of it is left) and the siege stops — the same wave waits for the player's word. */
function breach(p: WorldParty, ev: GEvent[]): void {
  const s = p.siege!;
  p.units = p.units.filter((u) => !(u.side === 'foe' && u.group === SIEGE_GROUP));
  p.s.foes = p.s.foes.filter((e) => e.group !== SIEGE_GROUP);
  p.siegeQueue = [];
  // (the wave that broke it comes again; a dome that gave between waves holds the next one)
  if (s.phase === 'wave') s.wave = Math.max(0, s.wave - 1);
  s.phase = 'held'; s.nextAt = Infinity;
  s.downUntil = p.time + DOME.lull; s.domeHp = 0;
  ev.push({ t: p.time, type: 'buff', text: 'domeBreak', amount: s.wave + 1, to: { x: p.base.x + 1, y: p.base.y + 1 } });
}

/** a free open cell at or near `at` (inside the dome when `inside`, outside it when not) */
function spot(p: WorldParty, at: Cell, inside: boolean, self: string, taken: Cell[]): Cell {
  for (let r = 0; r <= 5; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const c = { x: at.x + dx, y: at.y + dy };
    if (Math.max(Math.abs(dx), Math.abs(dy)) === r && walkable(tileAt(p.s.map, c)) && inDome(p, c) === inside && !occupied(p, c, self) && !taken.some((o) => o.x === c.x && o.y === c.y)) return c;
  }
  return at;
}

/**
 * The clones at home (spec §4): a ranged one holds a place just inside the dome's north rim and shoots out; a melee one
 * holds a place just before it and goes for whatever comes within FRONT_GUARD of that. One hurt badly falls back inside,
 * where every clone mends; one that falls rises by the pod after a while, none the worse.
 */
function clonesTick(p: WorldParty, dt: number, ev: GEvent[]): void {
  const t = p.time, b = p.base, r = domeR(p), up = domeUp(p), taken: Cell[] = [];
  const squad = clones(p);
  const calm = !p.siegeQueue?.length && !p.units.some((f) => f.side === 'foe' && f.group === SIEGE_GROUP && alive(p, f)), after = new Set<number>();
  let nr = 0, nm = 0;
  for (const u of squad) {
    const e = entOf(p, u.id);
    if (!e) continue;
    if (!e.alive) {
      u.downAt ??= t;
      if (t < u.downAt + reviveTime(p)) continue;
      e.alive = true; e.hp = Math.ceil(e.maxHp / 2); e.pos = spot(p, p.s.map.start, true, u.id, taken);
      u.downAt = undefined; u.fallBack = false; u.station = undefined; u.order = null; u.nextAt = t;
      ev.push({ t, type: 'buff', dst: u.id, src: u.id, text: 'revive', to: { ...e.pos } });
    }
    u.downAt = undefined;
    const inside = inDome(p, e.pos);
    if (inside && up && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * MEND * dt);
    if (e.hp < e.maxHp * FALL_BACK) u.fallBack = true; else if (e.hp >= e.maxHp * GO_OUT) u.fallBack = false;
    const ranged = stats(u, t, p).range > 1;
    // places fan out from the middle of the north rim: 0, +2, -2, +4, …
    const k = ranged ? nr++ : nm++, off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 2;
    const mode = u.fallBack && up ? 'in' : ranged ? 'rim' : 'front';
    if (u.station?.mode !== mode || !walkable(tileAt(p.s.map, u.station.cell)) || inDome(p, u.station.cell) !== (mode !== 'front')) {
      const cell = mode === 'in' ? spot(p, p.s.map.start, true, u.id, taken) : mode === 'rim' ? spot(p, { x: b.x + off, y: b.y + 2 - r }, true, u.id, taken) : spot(p, { x: b.x + off, y: b.y - r }, false, u.id, taken);
      u.station = { mode, cell };
    }
    const want = u.station.cell, guard = mode === 'front' ? FRONT_GUARD : 0;
    taken.push(want);
    // nothing to fight: a clone that is fit goes out for the nearest shards (it is called back the moment a raider steps out)
    const heap = calm && mode !== 'in' && !u.ultQueued ? fetchDrop(p, e.pos, after) : undefined;
    if (heap) {
      after.add(heap.id);
      const cell = { x: Math.round(heap.x), y: Math.round(heap.y) };
      if (!(u.order?.kind === 'move' && same(u.order.cell, cell))) u.order = { kind: 'move', cell };
      continue;
    }
    // an ultimate on its way is not called off by the drill
    if (u.ultQueued) continue;
    const o = u.order;
    // (a melee clone holding its place walks back to it by itself; one that never steps out and yet is off its place — its own
    // blink took it there — is sent back)
    if (o?.kind === 'hold' && same(o.cell, want) && o.guard === guard && (guard > 0 || same(e.pos, want))) continue;
    if (same(e.pos, want)) u.order = { kind: 'hold', cell: { ...want }, guard };
    else if (!(o?.kind === 'move' && same(o.cell, want))) u.order = { kind: 'move', cell: { ...want } };
  }
}

/** The dead of the horde are cleared away a while after they fall (their bodies are there for what feeds on bodies, then gone). */
function reap(p: WorldParty): void {
  const t = p.time, s = p.siege!;
  let gone = false;
  for (const u of p.units) {
    if (u.side !== 'foe' || u.group !== SIEGE_GROUP || alive(p, u)) continue;
    if (u.goneAt === undefined) {
      u.goneAt = t + 10; s.kills++;
      // what it leaves lies where it fell
      const at = u.sx !== undefined ? { x: u.sx - 0.5, y: u.sy! - 0.5 } : entOf(p, u.id)?.pos;
      if (at) dropShards(p, at.x, at.y, (u.bounty ?? 0) * worth(p, 'bounty'));
    }
    else if (t >= u.goneAt) gone = true;
  }
  if (!gone) return;
  const drop = new Set(p.units.filter((u) => u.side === 'foe' && u.group === SIEGE_GROUP && u.goneAt !== undefined && t >= u.goneAt).map((u) => u.id));
  p.units = p.units.filter((u) => !drop.has(u.id));
  p.s.foes = p.s.foes.filter((e) => !drop.has(e.id));
}

/** Time runs on for the siege: the dome mends or relights; the wave counted down steps out, the one out moves and — cleared — gives way to the next count; the clones keep their places. */
export function siegeTick(p: WorldParty, dt: number, ev: GEvent[]): void {
  const s = p.siege;
  if (!s || p.away) return;
  const t = p.time;
  p.manualUlts = !s.auto;
  p.boost = { out: worth(p, 'cloneDmg'), taken: worth(p, 'cloneGuard'), ult: worth(p, 'cloneUlt') };
  if (s.downUntil && t >= s.downUntil) {
    s.downUntil = 0; s.domeHp = domeMax(p);
    ev.push({ t, type: 'buff', text: 'domeUp' });
  }
  // (blows land in the horde's step and in the elites' own turns: a dome brought to nothing gives before it can mend)
  if (!s.downUntil && s.domeHp <= 0) breach(p, ev);
  if (!s.downUntil) s.domeHp = Math.min(domeMax(p), s.domeHp + DOME.regen * worth(p, 'domeRegen') * dt);
  if (s.phase === 'gap' && t >= s.nextAt) {
    s.wave++; s.best = Math.max(s.best, s.wave); s.phase = 'wave'; s.nextAt = Infinity; s.waveAt = t;
    p.siegeQueue = planWave(p, s.wave, t);
    ev.push({ t, type: 'buff', text: 'wave', amount: s.wave });
  }
  if (s.phase === 'wave') {
    while (p.siegeQueue?.length && p.siegeQueue[0]!.at <= t) spawnRaider(p, p.siegeQueue.shift()!, ev);
    swarmTick(p, dt, ev);
    gunTick(p, ev);
    if (s.domeHp <= 0) breach(p, ev);
    // the last of the wave has fallen: a breath, then the next
    else if (!p.siegeQueue?.length && !p.units.some((u) => u.side === 'foe' && u.group === SIEGE_GROUP && alive(p, u))) { s.phase = 'gap'; s.nextAt = t + WAVE_GAP; waveCleared(p, WAVE_GAP, ev); }
    else if (t - (s.waveAt ?? t) > WAVE_LIMIT) for (const u of raiders(p)) { const e = entOf(p, u.id); if (e?.alive) { e.alive = false; e.hp = 0; u.goneAt = t; } }
  }
  reap(p);
  collectShards(p);
  readings(p, dt);
  clonesTick(p, dt, ev);
}

/** where a clone at home that is not out fighting stands: used by the screen to tell who is where */
export const atHome = (p: WorldParty, u: Unit): boolean => alive(p, u) && inDome(p, posOf(p, u));
export { rimOf };
