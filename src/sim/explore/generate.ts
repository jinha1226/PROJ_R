import { createRng, type Rng } from '../../core/rng';
import type { RegionCard } from '../run/types';
import { THEME_ENEMIES, THEME_PROPS } from './themes';
import type { Dir, Exploration, Prop, Room, RoomType } from './types';

export const ROOM_HALF = { x: 12, y: 7 } as const;
const GRID = { w: 4, h: 3 };
const STEP: Record<Dir, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
export const OPPOSITE: Record<Dir, Dir> = { n: 's', s: 'n', e: 'w', w: 'e' };
export const DOOR_POS: Record<Dir, { x: number; y: number }> = {
  n: { x: 0, y: -ROOM_HALF.y }, s: { x: 0, y: ROOM_HALF.y }, e: { x: ROOM_HALF.x, y: 0 }, w: { x: -ROOM_HALF.x, y: 0 },
};
const DOOR_CLEAR = 4.2;

const id = (gx: number, gy: number) => `r${gx}_${gy}`;
/** one decimal, and never -0 (keeps JSON round-trips exact) */
const r1 = (n: number) => Math.round(n * 10) / 10 || 0;

function layout(rng: Rng, count: number): Map<string, Room> {
  const rooms = new Map<string, Room>();
  const sx = rng.int(0, GRID.w - 1);
  const sy = rng.int(0, GRID.h - 1);
  const add = (gx: number, gy: number): Room => {
    const r: Room = { id: id(gx, gy), gx, gy, type: 'battle', doors: {}, props: [], done: false };
    rooms.set(r.id, r);
    return r;
  };
  const link = (a: Room, b: Room, dir: Dir) => { a.doors[dir] = b.id; b.doors[OPPOSITE[dir]] = a.id; };
  add(sx, sy).type = 'start';
  while (rooms.size < count) {
    const frontier: [Room, Dir][] = [];
    for (const r of rooms.values())
      for (const dir of ['n', 's', 'e', 'w'] as Dir[]) {
        const [dx, dy] = STEP[dir];
        const gx = r.gx + dx, gy = r.gy + dy;
        if (gx >= 0 && gy >= 0 && gx < GRID.w && gy < GRID.h && !rooms.has(id(gx, gy))) frontier.push([r, dir]);
      }
    const [from, dir] = rng.pick(frontier);
    const [dx, dy] = STEP[dir];
    link(from, add(from.gx + dx, from.gy + dy), dir);
  }
  const extra: [Room, Room, Dir][] = [];
  for (const r of rooms.values())
    for (const dir of ['e', 's'] as Dir[]) {
      const [dx, dy] = STEP[dir];
      const o = rooms.get(id(r.gx + dx, r.gy + dy));
      if (o && !r.doors[dir]) extra.push([r, o, dir]);
    }
  for (const [a, b, dir] of rng.shuffle(extra).slice(0, rng.int(1, 2))) link(a, b, dir);
  return rooms;
}

function distances(rooms: Map<string, Room>, from: string): Map<string, number> {
  const d = new Map([[from, 0]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    for (const n of Object.values(rooms.get(cur)!.doors)) if (n && !d.has(n)) { d.set(n, d.get(cur)! + 1); q.push(n); }
  }
  return d;
}

function props(rng: Rng, card: RegionCard, room: Room): Prop[] {
  const kinds = THEME_PROPS[card.theme];
  const out: Prop[] = [];
  const doors = Object.keys(room.doors).map((d) => DOOR_POS[d as Dir]);
  for (let tries = 0; out.length < rng.int(3, 6) && tries < 60; tries++) {
    const k = rng.pick(kinds);
    const x = (rng.next() * 2 - 1) * (ROOM_HALF.x - 1.5);
    const y = (rng.next() * 2 - 1) * (ROOM_HALF.y - 1.5);
    if (doors.some((d) => Math.hypot(d.x - x, d.y - y) < DOOR_CLEAR + k.r)) continue;
    if (Math.hypot(x, y) < 4.5) continue; // keep the middle free for the enemy group
    if (out.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + k.r + 1.2)) continue;
    out.push({ kind: k.kind, x: r1(x), y: r1(y), r: k.r });
  }
  return out;
}

function enemies(rng: Rng, card: RegionCard, week: number, elite: boolean): Room['enemies'] {
  const n = Math.min(6, 1 + card.stars + Math.ceil(week / 3));
  const t = THEME_ENEMIES[card.theme];
  const ids = elite ? [...t.elite, ...Array.from({ length: Math.max(0, n - t.elite.length + 1) }, () => rng.pick(t.pool))] : Array.from({ length: n }, () => rng.pick(t.pool));
  return ids.map((enemyId, i) => {
    const a = (Math.PI * 2 * i) / ids.length + rng.next() * 0.4;
    const rad = ids.length === 1 ? 0 : 1.6 + (i % 2) * 1.1;
    return { enemyId, x: r1(Math.cos(a) * rad), y: r1(Math.sin(a) * rad * 0.8) };
  });
}

/** Rooms on a 4×3 grid: spanning tree + 1–2 loops, exit ≥3 doors from the start, elite in the farthest room (★2+). */
export function generateExploration(seed: number, week: number, card: RegionCard, party: string[]): Exploration {
  const count = Math.max(6, Math.min(10, card.rooms));
  for (let attempt = 0; ; attempt++) {
    const rng = createRng((seed * 7349 + week * 131 + attempt * 977) >>> 0);
    const rooms = layout(rng, count);
    const start = [...rooms.values()].find((r) => r.type === 'start')!;
    const d = distances(rooms, start.id);
    const byDist = [...rooms.values()].filter((r) => r !== start).sort((a, b) => d.get(b.id)! - d.get(a.id)! || (a.id < b.id ? -1 : 1));
    const far = byDist.filter((r) => d.get(r.id)! >= 3);
    const needFar = card.stars >= 2 ? 2 : 1;
    if (far.length < needFar && attempt < 40) continue;
    const exitRoom = card.stars >= 2 && far[1] ? far[1] : byDist[0]!;
    exitRoom.type = 'exit';
    if (card.stars >= 2) (exitRoom === byDist[0] ? byDist[1]! : byDist[0]!).type = 'elite';
    const rest = rng.shuffle(byDist.filter((r) => r.type === 'battle'));
    const specials: RoomType[] = ['chest', 'event', ...(count >= 7 ? (['campfire'] as RoomType[]) : []), ...(card.reward === 'gear' ? (['chest'] as RoomType[]) : []), ...(count >= 9 ? (['event'] as RoomType[]) : [])];
    specials.forEach((type, i) => { if (rest[i] && rest.length - i > 1) rest[i]!.type = type; });
    for (const r of rooms.values()) {
      r.props = r.type === 'start' ? [] : props(rng, card, r);
      if (r.type === 'battle' || r.type === 'elite') r.enemies = enemies(rng, card, week, r.type === 'elite');
    }
    return {
      seed, theme: card.theme, stars: card.stars, reward: card.reward, week, rooms: Object.fromEntries(rooms), at: start.id,
      visited: [start.id], loot: { gold: 0, items: [] }, party, rested: false,
    };
  }
}
