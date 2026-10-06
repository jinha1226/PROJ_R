import { canEquip, equip, sacrifice, PACK_SIZE } from '../../src/sim/delve/gear';
import type { DelveParty } from '../../src/sim/delve/delveSim';
import { DIRS, canStep, dist, idx, same, walkable, type Cell } from '../../src/sim/grid/types';
import { kitOf } from '../../src/sim/party/classKit';
import { pickTrait } from '../../src/sim/party/partyLevel';
import { aiUltimate } from '../../src/sim/party/ultimate';
import { entOf } from '../../src/sim/party/partyCore';
import { living, orderTo } from '../../src/sim/roam/roam';

import { CATALOG } from '../../src/sim/delve/catalog';
export function supplies(p: DelveParty): void {
  for (const u of living(p)) {
    while ((u.picks ?? 0) > 0 && u.offer?.[0]) {
      if (!pickTrait(p,u.id,u.offer[0]).length) break;
    }
    const gear = p.pack.filter(it=>'def' in it)
      .sort((a,b)=>CATALOG[b.def]!.floors[0]-CATALOG[a.def]!.floors[0]);
    for (const it of gear) {
      if (!u.gear || !canEquip(u,it)) continue;
      const d=CATALOG[it.def]!;
      if(d.family&&!kitOf(u).proficient.includes(d.family))continue;
      const worn=u.gear[d.slot];
      if(!worn||d.floors[0]>CATALOG[worn.def]!.floors[0])equip(p,u.id,it.id);
    }
    for (const it of [...p.pack]) {
      if('def' in it && u.gear?.[CATALOG[it.def]!.slot]?.def===it.def) sacrifice(p,u.id,it.id);
    }
    const at=aiUltimate(p,u);
    if(at!==null){u.ultQueued=true;u.ultCell=at;}
  }
}

const cache = new WeakMap<DelveParty, { key: string; value: ReturnType<typeof buildRoutes> }>();
function routes(p: DelveParty, from: Cell) {
  const key = `${p.floor}:${from.x}:${from.y}:${p.ore}:${p.s.traps.filter((t) => t.found).length}:${living(p).map((u) => { const c = entOf(p, u.id)!.pos; return `${c.x},${c.y}`; }).join(';')}`;
  const hit = cache.get(p);
  if (hit?.key === key) return hit.value;
  const safe = buildRoutes(p, from, true);
  let fallback: ReturnType<typeof buildRoutes> | undefined;
  const getFallback = () => fallback ??= buildRoutes(p, from, false);
  const value = { distance: safe.distance.map((d, k) => d >= 0 ? d : getFallback().distance[k]!), next: (to: Cell) => safe.distance[idx(p.s.map, to)]! >= 0 ? safe.next(to) : getFallback().next(to) }; 
  cache.set(p, { key, value });
  return value;
}

/** One BFS ranks actionable destinations and supplies the next movement waypoint. */
function buildRoutes(p: DelveParty, from: Cell, safe: boolean) {
  const m = p.s.map, start = idx(m, from), prev = new Int32Array(m.tiles.length).fill(-2);
  const distance = new Int32Array(m.tiles.length).fill(-1), queue = [start];
  prev[start] = -1; distance[start] = 0;
  const occupied = new Set(living(p).map((u) => idx(m, entOf(p, u.id)!.pos)).filter((k) => k !== start));
  const traps = new Set(p.s.traps.filter((t) => t.found).map((t) => idx(m, t.pos)));
  const walking = safe ? { ...m, tiles: [...m.tiles] } : m;
  if (safe) for (const k of traps) if (k !== start) walking.tiles[k] = 'wall';
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i]!, c = { x: k % m.w, y: Math.floor(k / m.w) };
    for (const d of DIRS) {
      if (!canStep(walking, c, d)) continue;
      const next = { x: c.x + d.x, y: c.y + d.y }, n = idx(m, next);
      if (prev[n] !== -2 || occupied.has(n)) continue;
      prev[n] = k; distance[n] = distance[k]! + 1; queue.push(n);
    }
  }
  return { distance, next(to: Cell): Cell | undefined {
    let k = idx(m, to);
    if (distance[k]! <= 0) return undefined;
    while (prev[k] !== start) k = prev[k]!;
    return { x: k % m.w, y: Math.floor(k / m.w) };
  } };
}

export function navigate(p: DelveParty): string {
  if (p.combat) return 'combat';
  const heroes = living(p), lead = heroes.find((u) => u.id === p.leader) ?? heroes[0];
  if (!lead) return 'wipe';
  const from = entOf(p, lead.id)!.pos, m = p.s.map, route = routes(p, from);
  const known = (c: Cell) => Boolean(p.s.seen[idx(m, c)]);
  const candidates: { cell: Cell; label: string; score: number }[] = [];
  const add = (pos: Cell, label: string, adjacent = true) => {
    if (!known(pos)) return;
    const cells = adjacent ? [pos, ...DIRS.map((d) => ({ x: pos.x + d.x, y: pos.y + d.y }))] : [pos];
    for (const cell of cells) {
      const n = idx(m, cell), score = route.distance[n];
      if (score === undefined || score < 0) continue;
      candidates.push({ cell, label, score });
    }
  };
  for (const c of p.chests) if (!c.opened && PACK_SIZE - p.pack.length >= (c.tier === 3 ? 2 : 1)) add(c.pos, 'chest');
  for (const n of p.oreNodes) if (n.left > 0) add(n.pos, 'ore');
  if (p.shrine && !p.shrine.used) add(p.shrine.pos, 'shrine');
  for (const s of p.souls) if (!s.taken) add(s.pos, 'soul');
  if (p.pack.length < PACK_SIZE) for (const i of p.floorItems) add(i.pos, 'item', false);
  let target = candidates.sort((a, b) => a.score - b.score)[0];
  if (!target) {
    for (let k = 0; k < m.tiles.length; k++) {
      if (p.s.seen[k] || !walkable(m.tiles[k]!) || route.distance[k]! < 0) continue;
      const cell = { x: k % m.w, y: Math.floor(k / m.w) };
      if (!DIRS.some((d) => known({ x: cell.x + d.x, y: cell.y + d.y }))) continue;
      if (!target || route.distance[k]! < target.score) target = { cell, label: 'frontier', score: route.distance[k]! };
    }
  }
  if (target) {
    if (same(from, target.cell)) { for (const u of heroes) u.order = null; }
    else { const next = route.next(target.cell); if (next) orderTo(p, lead.id, next); }
    return target.label;
  }
  const stairs = m.stairs!;
  // orderTo clears other orders: preserve each issued gathering order, then apply
  // the whole batch together so range-2 followers cannot drift back out again.
  const orders = new Map<string, typeof lead.order>();
  const reserved = new Set<number>();
  for (const member of [...heroes].sort((a, b) => dist(entOf(p, a.id)!.pos, stairs) - dist(entOf(p, b.id)!.pos, stairs))) {
    const at = entOf(p, member.id)!.pos;
    if (dist(at, stairs) <= 1) {
      reserved.add(idx(m, at)); orderTo(p, member.id, at); orders.set(member.id, member.order);
      continue;
    }
    const r = member.id === lead.id ? route : routes(p, at);
    const goals = [stairs, ...DIRS.map((d) => ({ x: stairs.x + d.x, y: stairs.y + d.y }))]
      .filter((c) => r.distance[idx(m, c)]! >= 0 && !reserved.has(idx(m, c)) && !heroes.some((u) => u.id !== member.id && same(entOf(p, u.id)!.pos, c)))
      .sort((a, b) => r.distance[idx(m, a)]! - r.distance[idx(m, b)]!);
    const goal = goals[0], next = goal && r.next(goal);
    if (goal && next) {
      reserved.add(idx(m, goal)); orderTo(p, member.id, next); orders.set(member.id, member.order);
    }
  }
  for (const member of heroes) member.order = orders.get(member.id) ?? null;
  return 'stairs';
}
