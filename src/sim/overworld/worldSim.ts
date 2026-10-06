import { computeFov } from '../grid/fov';
import { makeWeapon } from '../grid/items';
import { newState } from '../grid/state';
import { dist, idx, type Cell, type GEvent } from '../grid/types';
import { alive, entOf, type Party, type Unit } from '../party/partyCore';
import { CLASSES, DEFAULT_PICKS, FOES, HERO_IDS, type FoeId, type Pick } from '../party/partyDefs';
import { tick } from '../party/partySim';
import { generateWorld, type Camp, type Ground } from './worldGen';

export const SIGHT = 9;
/** how far a sleeping camp notices the party */
const NOTICE = 8;
/** an awake foe farther than this from every hero gives up */
const LEASH = 16;
const CLAIM_BASE = 11;
const CLAIM_CAMP = 9;

export interface WorldParty extends Party { ground: Ground[]; camps: Camp[]; base: Cell; claimed: Uint8Array }

const FOE_OF: Record<string, FoeId> = { minion: 'goblin', archer: 'archer', brute: 'brute' };
const blank = (): Omit<Unit, 'id' | 'side'> => ({ nextAt: 0, order: null, ready: [0, 0], tauntUntil: 0, shield: 0, hiddenUntil: 0, hasteUntil: 0, frozenUntil: 0, empower: 1, guardReady: 0, progress: 0 });

/** The party by the crashed ship, the land round it unknown, its camps asleep. */
export function newWorld(picks: Pick[] = DEFAULT_PICKS, seed = 1): WorldParty {
  const w = generateWorld(seed);
  const m = w.map;
  // the two other heroes stand beside the leader (they ride in the foe list for the view)
  m.spawns.unshift({ kind: 'minion', pos: { x: m.start.x - 1, y: m.start.y }, group: 0 }, { kind: 'minion', pos: { x: m.start.x + 1, y: m.start.y }, group: 0 });
  const s = newState(m, seed, 'pistol', 1);
  s.hero.gear.hands[0] = makeWeapon('sword', 1); s.hero.gear.active = 0;
  s.foes[0]!.id = HERO_IDS[1]!; s.foes[1]!.id = HERO_IDS[2]!;
  const p: WorldParty = { s, units: [], time: 0, wave: 0, combat: false, leader: 'hero', roam: true, ground: w.ground, camps: w.camps, base: w.base, claimed: new Uint8Array(m.w * m.h) };
  [s.hero, s.foes[0]!, s.foes[1]!].forEach((e, i) => {
    const pick = picks[i]!;
    e.hp = e.maxHp = CLASSES[pick.cls].hp; e.awake = false;
    p.units.push({ ...blank(), id: HERO_IDS[i]!, side: 'hero', cls: pick.cls, weapon: pick.weapon });
  });
  s.foes.slice(2).forEach((e, i) => {
    const sp = m.spawns[i + 2]!, camp = w.camps.find((c) => c.group === sp.group)!;
    const kind = FOE_OF[e.kind] ?? 'goblin';
    e.hp = e.maxHp = Math.round(FOES[kind].hp * (1 + 0.35 * (camp.tier - 1)) * (sp.elite ? 1.5 : 1));
    p.units.push({ ...blank(), id: e.id, side: 'foe', foe: kind, asleep: true, group: sp.group, nextAt: 0.15 * i });
  });
  claim(p, w.base, CLAIM_BASE);
  look(p);
  return p;
}

/** Marks the land within a radius as the party's. */
function claim(p: WorldParty, c: Cell, r: number): void {
  const m = p.s.map;
  for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h || Math.hypot(x - c.x, y - c.y) > r) continue;
    p.claimed[y * m.w + x] = 1;
  }
}

/** What the living heroes see together. */
function look(p: WorldParty): void {
  const s = p.s;
  s.visible = new Set();
  for (const u of heroes(p)) for (const k of computeFov(s.map, entOf(p, u.id)!.pos, SIGHT)) s.visible.add(k);
  for (const k of s.visible) s.seen[k] = 1;
}

const heroes = (p: Party) => p.units.filter((u) => u.side === 'hero' && alive(p, u));
const nearest = (p: Party, c: Cell) => Math.min(...heroes(p).map((u) => dist(entOf(p, u.id)!.pos, c)));

/** Time runs on the world map: the party acts, then sight, waking camps, giving up chases, cleared camps, and rest on claimed land. */
export function worldTick(p: WorldParty, dt: number): GEvent[] {
  const t0 = p.time;
  const ev = tick(p, dt);
  if (!heroes(p).length) return ev;
  look(p);
  const t = p.time;
  // a camp that sees the party wakes as one
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
  // the fight is over: those holding a spot fall back in behind the leader
  if (was && !p.combat) for (const u of heroes(p)) if (u.order?.kind === 'hold') u.order = null;
  for (const camp of p.camps) {
    if (camp.cleared || p.units.some((f) => f.side === 'foe' && f.group === camp.group && alive(p, f))) continue;
    camp.cleared = true;
    claim(p, camp.pos, CLAIM_CAMP);
    ev.push({ t, type: 'buff', src: 'hero', dst: p.leader ?? 'hero', text: 'claim', amount: camp.id });
  }
  // claimed land heals: 2% of health per second out of combat
  if (!p.combat) for (const u of heroes(p)) {
    const e = entOf(p, u.id)!;
    if (!p.claimed[idx(p.s.map, e.pos)]) continue;
    const before = Math.floor(t0 * 2), after = Math.floor(t * 2);
    if (after > before && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + Math.max(1, Math.round(e.maxHp * 0.01 * (after - before))));
  }
  return ev;
}

/** Out of combat an order moves the whole party (the chosen hero leads); in combat it is that hero's own. */
export function orderTo(p: WorldParty, id: string, cell: Cell): void {
  const u = p.units.find((x) => x.id === id && x.side === 'hero');
  if (!u || !alive(p, u)) return;
  if (!p.combat) { p.leader = id; for (const h of heroes(p)) if (h.order) h.order = null; }
  u.order = { kind: 'move', cell };
}

export const claimedShare = (p: WorldParty): number => p.claimed.reduce((a, b) => a + b, 0) / p.claimed.length;
