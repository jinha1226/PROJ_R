import { makeWeapon } from '../grid/items';
import { newState, refreshSight } from '../grid/state';
import { fromSave, toSave } from '../grid/save';
import { canStep, dist, same, tileAt, walkable, type Cell, type GEvent, type GridMap, type GridState } from '../grid/types';
import { FOES, HERO, MOVES, WEAPONS, shapeCells, type FoeId, type FoeStrike, type Strike, type WeaponId } from './soulsDefs';

export type SoulsAction =
  | { kind: 'move'; dir: Cell } | { kind: 'dodge'; dir: Cell } | { kind: 'light' } | { kind: 'heavy' }
  | { kind: 'guard' } | { kind: 'parry' } | { kind: 'heal' } | { kind: 'weapon'; id: WeaponId } | { kind: 'face'; dir: Cell };

interface FoeBody { id: string; def: FoeId; poise: number; facing: Cell; intent?: FoeStrike & { at: number; cells: Cell[] }; staggerUntil: number; turn: number; hitAt: number }
export interface Hero { stamina: number; poise: number; flasks: number; weapon: WeaponId; facing: Cell; spentAt: number; hitAt: number; guard: [number, number]; parry: [number, number]; staggerUntil: number }
export interface Souls { s: GridState; hero: Hero; foes: FoeBody[] }

const ROWS = ['#############', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#...........#', '#############'];
const sign = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const toward = (a: Cell, b: Cell): Cell => ({ x: sign(b.x - a.x), y: sign(b.y - a.y) });
const behind = (attacker: Cell, foe: Cell, facing: Cell) => { const d = toward(foe, attacker); return d.x === -facing.x && d.y === -facing.y || (d.x * facing.x + d.y * facing.y < 0); };

/** A small arena: the hero, a few foes, and the souls rules running on the grid game's state (so the game's view draws it). */
export function arena(foes: { id: FoeId; x: number; y: number }[], weapon: WeaponId = 'longsword'): Souls {
  const hero = { x: 6, y: 6 };
  const m: GridMap = { w: ROWS[0]!.length, h: ROWS.length, tiles: [], rooms: [], start: hero, exits: [], chests: [], spawns: foes.map((f, i) => ({ kind: FOES[f.id].kind, pos: { x: f.x, y: f.y }, group: i + 1 })), barrels: [] };
  for (const row of ROWS) for (const c of row) m.tiles.push(c === '#' ? 'wall' : 'floor');
  const s = newState(m, 7, 'pistol', 1);
  s.hero.hp = s.hero.maxHp = HERO.hp;
  s.hero.gear.hands[0] = makeWeapon(WEAPONS[weapon].group, 1);
  s.hero.gear.active = 0;
  s.seen.fill(1);
  const bodies = s.foes.map((f, i) => {
    const def = FOES[foes[i]!.id];
    f.hp = f.maxHp = def.hp; f.awake = true; f.nextAt = 0.3 * i;
    return { id: f.id, def: foes[i]!.id, poise: def.poise, facing: toward(f.pos, hero), staggerUntil: 0, turn: 0, hitAt: -9 };
  });
  refreshSight(s);
  return { s, hero: { stamina: HERO.stamina, poise: HERO.poise, flasks: HERO.flasks, weapon, facing: { x: 0, y: -1 }, spentAt: -9, hitAt: -9, guard: [-1, -1], parry: [-1, -1], staggerUntil: 0 }, foes: bodies };
}

export const cloneSouls = (g: Souls): Souls => ({ s: fromSave(toSave(g.s)), hero: structuredClone(g.hero), foes: structuredClone(g.foes) });

const free = (g: Souls, c: Cell) => walkable(tileAt(g.s.map, c)) && !same(c, g.s.hero.pos) && !g.s.foes.some((f) => f.alive && same(f.pos, c));

/** The foe the hero would strike: the one it faces if any, else the nearest within two cells (it turns to it). */
function aim(g: Souls): void {
  const h = g.s.hero.pos;
  const near = g.s.foes.filter((f) => f.alive && dist(f.pos, h) <= 2).sort((a, b) => dist(a.pos, h) - dist(b.pos, h));
  const faced = near.find((f) => same(toward(h, f.pos), g.hero.facing));
  const t = faced ?? near[0];
  if (t) g.hero.facing = toward(h, t.pos);
}

/** Resolves one hero action: time passes for its cost, foes act within it, blows land in time order. Returns the events to show. */
export function act(g: Souls, a: SoulsAction): GEvent[] {
  const s = g.s, h = g.hero, ev: GEvent[] = [];
  s.events = ev;
  if (!s.hero.alive || s.foes.every((f) => !f.alive)) return [];
  const t0 = Math.max(s.time, h.staggerUntil);
  const w = WEAPONS[h.weapon];
  let cost = 0;
  let strike: (Strike & { cost: number }) | null = null;
  let healAt = -1;
  if (a.kind === 'weapon') { h.weapon = a.id; s.hero.gear.hands[0] = makeWeapon(WEAPONS[a.id].group, 1); cost = 0.5; }
  else if (a.kind === 'face') { h.facing = a.dir; return []; }
  else if (a.kind === 'move' || a.kind === 'dodge') {
    const steps = a.kind === 'dodge' ? (w.armor ? 1 : 2) : 1;
    if (a.kind === 'dodge' && h.stamina < 1) return [{ t: t0, type: 'blocked', src: 'hero' }];
    let pos = s.hero.pos;
    for (let k = 0; k < steps; k++) { const n = { x: pos.x + a.dir.x, y: pos.y + a.dir.y }; if (canStep(s.map, pos, a.dir) && free(g, n)) pos = n; }
    if (same(pos, s.hero.pos)) return [{ t: t0, type: 'blocked', src: 'hero' }];
    ev.push({ t: t0, type: 'move', src: 'hero', from: { ...s.hero.pos }, to: { ...pos }, text: a.kind === 'dodge' ? 'roll' : undefined });
    s.hero.pos = pos;
    if (a.kind === 'move') h.facing = a.dir;
    cost = a.kind === 'dodge' ? MOVES.dodge.cost : MOVES.move.cost;
    if (a.kind === 'dodge') spend(g, t0, MOVES.dodge.stamina);
  } else if (a.kind === 'light' || a.kind === 'heavy') {
    strike = a.kind === 'light' ? w.light : w.heavy;
    if (h.stamina < 1) return [{ t: t0, type: 'blocked', src: 'hero' }];
    aim(g);
    cost = strike.cost;
    spend(g, t0, strike.stamina);
  } else if (a.kind === 'guard') { cost = MOVES.guard.cost; h.guard = [t0, t0 + cost + 0.3]; }
  else if (a.kind === 'parry') { cost = MOVES.parry.cost; h.parry = [t0, t0 + MOVES.parry.window]; spend(g, t0, MOVES.parry.stamina); }
  else if (a.kind === 'heal') { if (h.flasks <= 0) return [{ t: t0, type: 'blocked', src: 'hero' }]; cost = MOVES.heal.cost; healAt = t0 + cost; ev.push({ t: t0, type: 'drink', src: 'hero', to: { ...s.hero.pos } }); }
  let end = t0 + cost;
  let strikeAt = strike ? t0 + strike.at : -1;
  // the world runs to the end of the action, blows landing in time order
  for (let guard = 0; guard < 200; guard++) {
    const foeNext = Math.min(...g.foes.filter((f) => s.foes.find((e) => e.id === f.id)?.alive).map((f) => nextFor(g, f)), Infinity);
    const mine = [strikeAt, healAt].filter((v) => v >= 0);
    const t = Math.min(foeNext, ...mine, Infinity);
    if (t > end + 1e-9) break;
    regen(g, t);
    s.time = t;
    if (t === strikeAt) { heroStrike(g, t, strike!); strikeAt = -1; continue; }
    if (t === healAt) { s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + MOVES.heal.amount); h.flasks--; ev.push({ t, type: 'heal', src: 'hero', dst: 'hero', amount: MOVES.heal.amount }); healAt = -1; continue; }
    const f = g.foes.find((b) => nextFor(g, b) === t && s.foes.find((e) => e.id === b.id)?.alive)!;
    const broke = foeTurn(g, f, t);
    // a hit that breaks the hero's poise cancels what it was doing and staggers it
    if (broke) { strikeAt = -1; healAt = -1; end = Math.max(end, t + 0.6); h.staggerUntil = t + 0.6; }
    if (!s.hero.alive) break;
  }
  regen(g, end);
  s.time = end;
  s.hero.nextAt = end;
  s.telegraphs = g.foes.filter((f) => f.intent && s.foes.find((e) => e.id === f.id)?.alive).map((f) => ({ cells: f.intent!.cells, center: f.intent!.cells[0]!, src: f.id, kind: f.intent!.parry ? 'spell' : 'whirl', el: f.intent!.parry ? 'frost' as const : undefined, dmg: [f.intent!.dmg, f.intent!.dmg] as [number, number], at: f.intent!.at }));
  if (!s.hero.alive) { s.outcome = 'dead'; ev.push({ t: end, type: 'dead', src: 'hero' }); }
  return ev;
}

const nextFor = (g: Souls, f: FoeBody): number => {
  const e = g.s.foes.find((x) => x.id === f.id)!;
  return f.intent ? f.intent.at : Math.max(e.nextAt, f.staggerUntil);
};

function spend(g: Souls, t: number, n: number): void { g.hero.stamina = Math.max(-20, g.hero.stamina - n); g.hero.spentAt = t; }

/** Stamina comes back after a short pause from spending it; poise after a pause from being hit. */
function regen(g: Souls, t: number): void {
  const h = g.hero, dt = Math.max(0, t - g.s.time);
  const from = Math.max(g.s.time, h.spentAt + HERO.regenDelay);
  if (t > from) h.stamina = Math.min(HERO.stamina, h.stamina + HERO.regen * (t - from));
  if (t - h.hitAt > 1.5) h.poise = Math.min(HERO.poise + WEAPONS[h.weapon].armor, h.poise + HERO.poiseRegen * dt);
  for (const f of g.foes) if (t - f.hitAt > 1.5) f.poise = Math.min(FOES[f.def].poise, f.poise + 10 * dt);
}

function heroStrike(g: Souls, t: number, st: Strike): void {
  const s = g.s, h = g.hero;
  const cells = shapeCells(s.hero.pos, h.facing, st.shape);
  const front = cells[Math.floor(cells.length / 2)] ?? cells[0]!;
  s.events.push({ t, type: 'bump', src: 'hero', from: { ...s.hero.pos }, to: { ...front }, group: WEAPONS[h.weapon].group, text: st === WEAPONS[h.weapon].heavy ? 'finisher' : undefined, dst: s.foes.find((f) => f.alive && cells.some((c) => same(c, f.pos)))?.id });
  for (const e of s.foes) {
    if (!e.alive || !cells.some((c) => same(c, e.pos))) continue;
    const b = g.foes.find((x) => x.id === e.id)!;
    const def = FOES[b.def];
    const staggered = t < b.staggerUntil;
    const back = behind(s.hero.pos, e.pos, b.facing);
    let dmg = st.dmg, poise = st.poise, crit = false;
    if (staggered) { dmg = Math.round(dmg * 2.5); crit = true; }
    else if (back) { dmg = Math.round(dmg * WEAPONS[h.weapon].backstab); crit = true; }
    else if (def.shield && st === WEAPONS[h.weapon].light) { dmg = Math.round(dmg * 0.3); poise = Math.round(poise * 0.5); s.events.push({ t, type: 'parry', src: e.id, dst: 'hero', text: 'shield' }); }
    e.hp -= dmg; b.hitAt = t; b.poise -= poise;
    s.events.push({ t, type: 'hit', src: 'hero', dst: e.id, amount: dmg, crit, to: { ...e.pos } });
    if (e.hp <= 0) { e.alive = false; e.hp = 0; b.intent = undefined; s.events.push({ t, type: 'die', src: 'hero', dst: e.id, to: { ...e.pos } }); continue; }
    if (b.poise <= 0 && !staggered) { b.poise = def.poise; b.intent = undefined; b.staggerUntil = t + 1.8; s.events.push({ t, type: 'stun', src: 'hero', dst: e.id, text: 'stagger' }); }
  }
}

/** A foe's moment: land the blow it showed, or show the next one when the hero is in reach, or close in. Returns true if the hero's poise broke. */
function foeTurn(g: Souls, b: FoeBody, t: number): boolean {
  const s = g.s, h = g.hero, e = s.foes.find((x) => x.id === b.id)!, def = FOES[b.def];
  if (b.intent) {
    const it = b.intent;
    b.intent = undefined;
    s.events.push({ t, type: 'bump', src: e.id, from: { ...e.pos }, to: { ...it.cells[Math.floor(it.cells.length / 2)]! }, dst: 'hero', text: it.name });
    let broke = false;
    if (it.cells.some((c) => same(c, s.hero.pos))) {
      if (it.parry && t >= h.parry[0] && t <= h.parry[1]) {
        b.staggerUntil = t + 2.2; b.poise = def.poise;
        s.events.push({ t, type: 'parry', src: 'hero', dst: e.id }, { t, type: 'stun', src: 'hero', dst: e.id, text: 'stagger' });
        e.nextAt = b.staggerUntil;
        return false;
      }
      const guarded = t >= h.guard[0] && t <= h.guard[1] && !behind(e.pos, s.hero.pos, h.facing);
      let dmg = it.dmg;
      if (guarded) { dmg = Math.round(dmg * 0.15); spend(g, t, it.dmg * 2); s.events.push({ t, type: 'shield', src: 'hero', amount: it.dmg - dmg }); if (h.stamina <= 0) { broke = true; s.events.push({ t, type: 'stun', src: e.id, dst: 'hero', text: 'guardBreak' }); } }
      else { h.poise -= it.poise; h.hitAt = t; if (h.poise <= 0) { broke = true; h.poise = HERO.poise; } }
      s.hero.hp -= dmg;
      s.events.push({ t, type: 'hit', src: e.id, dst: 'hero', amount: dmg, to: { ...s.hero.pos } });
      if (s.hero.hp <= 0) { s.hero.hp = 0; s.hero.alive = false; }
    } else s.events.push({ t, type: 'miss', src: e.id, dst: 'hero', to: { ...s.hero.pos } });
    if (it.then) { b.intent = { ...it.then, at: t + it.then.at, cells: shapeCells(e.pos, b.facing, it.then.shape) }; s.events.push({ t, type: 'telegraph', src: e.id, text: it.then.name }); }
    e.nextAt = t + it.recover;
    return broke;
  }
  const d = dist(e.pos, s.hero.pos);
  b.facing = toward(e.pos, s.hero.pos);
  const lined = d <= def.reach && (d === 1 || b.facing.x * (s.hero.pos.x - e.pos.x) + b.facing.y * (s.hero.pos.y - e.pos.y) >= d);
  if (lined) {
    const p = def.patterns[b.turn++ % def.patterns.length]!;
    b.intent = { ...p, at: t + p.at, cells: shapeCells(e.pos, b.facing, p.shape) };
    s.events.push({ t, type: 'telegraph', src: e.id, text: p.name });
    return false;
  }
  // close in: the step toward the hero that is free
  const opts = [b.facing, { x: b.facing.x, y: 0 }, { x: 0, y: b.facing.y }].filter((c) => c.x || c.y);
  const step = opts.find((dir) => canStep(s.map, e.pos, dir) && free(g, { x: e.pos.x + dir.x, y: e.pos.y + dir.y }));
  if (step) { const to = { x: e.pos.x + step.x, y: e.pos.y + step.y }; s.events.push({ t, type: 'move', src: e.id, from: { ...e.pos }, to }); e.pos = to; }
  e.nextAt = t + def.move;
  return false;
}
