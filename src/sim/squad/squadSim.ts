/**
 * One fight of a party of three, as a board to try a way of playing on (2026-10-09; a throwaway, apart from the game's
 * own rules). A round is planned with nothing moving — every foe's next act is on the board — and then played out one
 * act at a time: the party in the order its orders were given, then the foes. The two companions have feelings: fear
 * rises and falls by what happens to them, and past a threshold it changes what they will do. Nothing is rolled: whether
 * an order will be followed, and why not, is known before it is given.
 */
export interface Cell { x: number; y: number }
export type Kind = 'leader' | 'misha' | 'erwen' | 'goblin' | 'archer' | 'ogre';
export type Stance = 'steady' | 'afraid' | 'frozen';
/** (`ult`: with the unit's ultimate — the one thing a player fires by hand; everything else a build does by itself when its condition holds) */
export type Order = { kind: 'attack'; target: string; ult?: boolean } | { kind: 'move'; cell: Cell } | { kind: 'guard'; ally: string } | { kind: 'calm'; ally: string } | { kind: 'taunt' };
/** what a foe will do this round, shown while the round is planned */
export type Intent = { kind: 'chase'; target: string } | { kind: 'shoot'; target: string } | { kind: 'slam'; cells: Cell[] } | { kind: 'walk' };
export interface SUnit {
  id: string; name: string; glyph: string; side: 'hero' | 'foe'; kind: Kind; hp: number; maxHp: number; pos: Cell; move: number; range: number; dmg: number; alive: boolean;
  /** 0–5 (companions only) */
  fear: number;
  /** timid: a blow frightens twice as much; stubborn: keeps to the foe first shot at while it lives */
  trait?: 'timid' | 'stubborn';
  lock?: string;
  /** frost on a foe until this round ends: the next blade to land on it shatters it */
  chilledUntil?: number;
  intent?: Intent;
  /** the leader stands over this one for the round */
  guardedBy?: string;
  /** an ogre that has just slammed only walks the next round */
  winded?: boolean;
  /** the round the ultimate is ready again (ready from the start) */
  ultAt?: number;
  /** the leader has called the foes onto himself this round: blows on him are lighter */
  braced?: boolean;
}
export interface Squad { w: number; h: number; walls: boolean[]; units: SUnit[]; round: number; queue: { id: string; order: Order }[]; over?: 'won' | 'lost' }
export type SEvent =
  | { type: 'move'; id: string; path: Cell[] } | { type: 'hit'; src: string; dst: string; amount: number; note?: string } | { type: 'feel'; id: string; delta: number; why: string }
  | { type: 'down'; id: string } | { type: 'slam'; id: string; cells: Cell[] } | { type: 'say'; id?: string; text: string } | { type: 'chill'; id: string } | { type: 'guard'; id: string; ally: string } | { type: 'round'; n: number };

/** fear's thresholds, the shield a guard brings, how far a soothing word carries, how near a companion must be not to feel alone, the shatter's worth */
export const FEAR = { afraid: 3, frozen: 5, max: 5 }, GUARD_SOAK = 2, CALM_REACH = 2, NEAR = 2, SHATTER = 2.5;
/** rounds before an ultimate is ready again; what each is called */
export const ULT_WAIT = 3, ULT_NAME: Record<string, string> = { leader: '도발', misha: '난무', erwen: '서리 폭풍' };
export const ultReady = (s: Squad, u: SUnit): boolean => s.round >= (u.ultAt ?? 0);

const MAP = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '####..###', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
const mk = (id: string, name: string, glyph: string, kind: Kind, x: number, y: number, hp: number, move: number, range: number, dmg: number, trait?: SUnit['trait']): SUnit =>
  ({ id, name, glyph, side: kind === 'leader' || kind === 'misha' || kind === 'erwen' ? 'hero' : 'foe', kind, hp, maxHp: hp, pos: { x, y }, move, range, dmg, alive: true, fear: 0, trait });

export function newSquad(): Squad {
  const s: Squad = { w: MAP[0]!.length, h: MAP.length, walls: MAP.flatMap((row) => [...row].map((ch) => ch === '#')), round: 1, queue: [], units: [
    mk('me', '나', '나', 'leader', 4, 7, 30, 3, 1, 5), mk('misha', '미샤', '미', 'misha', 3, 8, 16, 4, 1, 4, 'timid'), mk('erwen', '에르웬', '에', 'erwen', 5, 8, 12, 3, 5, 3, 'stubborn'),
    mk('g1', '고블린 A', '고', 'goblin', 2, 2, 9, 3, 1, 3), mk('g2', '고블린 B', '고', 'goblin', 4, 3, 9, 3, 1, 3), mk('g3', '고블린 C', '고', 'goblin', 6, 2, 9, 3, 1, 3),
    mk('ar', '궁수', '궁', 'archer', 4, 1, 6, 2, 6, 3), mk('og', '오우거', '오', 'ogre', 6, 4, 26, 2, 1, 9),
  ] };
  setIntents(s);
  return s;
}

export const unit = (s: Squad, id: string): SUnit | undefined => s.units.find((u) => u.id === id);
export const heroes = (s: Squad): SUnit[] => s.units.filter((u) => u.side === 'hero' && u.alive);
export const foes = (s: Squad): SUnit[] => s.units.filter((u) => u.side === 'foe' && u.alive);
export const cheb = (a: Cell, b: Cell): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const at = (s: Squad, c: Cell): number => c.y * s.w + c.x;
const wall = (s: Squad, c: Cell): boolean => c.x < 0 || c.y < 0 || c.x >= s.w || c.y >= s.h || s.walls[at(s, c)]!;
export const unitAt = (s: Squad, c: Cell): SUnit | undefined => s.units.find((u) => u.alive && u.pos.x === c.x && u.pos.y === c.y);
export const stance = (u: SUnit): Stance => (u.kind === 'leader' || u.side === 'foe' ? 'steady' : u.fear >= FEAR.frozen ? 'frozen' : u.fear >= FEAR.afraid ? 'afraid' : 'steady');
const DIRS: Cell[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];
/** a step from a to a neighbour: not into a wall, nor slantwise round a wall's corner */
const open = (s: Squad, a: Cell, d: Cell): boolean => !wall(s, { x: a.x + d.x, y: a.y + d.y }) && (d.x === 0 || d.y === 0 || (!wall(s, { x: a.x + d.x, y: a.y }) && !wall(s, { x: a.x, y: a.y + d.y })));

/** Steps to every cell from `from` by open ground alone (no one in the way counted): which way round the walls something lies. */
export function field(s: Squad, from: Cell): Int16Array {
  const d = new Int16Array(s.w * s.h).fill(-1), q: Cell[] = [from];
  d[at(s, from)] = 0;
  for (let i = 0; i < q.length; i++) for (const k of DIRS) {
    const c = q[i]!, n = { x: c.x + k.x, y: c.y + k.y };
    if (open(s, c, k) && d[at(s, n)]! < 0) { d[at(s, n)] = d[at(s, c)]! + 1; q.push(n); }
  }
  return d;
}

/** Where a unit can end this round's walk, and the way to each: through its own side, never through the other, never onto anyone. */
export function reach(s: Squad, u: SUnit): Map<number, Cell[]> {
  const out = new Map<number, Cell[]>([[at(s, u.pos), []]]), seen = new Map<number, Cell[]>([[at(s, u.pos), []]]);
  let edge: Cell[] = [u.pos];
  for (let step = 0; step < u.move; step++) {
    const next: Cell[] = [];
    for (const c of edge) for (const k of DIRS) {
      const n = { x: c.x + k.x, y: c.y + k.y }, i = at(s, n), who = unitAt(s, n);
      if (!open(s, c, k) || seen.has(i) || (who && who.side !== u.side)) continue;
      const path = [...seen.get(at(s, c))!, n];
      seen.set(i, path); next.push(n);
      if (!who) out.set(i, path);
    }
    edge = next;
  }
  return out;
}

/** A clear line between two cells (walls stop it; bodies do not). */
export function los(s: Squad, a: Cell, b: Cell): boolean {
  const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let i = 1; i < n; i++) if (wall(s, { x: Math.round(a.x + ((b.x - a.x) * i) / n), y: Math.round(a.y + ((b.y - a.y) * i) / n) })) return false;
  return true;
}
const inRange = (s: Squad, from: Cell, to: Cell, range: number): boolean => cheb(from, to) <= range && (range <= 1 || los(s, from, to));

/** Where a unit ends its walk for something `range` away from `to`: the nearest cell it can strike from, else as near as it gets by the way round. */
export function standFor(s: Squad, u: SUnit, to: Cell, range = u.range): { cell: Cell; path: Cell[]; inRange: boolean } {
  const r = reach(s, u), f = field(s, to), cell = (i: number): Cell => ({ x: i % s.w, y: Math.floor(i / s.w) });
  let best: { cell: Cell; path: Cell[]; inRange: boolean } | undefined;
  for (const [i, path] of r) if (inRange(s, cell(i), to, range) && (!best || path.length < best.path.length)) best = { cell: cell(i), path, inRange: true };
  if (best) return best;
  let bd = Infinity;
  for (const [i, path] of r) { const d = f[i]! < 0 ? 999 : f[i]!; if (d < bd || (d === bd && path.length < best!.path.length)) { bd = d; best = { cell: cell(i), path, inRange: false }; } }
  return best!;
}

/** The cell an order would leave the unit on. */
export function endOf(s: Squad, u: SUnit, o: Order): { cell: Cell; path: Cell[] } {
  if (o.kind === 'move') return standFor(s, u, o.cell, 0);
  if (o.kind === 'taunt') return { cell: u.pos, path: [] };
  const t = unit(s, o.kind === 'attack' ? o.target : o.ally);
  return t ? standFor(s, u, t.pos, o.kind === 'attack' ? u.range : o.kind === 'calm' ? CALM_REACH : 1) : { cell: u.pos, path: [] };
}

/** Whether a companion will do as told, known before the order is given: followed, refused (and why), or turned to something else (and what). */
export function verdict(s: Squad, id: string, o: Order): { word: '따름' | '거부' | '망설임'; why?: string; instead?: Order } {
  const u = unit(s, id)!, st = stance(u);
  if (st === 'frozen') return { word: '거부', why: '얼어붙음 · 아무 말도 듣지 못한다' };
  const lock = u.lock ? unit(s, u.lock) : undefined;
  if (u.trait === 'stubborn' && o.kind === 'attack' && lock?.alive && lock.id !== o.target) return { word: '망설임', why: `고집 · 노리던 ${lock.name}부터 쏜다`, instead: { kind: 'attack', target: lock.id } };
  if (st === 'afraid') {
    const end = endOf(s, u, o).cell, ogre = foes(s).find((f) => f.kind === 'ogre');
    if (foes(s).some((f) => f.intent?.kind === 'slam' && f.intent.cells.some((c) => c.x === end.x && c.y === end.y))) return { word: '거부', why: '겁먹음 · 내려칠 자리에는 들어가지 않는다' };
    if (ogre && cheb(end, ogre.pos) <= 1) return { word: '거부', why: '겁먹음 · 오우거 곁에는 가지 않는다' };
    if (foes(s).filter((f) => cheb(end, f.pos) <= 1).length >= 2) return { word: '거부', why: '겁먹음 · 둘 이상에게 둘러싸이지 않는다' };
  }
  return { word: '따름' };
}

/** Gives an order (its place in the round's sequence is the place it is given in). Returns what the unit makes of it. */
export function give(s: Squad, id: string, o: Order | null): ReturnType<typeof verdict> {
  s.queue = s.queue.filter((q) => q.id !== id);
  if (!o) return { word: '따름' };
  if (o.kind === 'attack' && o.ult && !ultReady(s, unit(s, id)!)) o = { kind: 'attack', target: o.target };
  const v = verdict(s, id, o);
  if (v.word === '따름') s.queue.push({ id, order: o }); else if (v.instead) s.queue.push({ id, order: v.instead });
  return v;
}

const feel = (u: SUnit, delta: number, why: string, ev: SEvent[]): void => {
  if (u.kind === 'leader' || !u.alive) return;
  const was = u.fear;
  u.fear = Math.max(0, Math.min(FEAR.max, u.fear + delta));
  if (u.fear !== was) ev.push({ type: 'feel', id: u.id, delta: u.fear - was, why });
};

function hurt(s: Squad, src: SUnit, dst: SUnit, amount: number, ev: SEvent[], note?: string): void {
  const g = dst.guardedBy ? unit(s, dst.guardedBy) : undefined;
  if (g?.alive && g !== dst && cheb(g.pos, dst.pos) <= 1) {
    ev.push({ type: 'guard', id: g.id, ally: dst.id });
    feel(dst, -1, '감싸 줬다', ev);
    hurt(s, src, g, Math.max(1, amount - GUARD_SOAK), ev, '대신 맞음');
    return;
  }
  if (dst.braced) amount = Math.max(1, amount - GUARD_SOAK);
  dst.hp = Math.max(0, dst.hp - amount);
  ev.push({ type: 'hit', src: src.id, dst: dst.id, amount, note });
  if (dst.side === 'hero') feel(dst, dst.trait === 'timid' ? 2 : 1, '맞았다', ev);
  if (dst.hp > 0) return;
  dst.alive = false;
  ev.push({ type: 'down', id: dst.id });
  if (dst.side === 'hero') { for (const h of heroes(s)) feel(h, 2, `${dst.name}이(가) 쓰러졌다`, ev); if (dst.kind === 'leader') s.over = 'lost'; }
  else { feel(src, -1, '해치웠다', ev); if (!foes(s).length) s.over = 'won'; }
}

const walk = (u: SUnit, to: { cell: Cell; path: Cell[] }, ev: SEvent[]): void => { if (to.path.length) { ev.push({ type: 'move', id: u.id, path: to.path }); u.pos = to.cell; } };

function strike(s: Squad, u: SUnit, t: SUnit, ev: SEvent[], ult = false): void {
  const stand = standFor(s, u, t.pos);
  walk(u, stand, ev);
  if (!stand.inRange) return;
  if (ult) { u.ultAt = s.round + ULT_WAIT; ev.push({ type: 'say', id: u.id, text: `${ULT_NAME[u.kind]}!` }); }
  const shatter = u.kind === 'misha' && (t.chilledUntil ?? 0) >= s.round;
  if (shatter) t.chilledUntil = undefined;
  if (u.trait === 'stubborn' && !unit(s, u.lock ?? '')?.alive) u.lock = t.id;
  hurt(s, u, t, shatter ? Math.round(u.dmg * SHATTER) : u.dmg, ev, shatter ? '깨뜨림' : undefined);
  if (u.kind === 'erwen' && t.alive) { t.chilledUntil = s.round + 1; ev.push({ type: 'chill', id: t.id }); }
  if (!ult) return;
  // the flurry: a second blow on the same foe; the frost storm: the same arrow's frost and harm on every foe beside it
  if (u.kind === 'misha' && t.alive) hurt(s, u, t, u.dmg, ev, '난무');
  if (u.kind === 'erwen') for (const o of foes(s)) if (o !== t && cheb(o.pos, t.pos) <= 1) { hurt(s, u, o, u.dmg, ev, '서리 폭풍'); if (o.alive) { o.chilledUntil = s.round + 1; ev.push({ type: 'chill', id: o.id }); } }
}

/** What a companion does with no order: as its stance has it. */
export function byItself(s: Squad, u: SUnit): Order | null {
  const st = stance(u), all = foes(s);
  if (!all.length || st === 'frozen') return null;
  if (u.kind === 'leader') { const near = all.filter((f) => cheb(f.pos, u.pos) <= 1).sort((a, b) => a.hp - b.hp)[0]; return near ? { kind: 'attack', target: near.id } : null; }
  if (st === 'afraid') {
    // away from the nearest of them, toward the leader when it is all one
    const me = unit(s, 'me'), cell = (i: number): Cell => ({ x: i % s.w, y: Math.floor(i / s.w) });
    const score = (c: Cell) => Math.min(...all.map((f) => cheb(f.pos, c))) * 10 - (me?.alive ? cheb(me.pos, c) : 0);
    const best = [...reach(s, u).keys()].map(cell).sort((a, b) => score(b) - score(a))[0]!;
    return { kind: 'move', cell: best };
  }
  const lock = unit(s, u.lock ?? '');
  if (lock?.alive) return { kind: 'attack', target: lock.id };
  const f = field(s, u.pos), chilled = all.filter((x) => (x.chilledUntil ?? 0) >= s.round && standFor(s, u, x.pos).inRange)[0];
  return { kind: 'attack', target: (u.kind === 'misha' && chilled ? chilled : [...all].sort((a, b) => f[at(s, a.pos)]! - f[at(s, b.pos)]! || a.hp - b.hp)[0]!).id };
}

function act(s: Squad, u: SUnit, o: Order | null, ev: SEvent[]): void {
  if (!u.alive || s.over) return;
  if (!o) { if (stance(u) === 'frozen') ev.push({ type: 'say', id: u.id, text: '얼어붙어 움직이지 못한다' }); return; }
  if (o.kind === 'move') { walk(u, standFor(s, u, o.cell, 0), ev); return; }
  if (o.kind === 'taunt') {
    // the leader's ultimate: every goblin and the archer turn on him for the round, and he takes their blows braced
    if (!ultReady(s, u)) return;
    u.ultAt = s.round + ULT_WAIT; u.braced = true;
    for (const f of foes(s)) if (f.intent?.kind === 'chase' || f.intent?.kind === 'shoot') f.intent = { kind: f.intent.kind, target: u.id };
    ev.push({ type: 'say', id: u.id, text: `${ULT_NAME.leader}! 고블린과 궁수가 이쪽을 노린다` });
    return;
  }
  const t = unit(s, o.kind === 'attack' ? o.target : o.ally);
  if (!t?.alive) { act(s, u, byItself(s, u), ev); return; }
  if (o.kind === 'attack') { strike(s, u, t, ev, !!o.ult && ultReady(s, u)); return; }
  const stand = standFor(s, u, t.pos, o.kind === 'calm' ? CALM_REACH : 1);
  walk(u, stand, ev);
  if (!stand.inRange) return;
  if (o.kind === 'guard') { t.guardedBy = u.id; ev.push({ type: 'say', id: u.id, text: `${t.name}을(를) 감싼다` }); } else feel(t, -2, '다독임', ev);
}

function foeAct(s: Squad, f: SUnit, ev: SEvent[]): void {
  const it = f.intent, live = heroes(s);
  if (!f.alive || s.over || !it || !live.length) return;
  if (it.kind === 'slam') {
    ev.push({ type: 'slam', id: f.id, cells: it.cells });
    for (const h of live) if (it.cells.some((c) => c.x === h.pos.x && c.y === h.pos.y)) hurt(s, f, h, f.dmg, ev);
    f.winded = true;
    return;
  }
  const d = field(s, f.pos), nearest = [...live].sort((a, b) => d[at(s, a.pos)]! - d[at(s, b.pos)]!)[0]!;
  if (it.kind === 'walk') { f.winded = false; walk(f, standFor(s, f, nearest.pos), ev); return; }
  const t = unit(s, it.target)?.alive ? unit(s, it.target)! : nearest, stand = standFor(s, f, t.pos);
  walk(f, stand, ev);
  if (stand.inRange) { hurt(s, f, t, f.dmg, ev); return; }
  // its quarry out of reach: whoever stands in its way takes the blow
  const block = heroes(s).filter((h) => inRange(s, f.pos, h.pos, f.range)).sort((a, b) => a.hp - b.hp)[0];
  if (block) hurt(s, f, block, f.dmg, ev, '막아선 쪽');
}

/** What every foe will do this round, fixed now and shown: a goblin goes for the nearest by the way round, the archer for the weakest in its line, the ogre marks the ground round the nearest within two cells (and only walks the round after). */
export function setIntents(s: Squad): void {
  const live = heroes(s);
  for (const f of foes(s)) {
    if (!live.length) { f.intent = undefined; continue; }
    const d = field(s, f.pos), near = [...live].sort((a, b) => d[at(s, a.pos)]! - d[at(s, b.pos)]! || a.hp - b.hp)[0]!;
    if (f.kind === 'goblin') f.intent = { kind: 'chase', target: near.id };
    else if (f.kind === 'archer') f.intent = { kind: 'shoot', target: ([...live].filter((h) => inRange(s, f.pos, h.pos, f.range)).sort((a, b) => a.hp - b.hp)[0] ?? near).id };
    else {
      const prey = f.winded ? undefined : [...live].filter((h) => cheb(h.pos, f.pos) <= 2).sort((a, b) => cheb(a.pos, f.pos) - cheb(b.pos, f.pos))[0];
      const cells: Cell[] = [];
      if (prey) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = { x: prey.pos.x + dx, y: prey.pos.y + dy }; if (!wall(s, c) && !(c.x === f.pos.x && c.y === f.pos.y)) cells.push(c); }
      f.intent = prey ? { kind: 'slam', cells } : { kind: 'walk' };
    }
  }
}

/** Plays the round out: the party in the order its orders came (those without one after, by themselves), then the foes; then how the round leaves everyone, and the next round's intents. */
export function resolve(s: Squad): SEvent[] {
  const ev: SEvent[] = [];
  if (s.over) return ev;
  const told = new Set(s.queue.map((q) => q.id));
  for (const q of s.queue) act(s, unit(s, q.id)!, q.order, ev);
  for (const u of heroes(s)) if (!told.has(u.id)) act(s, u, byItself(s, u), ev);
  for (const f of [...foes(s)].sort((a, b) => (a.kind === 'ogre' ? -1 : 0) - (b.kind === 'ogre' ? -1 : 0))) foeAct(s, f, ev);
  for (const u of heroes(s)) { u.guardedBy = undefined; u.braced = false; if (!heroes(s).some((h) => h !== u && cheb(h.pos, u.pos) <= NEAR)) feel(u, 1, '혼자 남았다', ev); }
  s.queue = [];
  if (!s.over) { s.round++; setIntents(s); ev.push({ type: 'round', n: s.round }); }
  return ev;
}
