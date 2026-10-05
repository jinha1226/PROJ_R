import { makeWeapon } from '../grid/items';
import { newState } from '../grid/state';
import { shotClear } from '../grid/combat';
import { findPath } from '../grid/path';
import { DIRS, canStep, dist, same, tileAt, walkable, type Cell, type Ent, type FoeKind, type GEvent, type GridMap, type GridState } from '../grid/types';

export type ClassId = 'warrior' | 'archer' | 'mage';
export type SkillId = 'taunt' | 'whirl' | 'pierce' | 'volley' | 'fireball' | 'heal';
export type Order = { kind: 'attack'; target: string } | { kind: 'move'; cell: Cell } | null;

interface ClassDef { name: string; hp: number; dmg: [number, number]; range: number; atk: number; move: number; skills: [SkillId, SkillId] }
export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: { name: '전사', hp: 70, dmg: [7, 10], range: 1, atk: 1.0, move: 0.9, skills: ['taunt', 'whirl'] },
  archer: { name: '궁수', hp: 40, dmg: [6, 9], range: 6, atk: 1.1, move: 0.9, skills: ['pierce', 'volley'] },
  mage: { name: '마법사', hp: 34, dmg: [5, 8], range: 5, atk: 1.3, move: 1.0, skills: ['fireball', 'heal'] },
};
export const SKILLS: Record<SkillId, { name: string; cd: number }> = {
  taunt: { name: '도발', cd: 8 }, whirl: { name: '회전베기', cd: 6 }, pierce: { name: '관통 사격', cd: 6 },
  volley: { name: '연사', cd: 8 }, fireball: { name: '화염구', cd: 7 }, heal: { name: '치유', cd: 6 },
};
const FOES = { goblin: { hp: 22, dmg: [3, 5] as [number, number], range: 1, atk: 1.0, move: 0.8 }, archer: { hp: 16, dmg: [3, 5] as [number, number], range: 6, atk: 1.3, move: 1.0 } };

export interface Unit { id: string; side: 'hero' | 'foe'; cls?: ClassId; foe?: keyof typeof FOES; nextAt: number; order: Order; ready: [number, number]; tauntUntil: number; tauntBy?: string; queued?: 0 | 1 }
export interface Party { s: GridState; units: Unit[]; time: number }

const ROWS = ['###############', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '###############'];

/** A room with the three heroes on the left and a band of goblins on the right (heroes beyond the first stand in the foe list for the view, marked as allies). */
export function partyRoom(): Party {
  const m: GridMap = { w: ROWS[0]!.length, h: ROWS.length, tiles: [], rooms: [], start: { x: 3, y: 4 }, exits: [], chests: [], barrels: [],
    spawns: [{ kind: 'minion', pos: { x: 2, y: 3 }, group: 0 }, { kind: 'minion', pos: { x: 2, y: 6 }, group: 0 },
      ...[[10, 3], [11, 5], [10, 6], [12, 2], [12, 7]].map(([x, y], i) => ({ kind: (i >= 3 ? 'archer' : 'minion') as FoeKind, pos: { x: x!, y: y! }, group: 1 }))] };
  for (const row of ROWS) for (const c of row) m.tiles.push(c === '#' ? 'wall' : 'floor');
  const s = newState(m, 11, 'pistol', 1);
  s.hero.gear.hands[0] = makeWeapon('sword', 1); s.hero.gear.active = 0;
  s.seen.fill(1); s.visible = new Set(m.tiles.map((_, i) => i));
  s.foes[0]!.id = 'ally-archer'; s.foes[1]!.id = 'ally-mage';
  const units: Unit[] = [];
  const hero = (id: string, cls: ClassId, e: Ent) => { e.hp = e.maxHp = CLASSES[cls].hp; e.awake = false; units.push({ id, side: 'hero', cls, nextAt: 0, order: null, ready: [0, 0], tauntUntil: 0 }); };
  hero('hero', 'warrior', s.hero); hero('ally-archer', 'archer', s.foes[0]!); hero('ally-mage', 'mage', s.foes[1]!);
  s.foes.slice(2).forEach((e, i) => { const kind = e.kind === 'archer' ? 'archer' : 'goblin'; e.hp = e.maxHp = FOES[kind].hp; e.awake = true; units.push({ id: e.id, side: 'foe', foe: kind, nextAt: 0.2 * i, order: null, ready: [0, 0], tauntUntil: 0 }); });
  return { s, units, time: 0 };
}

export const entOf = (p: Party, id: string): Ent | undefined => (id === 'hero' ? p.s.hero : p.s.foes.find((f) => f.id === id));
const alive = (p: Party, u: Unit) => entOf(p, u.id)?.alive ?? false;
const stats = (u: Unit) => (u.cls ? CLASSES[u.cls] : FOES[u.foe!]);
const roll = (p: Party, r: [number, number]) => p.s.rng.int(r[0], r[1]);
const occupied = (p: Party, c: Cell, self: string) => p.units.some((u) => u.id !== self && alive(p, u) && same(entOf(p, u.id)!.pos, c));

export function damage(p: Party, t: number, src: string, dst: Unit, amount: number, ev: GEvent[]): void {
  const e = entOf(p, dst.id)!;
  e.hp = Math.max(0, e.hp - amount);
  ev.push({ t, type: 'hit', src, dst: dst.id, amount, to: { ...e.pos } });
  if (e.hp <= 0) { e.alive = false; ev.push({ t, type: 'die', src, dst: dst.id, to: { ...e.pos } }); }
}

/** One step toward `to` along a free path (other bodies block, the goal itself does not). */
function stepToward(p: Party, u: Unit, to: Cell, t: number, ev: GEvent[]): boolean {
  const e = entOf(p, u.id)!;
  const path = findPath(p.s.map, e.pos, to, (c) => occupied(p, c, u.id));
  const next = path?.[0];
  if (!next || occupied(p, next, u.id)) return false;
  ev.push({ t, type: 'move', src: u.id, from: { ...e.pos }, to: { ...next } });
  e.pos = next;
  return true;
}

function strike(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[]): void {
  const e = entOf(p, u.id)!, te = entOf(p, target.id)!, st = stats(u);
  if (st.range <= 1) ev.push({ t, type: 'bump', src: u.id, dst: target.id, from: { ...e.pos }, to: { ...te.pos } });
  else ev.push({ t, type: 'shoot', src: u.id, dst: target.id, from: { ...e.pos }, to: { ...te.pos }, text: u.cls === 'mage' ? 'spell' : 'bow' });
  if (p.s.rng.chance(st.range <= 1 ? 0.9 : 0.85)) damage(p, t, u.id, target, roll(p, st.dmg), ev);
  else ev.push({ t, type: 'miss', src: u.id, dst: target.id, to: { ...te.pos } });
}

/** Who a unit goes for: its order, a taunt, else the nearest foe of the other side. */
function targetOf(p: Party, u: Unit, t: number): Unit | undefined {
  if (u.side === 'foe' && u.tauntBy && t < u.tauntUntil) { const by = p.units.find((x) => x.id === u.tauntBy && alive(p, x)); if (by) return by; }
  if (u.order?.kind === 'attack') { const o = p.units.find((x) => x.id === (u.order as { target: string }).target && alive(p, x)); if (o) return o; u.order = null; }
  const me = entOf(p, u.id)!.pos;
  return p.units.filter((x) => x.side !== u.side && alive(p, x)).sort((a, b) => dist(entOf(p, a.id)!.pos, me) - dist(entOf(p, b.id)!.pos, me))[0];
}

/** A unit's own moment: follow a move order, else fight — close in, or keep range and shoot (ranged heroes step back from a foe at their side). */
function turn(p: Party, u: Unit, t: number, ev: GEvent[]): number {
  const e = entOf(p, u.id)!, st = stats(u);
  if (u.order?.kind === 'move') {
    if (same(e.pos, u.order.cell) || !stepToward(p, u, u.order.cell, t, ev)) u.order = null;
    return st.move;
  }
  const target = targetOf(p, u, t);
  if (!target) return 0.5;
  const tp = entOf(p, target.id)!.pos, d = dist(e.pos, tp);
  if (st.range > 1 && d === 1 && u.side === 'hero') {
    const away = DIRS.map((dir) => ({ x: e.pos.x + dir.x, y: e.pos.y + dir.y })).filter((c) => walkable(tileAt(p.s.map, c)) && !occupied(p, c, u.id) && dist(c, tp) > 1 && canStep(p.s.map, e.pos, { x: c.x - e.pos.x, y: c.y - e.pos.y }));
    if (away[0]) { ev.push({ t, type: 'move', src: u.id, from: { ...e.pos }, to: { ...away[0] }, text: 'roll' }); e.pos = away[0]; return st.move; }
  }
  if (d <= st.range && (st.range <= 1 ? d === 1 : shotClear(p.s, e.pos, tp))) { strike(p, u, target, t, ev); return st.atk; }
  return stepToward(p, u, tp, t, ev) ? st.move : 0.5;
}

/** Time runs on: every unit whose moment has come acts, in time order. Returns what happened. */
export function tick(p: Party, dt: number): GEvent[] {
  const ev: GEvent[] = [];
  const end = p.time + dt;
  for (let guard = 0; guard < 100; guard++) {
    const next = p.units.filter((u) => alive(p, u)).sort((a, b) => a.nextAt - b.nextAt)[0];
    if (!next || next.nextAt > end) break;
    p.time = Math.max(p.time, next.nextAt);
    // a skill the player queued goes off on the hero's own moment, in place of its usual action
    if (next.queued !== undefined && p.time >= next.ready[next.queued]) {
      const slot = next.queued;
      next.queued = undefined;
      const cast = useSkill(p, next.id, slot);
      if (cast.length) { ev.push(...cast); continue; }
    }
    next.nextAt = p.time + turn(p, next, p.time, ev);
  }
  p.time = end;
  p.s.time = end;
  return ev;
}

/** Queue a hero's skill (as in FTL: orders are given at any time, even paused; they happen as time runs). Again cancels it. */
export function queueSkill(p: Party, id: string, slot: 0 | 1): void {
  const u = p.units.find((x) => x.id === id && x.side === 'hero');
  if (!u || !alive(p, u) || p.time < u.ready[slot]) return;
  u.queued = u.queued === slot ? undefined : slot;
}

/** A hero's skill, now, if it is ready; it costs a short moment. */
export function useSkill(p: Party, id: string, slot: 0 | 1): GEvent[] {
  const u = p.units.find((x) => x.id === id && x.side === 'hero');
  if (!u || !alive(p, u) || p.time < u.ready[slot]) return [];
  const skill = CLASSES[u.cls!].skills[slot], t = p.time, ev: GEvent[] = [], me = entOf(p, id)!;
  const foes = p.units.filter((x) => x.side === 'foe' && alive(p, x));
  const target = targetOf(p, u, t);
  const near = (c: Cell, r: number) => foes.filter((f) => dist(entOf(p, f.id)!.pos, c) <= r);
  if (skill === 'taunt') { for (const f of near(me.pos, 4)) { f.tauntBy = id; f.tauntUntil = t + 5; } ev.push({ t, type: 'buff', src: id, dst: id, text: 'taunt' }); }
  else if (skill === 'whirl') { ev.push({ t, type: 'bump', src: id, text: 'whirl', from: { ...me.pos }, to: { ...me.pos } }); for (const f of near(me.pos, 1)) damage(p, t, id, f, roll(p, [6, 9]), ev); }
  else if (skill === 'heal') {
    const ally = p.units.filter((x) => x.side === 'hero' && alive(p, x)).sort((a, b) => entOf(p, a.id)!.hp / entOf(p, a.id)!.maxHp - entOf(p, b.id)!.hp / entOf(p, b.id)!.maxHp)[0]!;
    const ae = entOf(p, ally.id)!; const n = Math.min(22, ae.maxHp - ae.hp); ae.hp += n;
    ev.push({ t, type: 'heal', src: id, dst: ally.id, amount: n });
  } else {
    if (!target) return [];
    const tp = entOf(p, target.id)!.pos;
    if (skill === 'fireball') { ev.push({ t, type: 'shoot', src: id, dst: target.id, from: { ...me.pos }, to: { ...tp }, text: 'spell' }, { t, type: 'react', src: id, to: { ...tp }, text: 'ignite' }); for (const f of near(tp, 1)) damage(p, t, id, f, roll(p, [10, 14]), ev); }
    else if (skill === 'volley') { for (let k = 0; k < 3; k++) if (alive(p, target)) strike(p, u, target, t + k * 0.15, ev); }
    else if (skill === 'pierce') {
      const dir = { x: Math.sign(tp.x - me.pos.x), y: Math.sign(tp.y - me.pos.y) };
      ev.push({ t, type: 'shoot', src: id, dst: target.id, from: { ...me.pos }, to: { ...tp }, text: 'bow' });
      for (let k = 1; k <= 8; k++) { const c = { x: me.pos.x + dir.x * k, y: me.pos.y + dir.y * k }; const f = foes.find((x) => same(entOf(p, x.id)!.pos, c) && alive(p, x)); if (f) damage(p, t, id, f, roll(p, [9, 12]), ev); }
    }
  }
  u.ready[slot] = t + SKILLS[skill].cd;
  u.nextAt = Math.max(u.nextAt, t + 0.6);
  return ev;
}
