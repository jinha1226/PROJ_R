import { spawnFoe } from '../grid/foes';
import { makeWeapon } from '../grid/items';
import { newState } from '../grid/state';
import { DIRS, canStep, dist, same, tileAt, walkable, type Cell, type Ent, type GEvent, type GridMap } from '../grid/types';
import { alive, canHit, entOf, occupied, posOf, stats, stepToward, strike, targetOf, unitOf, type Party, type Unit } from './partyCore';
import { CLASSES, DEFAULT_PICKS, FOES, HERO_IDS, PROMOTIONS, WAVES, type FoeId, type Pick } from './partyDefs';
import { useSkill } from './partySkills';
import { autoSkill } from './partyAuto';
import { refitHp } from './partyLevel';

const ROWS = ['###############', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '#.............#', '###############'];
/** where a band enters: fighters in front, archers behind */
const FRONT: Cell[] = [{ x: 11, y: 3 }, { x: 11, y: 5 }, { x: 11, y: 6 }, { x: 12, y: 4 }, { x: 11, y: 2 }, { x: 11, y: 7 }];
const BACK: Cell[] = [{ x: 13, y: 2 }, { x: 13, y: 7 }, { x: 13, y: 4 }, { x: 13, y: 5 }, { x: 12, y: 1 }, { x: 12, y: 8 }];

/** how far round its spot a holding fighter steps out to meet foes */
const GUARD = 3;
const blank = (): Omit<Unit, 'id' | 'side'> => ({ nextAt: 0, order: null, ready: [0, 0], tauntUntil: 0, shield: 0, hiddenUntil: 0, hasteUntil: 0, frozenUntil: 0, empower: 1, guardReady: 0, progress: 0 });

/** A room with the three picked heroes on the left and the first band on the right (heroes beyond the first stand in the foe list for the view, as allies). */
export function partyRoom(picks: Pick[] = DEFAULT_PICKS, seed = 11): Party {
  const m: GridMap = { w: ROWS[0]!.length, h: ROWS.length, tiles: [], rooms: [], start: { x: 3, y: 4 }, exits: [], chests: [], barrels: [],
    spawns: [{ kind: 'minion', pos: { x: 2, y: 3 }, group: 0 }, { kind: 'minion', pos: { x: 2, y: 6 }, group: 0 }] };
  for (const row of ROWS) for (const c of row) m.tiles.push(c === '#' ? 'wall' : 'floor');
  const s = newState(m, seed, 'pistol', 1);
  s.hero.gear.hands[0] = makeWeapon('sword', 1); s.hero.gear.active = 0;
  s.seen.fill(1); s.visible = new Set(m.tiles.map((_, i) => i));
  s.foes[0]!.id = HERO_IDS[1]!; s.foes[1]!.id = HERO_IDS[2]!;
  const p: Party = { s, units: [], time: 0, wave: 0 };
  const ents: Ent[] = [s.hero, s.foes[0]!, s.foes[1]!];
  picks.slice(0, 3).forEach((pick, i) => {
    const e = ents[i]!;
    e.hp = e.maxHp = CLASSES[pick.cls].hp; e.awake = false;
    p.units.push({ ...blank(), id: HERO_IDS[i]!, side: 'hero', cls: pick.cls, weapon: pick.weapon });
  });
  spawnWave(p);
  return p;
}

function spawnWave(p: Party): void {
  const free = (cells: Cell[]) => cells.filter((c) => !occupied(p, c, ''));
  const front = free(FRONT), back = free(BACK);
  WAVES[p.wave]!.forEach((kind: FoeId, i) => {
    const pos = (kind === 'archer' ? back.shift() ?? front.shift() : front.shift() ?? back.shift()) ?? { x: 12, y: 1 + (i % 8) };
    const e = spawnFoe(p.s, kind === 'goblin' ? 'minion' : kind, pos, true);
    e.hp = e.maxHp = FOES[kind].hp;
    p.units.push({ ...blank(), id: e.id, side: 'foe', foe: kind, nextAt: p.time + 0.2 * i });
  });
}

/** Once the field is clear the next band comes in; the living heroes catch their breath (a third of their health). False when none is left. */
export function nextWave(p: Party): boolean {
  if (p.units.some((u) => u.side === 'foe' && alive(p, u)) || p.wave >= WAVES.length - 1) return false;
  p.wave++;
  for (const u of p.units) {
    const e = entOf(p, u.id)!;
    if (u.side === 'hero' && e.alive) e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp / 3));
  }
  spawnWave(p);
  return true;
}

/** A hero who has met its advanced class's condition takes it: new skills and engraving, more health. */
export function promote(p: Party, id: string): GEvent[] {
  const u = unitOf(p, id);
  const promo = u?.cls && PROMOTIONS[u.cls];
  if (!u || !promo || !u.promoteReady || !alive(p, u)) return [];
  const e = entOf(p, id)!;
  if (u.level === undefined) { const more = CLASSES[promo.to].hp - CLASSES[u.cls!].hp; e.maxHp += more; e.hp += more; }
  u.cls = promo.to; u.ready = [p.time, p.time]; u.queued = undefined; u.promoteReady = false; u.progress = 0;
  if (u.level !== undefined) refitHp(p, u);
  return [{ t: p.time, type: 'buff', src: id, dst: id, text: 'promote' }];
}

/** A unit's own moment: follow a move order (then hold there), else fight — close in, or keep range and shoot. */
function turn(p: Party, u: Unit, t: number, ev: GEvent[]): number {
  const e = entOf(p, u.id)!, st = stats(u, t);
  if (u.order?.kind === 'move') {
    const cell = u.order.cell;
    if (!same(e.pos, cell)) {
      if (stepToward(p, u, cell, t, ev)) return st.move;
      // blocked: stand where it got to
      u.order = { kind: 'hold', cell: { ...e.pos } };
    } else u.order = { kind: 'hold', cell };
    // out of combat a walk just ends there
    if (p.combat === false) { u.order = null; return 0.3; }
  }
  // out of combat the others keep near the leader
  if (u.side === 'hero' && !u.order && p.combat === false) {
    const lead = p.leader ? entOf(p, p.leader) : undefined;
    if (!lead?.alive || p.leader === u.id || dist(e.pos, lead.pos) <= 2) return 0.3;
    return stepToward(p, u, lead.pos, t, ev) ? st.move : 0.4;
  }
  if (u.order?.kind === 'hold') {
    const me = e.pos, spot = u.order.cell;
    const inReach = p.units.filter((x) => x.side !== u.side && alive(p, x) && !x.asleep && canHit(p, u, x)).sort((a, b) => dist(posOf(p, a), me) - dist(posOf(p, b), me))[0];
    if (inReach) { strike(p, u, inReach, t, ev); return st.atk; }
    // a fighter guards the ground round its spot: it steps out to meet a foe that comes near, then goes back
    if (st.range <= 1) {
      const near = p.units.filter((x) => x.side !== u.side && alive(p, x) && !x.asleep && dist(posOf(p, x), spot) <= GUARD).sort((a, b) => dist(posOf(p, a), me) - dist(posOf(p, b), me))[0];
      if (near && stepToward(p, u, posOf(p, near), t, ev)) return st.move;
      if (!near && !same(me, spot) && stepToward(p, u, spot, t, ev)) return st.move;
    }
    return 0.3;
  }
  const target = targetOf(p, u, t);
  if (!target) return 0.5;
  const tp = posOf(p, target), d = dist(e.pos, tp);
  if (st.range > 1 && d === 1 && u.side === 'hero') {
    const away = DIRS.map((dir) => ({ x: e.pos.x + dir.x, y: e.pos.y + dir.y })).filter((c) => walkable(tileAt(p.s.map, c)) && !occupied(p, c, u.id) && dist(c, tp) > 1 && canStep(p.s.map, e.pos, { x: c.x - e.pos.x, y: c.y - e.pos.y }));
    if (away[0]) { ev.push({ t, type: 'move', src: u.id, from: { ...e.pos }, to: { ...away[0] }, text: 'roll' }); e.pos = away[0]; return st.move; }
  }
  if (canHit(p, u, target)) { strike(p, u, target, t, ev); return st.atk; }
  if (stepToward(p, u, tp, t, ev)) return st.move;
  // the way to that one is blocked (a barricade, a jam of bodies): go for the next nearest instead of standing still
  if (u.side === 'hero' && !u.order) {
    const others = p.units.filter((x) => x.side !== u.side && x !== target && alive(p, x) && !x.asleep && dist(posOf(p, x), e.pos) <= 10).sort((a, b) => dist(posOf(p, a), e.pos) - dist(posOf(p, b), e.pos));
    for (const o of others.slice(0, 3)) {
      if (canHit(p, u, o)) { strike(p, u, o, t, ev); return st.atk; }
      if (stepToward(p, u, posOf(p, o), t, ev)) return st.move;
    }
  }
  return 0.5;
}

/** One unit's moment: a companion may reach for a skill, a queued skill goes off (it waits while it has no target in reach), else its usual action. */
function moment(p: Party, u: Unit, ev: GEvent[]): void {
  if (p.roam && u.side === 'hero' && u.id !== p.manual && !u.manualSkills) autoSkill(p, u);
  if (u.queued !== undefined && p.time >= u.ready[u.queued]) {
    const cast = useSkill(p, u.id, u.queued);
    if (cast.length) { u.queued = undefined; ev.push(...cast); return; }
  }
  u.nextAt = p.time + turn(p, u, p.time, ev);
}

/**
 * Time runs on: every unit whose moment has come acts, in time order. In turn-based fighting time stops on the manual clone's
 * moment (unless it is walking somewhere) until `command` gives it something to do. Returns what happened.
 */
export function tick(p: Party, dt: number): GEvent[] {
  const ev: GEvent[] = [];
  if (p.waiting || (p as { over?: boolean }).over) return ev;
  const end = p.time + dt;
  for (let guard = 0; guard < 100; guard++) {
    const next = p.units.filter((u) => alive(p, u) && !u.asleep).sort((a, b) => a.nextAt - b.nextAt)[0];
    if (!next || next.nextAt > end) break;
    p.time = Math.max(p.time, next.nextAt);
    if (next.id === p.manual && next.order?.kind !== 'move') { p.waiting = true; p.s.time = p.time; return ev; }
    moment(p, next, ev);
  }
  p.time = end;
  p.s.time = end;
  return ev;
}

export type Command = { kind: 'move'; cell: Cell } | { kind: 'attack'; target: string } | { kind: 'skill'; slot: 0 | 1 } | { kind: 'wait' };

/** The manual clone's turn: one action (a walk goes on by itself until something new happens). Time then runs again. */
export function command(p: Party, c: Command): GEvent[] {
  const u = p.units.find((x) => x.id === p.manual);
  if (!p.waiting || !u || !alive(p, u)) return [];
  const ev: GEvent[] = [];
  if (c.kind === 'skill') {
    const cast = useSkill(p, u.id, c.slot);
    if (!cast.length) return [];
    ev.push(...cast);
  } else if (c.kind === 'wait') {
    u.nextAt = p.time + 0.5;
    ev.push({ t: p.time, type: 'wait', src: u.id });
  } else {
    u.order = c.kind === 'move' ? { kind: 'move', cell: c.cell } : { kind: 'attack', target: c.target };
    u.nextAt = p.time + turn(p, u, p.time, ev);
    // one blow per command: the player chooses again next turn
    if (c.kind === 'attack') u.order = null;
  }
  p.waiting = false;
  return ev;
}
