import { emit } from '../party/triggers';
import { HERO_SOULS, type HeroSoulId, type CarriedSoul } from '../delve/heroSouls';
import type { MemoryId } from '../party/memories';
import { G, starterGear, nextItemId } from '../delve/gear';
import type { Item } from '../delve/items';
import { spawnFoe } from '../grid/foes';
import { computeFov } from '../grid/fov';
import { dist, idx, walkable, tileAt, type Cell, type GEvent } from '../grid/types';
import { alive, ENGAGE, entOf, type Party, type Unit } from '../party/partyCore';
import { CLASSES, type BaseClass } from '../party/partyDefs';
import { awardXp, levelOf, refitHp, LEVEL_XP } from '../party/partyLevel';
import { BASE_SOUL_SLOTS, soulsOf } from '../party/body';
import { rank } from '../party/traitTypes';
import { applySf, type SfState } from '../base/workshop';
import { T } from '../party/traitMods';

/** a fallen native's soul stone lying about */
export interface Soul { id: number; pos: Cell; cls: BaseClass; taken: boolean; hero?: HeroSoulId; memory?: MemoryId }

/** A party that roams a map (the land above or a dungeon floor): souls to find, clones printed at its base. */
export interface RoamParty extends Party {
  /** Deepest floor visited, carried across shaft trips. */
  deepest?: number;
  pack: Item[]; nextItem: number;
  souls: Soul[];
  /** souls picked up by clones that already had one, waiting for a body at the base */
  carried: CarriedSoul[];
  ore: number; crystal: number; foundHeroes: HeroSoulId[];
  nextClone: number;
  /** where new bodies come out (the ship, or the lift down) */
  base: Cell;
  /** when the base wakes a new empty body after the last clone fell (if it has the stuff for one) */
  rewakeAt?: number;
  /** bio-matter gathered from the fallen: what new bodies are printed from */
  bio: number;
  /** every clone fell and there was not enough bio-matter for another body (or, below ground, nobody is left to come back) */
  over?: boolean;
  /** new bodies come out here (the pod on the surface; never in a dungeon) */
  printHere: boolean;
  /** the last time first aid was counted */
  regenAt?: number;
  /** how far the clones see */
  sight: number;
  /** souls one body may hold (the lab raises it) */
  soulSlots?: number;
  /** the workshop: blueprints, modules, what dismantling added to the gun and suit */
  sf?: SfState;
}

/** how far a sleeping band notices the party */
export const NOTICE = 6;
/** how long a band that has just spotted the party takes before its first move */
export const REACT = 1;
/** an awake foe farther than this from every clone gives up */
const LEASH = 12;
/** living clones at once */
export const MAX_CLONES = 3;
/** how near the base a clone must stand for another body to be printed (where there is no printer) */
export const BASE_REACH = 5;
/** bio-matter one new body takes */
export const BODY_COST = 25;
/** bio-matter a fallen foe leaves (elites twice as much) */
const BIO: Record<string, number> = { goblin: 3, archer: 3, brute: 8, ghoul: 3, shaman: 4, warlord: 30 };

export const slotsOf = (p: RoamParty): number => p.soulSlots ?? BASE_SOUL_SLOTS;

export const blank = (): Omit<Unit, 'id' | 'side'> => ({ status: {}, trig: {}, nth: 0, still: 0, crisisUsed: false, ultReady: 0, nextAt: 0, order: null, ready: [0, 0], tauntUntil: 0, shield: 0, hiddenUntil: 0, hasteUntil: 0, frozenUntil: 0, empower: 1, guardReady: 0, progress: 0 });

/** The clones (living or not) in the order they were made. */
export const clones = (p: Party): Unit[] => p.units.filter((u) => u.side === 'hero' && !u.summoner);
export const living = (p: Party): Unit[] => clones(p).filter((u) => alive(p, u));
export const nearest = (p: Party, c: Cell): number => Math.min(...living(p).map((u) => dist(entOf(p, u.id)!.pos, c)));

/** What the living clones see together. */
export function look(p: RoamParty): void {
  const s = p.s;
  s.visible = new Set();
  for (const u of living(p)) for (const k of computeFov(s.map, entOf(p, u.id)!.pos, p.sight)) s.visible.add(k);
  for (const k of s.visible) s.seen[k] = 1;
}

/** Souls go only into a fresh body: never been down, not grown past the level its hero souls brought (1 without one), a slot free. */
export const canTakeSoul = (p: RoamParty, u: Unit): boolean => !u.wentDown && soulsOf(u).length < slotsOf(p)
  && levelOf(u) <= Math.max(1, ...soulsOf(u).map((s) => (s.hero ? HERO_SOULS[s.hero].level : 1)));

/** The named heroes held at the base or in a body here (they are not rolled again below). */
export const heldHeroes = (p: RoamParty): HeroSoulId[] => [...new Set([
  ...p.carried.flatMap((s) => (typeof s !== 'string' && s.hero ? [s.hero] : [])),
  ...living(p).flatMap((u) => soulsOf(u).flatMap((s) => (s.hero ? [s.hero] : []))),
])];

/** A soul goes into a body: the first sets its class, weapon and kit; any soul adds its line, memory and ultimate. Named heroes bring their level and cards. */
export function implant(p: RoamParty, u: Unit, soul: CarriedSoul, ev: GEvent[]): void {
  const s = typeof soul === 'string' ? { cls: soul } : soul;
  if (s.hero && p.combat) return;
  const cls = s.hero ? HERO_SOULS[s.hero].cls : s.cls, e = entOf(p, u.id)!, first = !soulsOf(u).length;
  u.souls = [...soulsOf(u), { cls, hero: s.hero, memory: s.memory, ultReady: p.time }];
  if (first) {
    u.ammo = undefined; u.sfMods = undefined;
    u.cls = cls; u.weapon = CLASSES[cls].weapons[0]!; u.ready = [p.time, p.time]; u.queued = undefined;
    const accessory = u.gear?.accessory ?? null;
    u.gear = { ...starterGear(cls, () => nextItemId(p)), accessory };
  }
  if (s.hero) {
    const h = HERO_SOULS[s.hero];
    if (levelOf(u) < h.level) { u.level = h.level; u.xp = LEVEL_XP[h.level - 1]!; }
    for (const [id, r] of Object.entries(h.traits)) u.traits = { ...u.traits, [id]: Math.max(rank(u, id), r ?? 0) };
    u.hero ??= s.hero; u.name ??= h.name;
    if (!p.foundHeroes.includes(s.hero)) p.foundHeroes.push(s.hero);
  }
  refitHp(p, u); e.hp = e.maxHp;
  ev.push({ t: p.time, type: 'buff', src: u.id, dst: u.id, text: 'soul' });
}

/** The player puts a carried soul into a fresh clone; no events when it cannot go in (not fresh, full, no such soul, a hero soul mid-fight). */
export function implantCarried(p: RoamParty, id: string, at: number): GEvent[] {
  const u = living(p).find((v) => v.id === id), soul = p.carried[at], ev: GEvent[] = [];
  if (!u || !canTakeSoul(p, u) || soul === undefined || (typeof soul !== 'string' && soul.hero && p.combat)) return ev;
  p.carried.splice(at, 1);
  implant(p, u, soul, ev);
  return ev;
}

/** A new body at the base (or by `near`, the printer): empty, or with a soul. */
export function print(p: RoamParty, cls: CarriedSoul | undefined, ev: GEvent[], near: Cell = p.s.map.start): Unit | undefined {
  const m = p.s.map, taken = (c: Cell) => p.units.some((u) => alive(p, u) && entOf(p, u.id)!.pos.x === c.x && entOf(p, u.id)!.pos.y === c.y);
  let at: Cell | undefined;
  for (let r = 0; r < 4 && !at; r++) for (let dx = -r; dx <= r && !at; dx++) for (let dy = -r; dy <= r && !at; dy++) {
    const c = { x: near.x + dx, y: near.y + dy };
    if (walkable(tileAt(m, c)) && !taken(c)) at = c;
  }
  if (!at) return undefined;
  const e = spawnFoe(p.s, 'minion', at, false);
  e.id = `c${p.nextClone++}`;
  const u: Unit = { ...blank(), id: e.id, side: 'hero', cls: 'shell', weapon: 'pistol', gear: starterGear('shell', () => nextItemId(p)), nextAt: p.time };
  e.hp = e.maxHp = CLASSES.shell.hp;
  p.units.push(u);
  ev.push({ t: p.time, type: 'buff', src: u.id, dst: u.id, text: 'print' });
  // a new empty body comes out with the workshop's gun and suit
  applySf(p, u);
  if (cls) implant(p, u, cls, ev);
  return u;
}

/** Souls: picked up where they lie, fallen clones drop theirs, the base prints bodies for the ones carried home. */
function souls(p: RoamParty, ev: GEvent[], named = false): void {
  if (named && p.combat) return;
  const t = p.time;
  // a clone that falls is gone, soul and all (no stone is left to recover)
  for (const u of clones(p)) if (!named && !alive(p, u) && soulsOf(u).length) { ev.push({ t, type: 'drop', src: u.id, text: 'soulLost' }); u.souls = []; }
  for (const soul of p.souls) {
    if (soul.taken || Boolean(soul.hero) !== named) continue;
    const by = living(p).find((u) => dist(entOf(p, u.id)!.pos, soul.pos) <= 1);
    if (!by) continue;
    soul.taken = true;
    ev.push({ t, type: 'pickup', src: by.id, to: soul.pos, text: 'soul' });
    // picked up below, a stone is unidentified until it reaches the base
    const carried: CarriedSoul = !p.printHere ? { cls: soul.cls, hero: soul.hero, memory: soul.memory, unknown: true } : soul.hero ? { cls: soul.cls, hero: soul.hero, memory: soul.memory } : soul.memory ? { cls: soul.cls, memory: soul.memory } : soul.cls;
    if (soul.hero && !p.foundHeroes.includes(soul.hero)) p.foundHeroes.push(soul.hero);
    p.carried.push(carried);
  }
  // the last clone fell: one more empty body if the stuff is there, else it is over
  if (!named && !living(p).length && !p.over) {
    if (!p.printHere || p.bio < BODY_COST) { p.over = true; ev.push({ t, type: 'dead', text: p.printHere ? 'wiped' : 'lost' }); return; }
    p.rewakeAt ??= t + 3;
    if (t >= p.rewakeAt) { p.rewakeAt = undefined; p.bio -= BODY_COST; const u = print(p, undefined, ev); if (u) p.leader = u.id; }
  }
}

/**
 * After the party's moment-by-moment actions: souls, who leads, sight, waking bands, giving up chases, whether there is a fight.
 * A clone under the player's hand stops walking when something new happens (a band wakes, it is hurt), as in Jupiter Hell.
 */
export function roamStep(p: RoamParty, hpBefore: Map<string, number>, ev: GEvent[]): void {
  // the fallen leave bio-matter, gathered at once (each body counted once, however it fell)
  for (const f of p.units) {
    const e = entOf(p, f.id);
    if (f.side !== 'foe' || f.reaped || !e || e.alive) continue;
    f.reaped = true;
    awardXp(p, f, ev);
    const n = Math.round((BIO[f.foe ?? ''] ?? 3) * (e.elite ? 2 : 1));
    p.bio += n;
    ev.push({ t: p.time, type: 'loot', to: { ...e.pos }, amount: n, text: 'bio' });
  }
  souls(p, ev);
  if (!living(p).length) return;
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
    // spotting the party, a band takes a beat to react; the clones that walked in may act at once (no free first blow from behind a door)
    band.forEach((f, i) => { f.asleep = false; f.nextAt = Math.max(f.nextAt, t + REACT + 0.2 * i); });
    for (const u of living(p)) u.nextAt = Math.min(u.nextAt, t);
    ev.push({ t, type: 'wake', src: band[0]!.id, text: String(g) });
  }
  for (const f of p.units) if (f.side === 'foe' && !f.asleep && alive(p, f) && nearest(p, entOf(p, f.id)!.pos) > LEASH && t >= (f.alertUntil ?? 0)) f.asleep = true;
  const was = p.combat;
  p.combat = p.units.some((f) => f.side === 'foe' && !f.asleep && alive(p, f) && nearest(p, entOf(p, f.id)!.pos) <= ENGAGE);
  if (!was && p.combat) for (const u of living(p)) emit(p, 'combatStart', { t, src: u, ev });
  if (!p.combat) for (const u of living(p)) {u.crisisUsed = false;u.immortalUsed=false;}
  souls(p, ev, true);
  if (was && !p.combat) for (const u of living(p)) if (u.order?.kind === 'hold') u.order = null;
  // a fight starts: every walk stops where it is (as Jupiter Hell stops a walk on sight of a foe), so nobody strolls into the band
  if (!was && p.combat) for (const u of living(p)) if (u.order?.kind === 'move') u.order = null;
  // first aid: out of a fight a clone mends a share of its health each second
  if (!p.combat) for (const u of living(p)) {
    const r = T.regen(u), e = entOf(p, u.id)!;
    if (!r || e.hp >= e.maxHp) continue;
    const secs = Math.floor(p.time) - Math.floor(p.regenAt ?? p.time);
    if (secs > 0) e.hp = Math.min(e.maxHp, e.hp + Math.max(1, Math.round(e.maxHp * r * secs * G.healTaken(u))));
  }
  p.regenAt = p.time;
  const hand = p.manual ? p.units.find((u) => u.id === p.manual) : undefined;
  if (hand?.order?.kind === 'move' && (woke.size || (entOf(p, hand.id)?.hp ?? 0) < (hpBefore.get(hand.id) ?? 0))) hand.order = null;
}

export const hpNow = (p: Party): Map<string, number> => new Map(clones(p).map((u) => [u.id, entOf(p, u.id)!.hp]));

/** Out of combat an order moves the whole party (the chosen clone leads); in combat it is that clone's own. */
export function orderTo(p: RoamParty, id: string, cell: Cell): void {
  const u = p.units.find((x) => x.id === id && x.side === 'hero');
  if (!u || !alive(p, u)) return;
  if (!p.combat) { p.leader = id; for (const h of living(p)) if (h.order) h.order = null; }
  u.order = { kind: 'move', cell };
}
