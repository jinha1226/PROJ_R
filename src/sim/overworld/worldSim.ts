import { spawnFoe } from '../grid/foes';
import { computeFov } from '../grid/fov';
import { newState } from '../grid/state';
import { dist, idx, walkable, tileAt, type Cell, type GEvent } from '../grid/types';
import { alive, entOf, type Party, type Unit } from '../party/partyCore';
import { CLASSES, FOES, type BaseClass, type FoeId } from '../party/partyDefs';
import { tick } from '../party/partySim';
import { COVER, generateWorld, type Camp, type Ground, type LandLight, type Soul } from './worldGen';

export const SIGHT = 9;
/** how far a sleeping camp notices the party */
const NOTICE = 6;
/** an awake foe farther than this from every hero gives up */
const LEASH = 12;
const CLAIM_BASE = 11;
const CLAIM_CAMP = 9;
/** living clones the ship can keep at once */
export const MAX_CLONES = 3;
/** how near the ship a clone must stand for the ship to print another body */
const SHIP_REACH = 5;

export interface WorldParty extends Party {
  ground: Ground[]; camps: Camp[]; base: Cell; claimed: Uint8Array;
  souls: Soul[];
  lights: LandLight[];
  /** souls picked up by clones that already had one, waiting for a body at the ship */
  carried: BaseClass[];
  nextClone: number;
  /** when the ship wakes a new empty body after the last clone fell */
  rewakeAt?: number;
}

const FOE_OF: Record<string, FoeId> = { minion: 'goblin', archer: 'archer', brute: 'brute' };
const blank = (): Omit<Unit, 'id' | 'side'> => ({ nextAt: 0, order: null, ready: [0, 0], tauntUntil: 0, shield: 0, hiddenUntil: 0, hasteUntil: 0, frozenUntil: 0, empower: 1, guardReady: 0, progress: 0 });

/** One empty clone wakes by the crashed ship; the land round it is unknown, its camps asleep, souls lying about. */
export function newWorld(seed = 1): WorldParty {
  const w = generateWorld(seed);
  const m = w.map;
  const s = newState(m, seed, 'pistol', 1);
  s.hero.hp = s.hero.maxHp = CLASSES.shell.hp; s.hero.awake = false;
  const p: WorldParty = { s, units: [], time: 0, wave: 0, combat: false, leader: 'hero', roam: true, ground: w.ground, camps: w.camps, base: w.base, claimed: new Uint8Array(m.w * m.h), souls: w.souls, lights: w.lights, carried: [], nextClone: 1, cover: Uint8Array.from(w.ground, (g) => (COVER.has(g) ? 1 : 0)) };
  p.units.push({ ...blank(), id: 'hero', side: 'hero', cls: 'shell', weapon: 'fists' });
  s.foes.forEach((e, i) => {
    const sp = m.spawns[i]!, camp = w.camps.find((c) => c.group === sp.group);
    const kind = FOE_OF[e.kind] ?? 'goblin';
    // strays are a little weaker than camp goblins; camps grow tougher ring by ring
    const scale = camp ? 1 + 0.35 * (camp.tier - 1) : 0.8;
    e.hp = e.maxHp = Math.round(FOES[kind].hp * scale * (sp.elite ? 1.5 : 1));
    p.units.push({ ...blank(), id: e.id, side: 'foe', foe: kind, asleep: true, group: sp.group, nextAt: 0.15 * i });
  });
  claim(p, w.base, CLAIM_BASE);
  look(p);
  return p;
}

/** The clones (living or not) in the order they were made. */
export const clones = (p: Party): Unit[] => p.units.filter((u) => u.side === 'hero');
const living = (p: Party) => clones(p).filter((u) => alive(p, u));
const nearest = (p: Party, c: Cell) => Math.min(...living(p).map((u) => dist(entOf(p, u.id)!.pos, c)));

function claim(p: WorldParty, c: Cell, r: number): void {
  const m = p.s.map;
  for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h || Math.hypot(x - c.x, y - c.y) > r) continue;
    p.claimed[y * m.w + x] = 1;
  }
}

function look(p: WorldParty): void {
  const s = p.s;
  s.visible = new Set();
  for (const u of living(p)) for (const k of computeFov(s.map, entOf(p, u.id)!.pos, SIGHT)) s.visible.add(k);
  for (const k of s.visible) s.seen[k] = 1;
}

/** A soul goes into a body: the clone becomes that class, armed with its first weapon, whole again. */
function implant(p: WorldParty, u: Unit, cls: BaseClass, ev: GEvent[]): void {
  const e = entOf(p, u.id)!;
  u.cls = cls; u.soul = cls; u.weapon = CLASSES[cls].weapons[0]!; u.ready = [p.time, p.time]; u.queued = undefined;
  e.hp = e.maxHp = CLASSES[cls].hp;
  ev.push({ t: p.time, type: 'buff', src: u.id, dst: u.id, text: 'soul' });
}

/** A new body from the ship, beside it: empty, or with a soul. */
function print(p: WorldParty, cls: BaseClass | undefined, ev: GEvent[]): Unit | undefined {
  const m = p.s.map, taken = (c: Cell) => p.units.some((u) => alive(p, u) && entOf(p, u.id)!.pos.x === c.x && entOf(p, u.id)!.pos.y === c.y);
  let at: Cell | undefined;
  for (let r = 0; r < 4 && !at; r++) for (let dx = -r; dx <= r && !at; dx++) for (let dy = -r; dy <= r && !at; dy++) {
    const c = { x: m.start.x + dx, y: m.start.y + dy };
    if (walkable(tileAt(m, c)) && !taken(c)) at = c;
  }
  if (!at) return undefined;
  const e = spawnFoe(p.s, 'minion', at, false);
  e.id = `c${p.nextClone++}`;
  const u: Unit = { ...blank(), id: e.id, side: 'hero', cls: 'shell', weapon: 'fists', nextAt: p.time };
  e.hp = e.maxHp = CLASSES.shell.hp;
  p.units.push(u);
  ev.push({ t: p.time, type: 'buff', src: u.id, dst: u.id, text: 'print' });
  if (cls) implant(p, u, cls, ev);
  return u;
}

/** Souls: picked up where they lie, fallen clones drop theirs, the ship prints bodies for the ones carried home. */
function souls(p: WorldParty, ev: GEvent[]): void {
  const t = p.time;
  for (const u of clones(p)) {
    // a clone that fell leaves its soul where it lay
    if (!alive(p, u) && u.soul) {
      const at = { ...entOf(p, u.id)!.pos };
      p.souls.push({ id: p.souls.length, pos: at, cls: u.soul, taken: false });
      ev.push({ t, type: 'drop', src: u.id, to: at, text: 'soul' });
      u.soul = undefined;
    }
  }
  for (const soul of p.souls) {
    if (soul.taken) continue;
    const by = living(p).find((u) => dist(entOf(p, u.id)!.pos, soul.pos) <= 1);
    if (!by) continue;
    soul.taken = true;
    ev.push({ t, type: 'pickup', src: by.id, to: soul.pos, text: 'soul' });
    if (by.cls === 'shell') implant(p, by, soul.cls, ev); else p.carried.push(soul.cls);
  }
  // an empty body takes a carried soul at once
  for (const u of living(p)) if (u.cls === 'shell' && p.carried.length) implant(p, u, p.carried.shift()!, ev);
  // at the ship, a carried soul gets a new body
  if (!p.combat && p.carried.length && living(p).length < MAX_CLONES && nearest(p, p.base) <= SHIP_REACH) print(p, p.carried.shift(), ev);
  // the last clone fell: the ship wakes a new empty body after a moment
  if (!living(p).length) {
    p.rewakeAt ??= t + 3;
    if (t >= p.rewakeAt) { p.rewakeAt = undefined; const u = print(p, undefined, ev); if (u) p.leader = u.id; }
  }
}

/** Time runs on the world map: the clones act, then sight, souls, waking camps, giving up chases, cleared camps, and rest on claimed land. */
export function worldTick(p: WorldParty, dt: number): GEvent[] {
  const t0 = p.time;
  const ev = tick(p, dt);
  souls(p, ev);
  if (!living(p).length) return ev;
  if (!entOf(p, p.leader ?? '')?.alive) p.leader = living(p)[0]!.id;
  look(p);
  const t = p.time;
  const woke = new Set<number>();
  for (const f of p.units) {
    if (f.side !== 'foe' || !f.asleep || !alive(p, f)) continue;
    const at = entOf(p, f.id)!.pos;
    if (p.s.visible.has(idx(p.s.map, at)) && nearest(p, at) <= NOTICE) woke.add(f.group!);
  }
  for (const g of woke) {
    const band = p.units.filter((f) => f.side === 'foe' && f.group === g && alive(p, f));
    band.forEach((f, i) => { f.asleep = false; f.nextAt = t + 0.2 * i; });
    ev.push({ t, type: 'wake', src: band[0]!.id, text: String(g) });
  }
  // a chase that runs too far ends: the foe settles where it stands
  for (const f of p.units) if (f.side === 'foe' && !f.asleep && alive(p, f) && nearest(p, entOf(p, f.id)!.pos) > LEASH) f.asleep = true;
  const was = p.combat;
  p.combat = p.units.some((f) => f.side === 'foe' && !f.asleep && alive(p, f) && nearest(p, entOf(p, f.id)!.pos) <= 12);
  if (was && !p.combat) for (const u of living(p)) if (u.order?.kind === 'hold') u.order = null;
  for (const camp of p.camps) {
    if (camp.cleared || p.units.some((f) => f.side === 'foe' && f.group === camp.group && alive(p, f))) continue;
    camp.cleared = true;
    claim(p, camp.pos, CLAIM_CAMP);
    ev.push({ t, type: 'buff', src: p.leader, dst: p.leader, text: 'claim', amount: camp.id });
  }
  // claimed land heals: 2% of health per second out of combat
  if (!p.combat) for (const u of living(p)) {
    const e = entOf(p, u.id)!;
    if (!p.claimed[idx(p.s.map, e.pos)]) continue;
    const ticks = Math.floor(t * 2) - Math.floor(t0 * 2);
    if (ticks > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + Math.max(1, Math.round(e.maxHp * 0.01 * ticks)));
  }
  return ev;
}

/** Out of combat an order moves the whole party (the chosen clone leads); in combat it is that clone's own. */
export function orderTo(p: WorldParty, id: string, cell: Cell): void {
  const u = p.units.find((x) => x.id === id && x.side === 'hero');
  if (!u || !alive(p, u)) return;
  if (!p.combat) { p.leader = id; for (const h of living(p)) if (h.order) h.order = null; }
  u.order = { kind: 'move', cell };
}

export const claimedShare = (p: WorldParty): number => p.claimed.reduce((a, b) => a + b, 0) / p.claimed.length;
