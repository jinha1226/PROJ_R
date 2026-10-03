import type { MetaState } from './meta';
import { newState } from './state';
import { add, canStep, same, type GAction, type GEvent, type GridMap, type GridState } from './types';
export const STATIONS = { pod: '복제 포드', armory: '무기고', suitlab: '슈트 공방', records: '기록 보관소', nav: '항법 콘솔', core: '에너지 코어', hatch: '출격 해치' } as const;
export type StationId = keyof typeof STATIONS;
const LETTERS: Record<string, StationId> = { P: 'pod', A: 'armory', S: 'suitlab', R: 'records', N: 'nav', C: 'core', H: 'hatch' };
const DECK = [
  '###############',
  '#.............#',
  '#.A....R....N.#',
  '#.............#',
  '#.............#',
  '#.P....C....H.#',
  '#.............#',
  '#.............#',
  '#.S...........#',
  '#.............#',
  '###############',
];
export function shipState(meta: MetaState): GridState {
  const map: GridMap = { w: 15, h: 11, tiles: [], rooms: [{ x: 1, y: 1, w: 13, h: 9 }], start: { x: 2, y: 5 }, stations: [], exits: [], chests: [], spawns: [] };
  DECK.forEach((row, y) => [...row].forEach((letter, x) => {
    map.tiles.push(letter === '#' ? 'wall' : 'floor');
    const id = LETTERS[letter];
    if (id) map.stations!.push({ id, pos: { x, y } });
  }));
  const s = newState(map, 1);
  s.mode = 'ship';
  s.records = [...meta.records];
  s.seen.fill(1);
  s.visible = new Set(map.tiles.map((_, i) => i));
  return s;
}
/** Ship actions bypass dungeon clocks, regeneration, danger and combat entirely. */
export function shipAct(s: GridState, a: GAction): GEvent[] {
  s.events = [];
  if (a.kind !== 'move' || Math.max(Math.abs(a.dir.x), Math.abs(a.dir.y)) !== 1 || !canStep(s.map, s.hero.pos, a.dir)) return s.events;
  const to = add(s.hero.pos, a.dir);
  const station = s.map.stations?.find(p => same(p.pos, to));
  if (station) s.events.push({ t: 0, type: 'station', src: 'hero', text: station.id, to });
  else {
    s.events.push({ t: 0, type: 'move', src: 'hero', from: { ...s.hero.pos }, to });
    s.hero.pos = to;
  }
  return s.events;
}
