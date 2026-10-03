import { distanceMap } from './path';
import { makeFoe, mostCommonSpawn } from './foes';
import { DIRS, FOES, add, canStep, idx, same, tileAt, type Cell, type FoeKind, type GridState, type Room } from './types';
const contains = (r: Room, p: Cell): boolean => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const centre = (r: Room): Cell => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });

export function placeDeathSuit(s: GridState): void {
  const suit = s.run.leftSuit;
  if (!suit || suit.floor !== s.run.floor || s.run.suitPlaced) return;
  const stairs = s.map.stairs ?? s.foes.find(f => f.kind === 'champion')?.pos;
  const d = distanceMap(s.map, s.map.start);
  const rooms = s.map.rooms.filter(r => !stairs || !contains(r, stairs))
    .sort((a, b) => d[idx(s.map, centre(b))]! - d[idx(s.map, centre(a))]!);
  const free = (p: Cell): boolean => tileAt(s.map, p) === 'floor' && d[idx(s.map, p)]! >= 0
    && !same(p, s.hero.pos) && !s.foes.some(f => f.alive && same(f.pos, p))
    && !s.chests.some(c => same(c.pos, p)) && !s.barrels.some(b => same(b, p))
    && !s.traps.some(t => same(t.pos, p)) && !s.floorItems.some(f => same(f.pos, p))
    && !s.map.exits.some(e => same(e, p)) && (!stairs || !same(stairs, p));
  for (const r of rooms) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const pos = { x, y };
      if (!free(pos)) continue;
      const dir = DIRS.find(dir => canStep(s.map, pos, dir) && free(add(pos, dir)) && contains(r, add(pos, dir)));
      if (!dir) continue;
      const killer = suit.killer.kind;
      const kind: FoeKind = killer === 'champion' ? 'brute'
        : Object.hasOwn(FOES, killer) ? killer as FoeKind : mostCommonSpawn(s.run.floor);
      s.floorItems.push({ pos, item: { kind: 'suit', ids: [...suit.ids], name: '남겨진 슈트' } });
      s.foes.push(makeFoe(`f${s.nextFoeId++}`, kind, add(pos, dir), -1, s.run.floor, s.hero.nextAt, true));
      s.run.suitPlaced = true;
      s.events.push({ t: s.time, type: 'suitHere', to: { ...pos } });
      return;
    }
  }
}
