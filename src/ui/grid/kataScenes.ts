import { makeWeapon } from '../../sim/grid/items';
import { newState, refreshSight } from '../../sim/grid/state';
import type { Cell, FoeKind, GEvent, GridMap, GridState } from '../../sim/grid/types';

/** What the demo shows over each figure: hearts left of how many, and the move it is about to make with the time left. */
export interface Tag { h: number; m: number; intent?: string; stun?: boolean }
export interface Step {
  caption: string;
  /** the choices this turn and their time cost; the picked one is marked */
  opts?: [string, boolean][];
  /** clock and suit charge shown in the panel head */
  clock: number; charge: number;
  run?: (s: GridState) => GEvent[];
  tags: Record<string, Tag>;
  aims: [Cell, Cell][];
  slow?: boolean;
}
export interface Scene { name: string; setup: () => GridState; steps: Step[] }

const ROOM = ['#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];

function room(hero: Cell, foes: { kind: FoeKind; pos: Cell }[]): GridState {
  const m: GridMap = { w: ROOM[0]!.length, h: ROOM.length, tiles: [], rooms: [], start: hero, exits: [], chests: [], spawns: foes.map((f, i) => ({ kind: f.kind, pos: f.pos, group: i + 1 })), barrels: [] };
  for (const row of ROOM) for (const c of row) m.tiles.push(c === '#' ? 'wall' : 'floor');
  const s = newState(m, 7, 'pistol', 2);
  s.hero.gear.hands[1] = { ...makeWeapon('dagger', 1), name: '요원 칼' };
  s.foes.forEach((f) => { f.awake = true; });
  return s;
}

const foe = (s: GridState, id: string) => s.foes.find((f) => f.id === id)!;
const killed = (s: GridState, id: string) => { const f = foe(s, id); f.hp = 0; f.alive = false; };
const shot = (t: number, dst: string, to: Cell, from: Cell, dmg = 1, kill = true, src = 'hero', text = 'pistol'): GEvent[] => [
  { t, type: 'shoot', src, dst, from: { ...from }, to: { ...to }, text },
  { t: t + 0.02, type: 'hit', src, dst, amount: dmg, crit: kill, to: { ...to } },
  ...(kill ? [{ t: t + 0.02, type: 'die' as const, src, dst, to: { ...to } }] : []),
];

/** Surrounded by three: one move puts a round point-blank into each. */
const spin: Scene = {
  name: '회전 사격',
  setup: () => room({ x: 4, y: 3 }, [{ kind: 'minion', pos: { x: 3, y: 3 } }, { kind: 'minion', pos: { x: 5, y: 2 } }, { kind: 'minion', pos: { x: 4, y: 4 } }]),
  steps: [
    { caption: '고블린 셋에게 포위됐다. 0.8 뒤부터 차례로 덤빈다.', clock: 0, charge: 6,
      opts: [['베기 1.0 — 하나 처치, 나머지 둘에게 맞음 (♥ -2)', false], ['권총 0.6 — 하나 처치, 둘에게 맞음', false], ['회전 사격 0.8 · 충전 3 — 붙은 적 전부에게 한 발씩', true]],
      tags: { f1: { h: 1, m: 1, intent: '공격 0.8' }, f2: { h: 1, m: 1, intent: '공격 1.0' }, f3: { h: 1, m: 1, intent: '공격 1.2' } }, aims: [] },
    { caption: '회전 사격: 돌면서 총구를 하나씩 들이댄다.', clock: 0.8, charge: 3, slow: true,
      run: (s) => {
        const h = s.hero.pos;
        for (const id of ['f1', 'f2', 'f3']) killed(s, id);
        return [...shot(0, 'f1', { x: 3, y: 3 }, h), ...shot(0.18, 'f2', { x: 5, y: 2 }, h), ...shot(0.36, 'f3', { x: 4, y: 4 }, h)];
      },
      tags: {}, aims: [] },
    { caption: '0.8 만에 셋 정리. 한 대도 안 맞았다. 대신 충전이 3 남았다 — 다음 방까지 아껴야 한다.', clock: 0.8, charge: 3, tags: {}, aims: [] },
  ],
};

/** Grab the goblin as a shield against the bolt, then roll out and put two quick rounds into the reloading archer. */
const shield: Scene = {
  name: '인간 방패 · 구르며 쏘기',
  setup: () => room({ x: 2, y: 3 }, [{ kind: 'minion', pos: { x: 2, y: 2 } }, { kind: 'archer', pos: { x: 6, y: 3 } }]),
  steps: [
    { caption: '석궁병이 1.2 뒤에 내 줄로 쏜다. 위의 고블린은 1.0 뒤에 덤빈다.', clock: 0, charge: 4,
      opts: [['권총 두 발 1.2 — 석궁병 처치, 하지만 고블린에게 맞고 화살도 맞음', false], ['구르기 1.0 — 화살은 피하지만 고블린이 따라붙음', false], ['잡기 0.4 — 고블린을 끌어와 방패로', true]],
      tags: { f1: { h: 1, m: 1, intent: '공격 1.0' }, f2: { h: 2, m: 2, intent: '조준 1.2' } }, aims: [[{ x: 6, y: 3 }, { x: 2, y: 3 }]] },
    { caption: '잡기 0.4: 고블린을 사선 위로 끌어다 앞에 세운다. 붙잡힌 고블린은 공격 못 한다.', clock: 0.4, charge: 4,
      run: (s) => {
        const g = foe(s, 'f1');
        g.pos = { x: 3, y: 3 };
        return [
          { t: 0, type: 'bump', src: 'hero', dst: 'f1', from: { ...s.hero.pos }, to: { x: 2, y: 2 } },
          { t: 0.12, type: 'push', src: 'f1', from: { x: 2, y: 2 }, to: { x: 3, y: 3 } },
        ];
      },
      tags: { f1: { h: 1, m: 1, intent: '붙잡힘' }, f2: { h: 2, m: 2, intent: '조준 0.8' } }, aims: [[{ x: 6, y: 3 }, { x: 3, y: 3 }]] },
    { caption: '화살이 방패가 된 고블린에게 꽂히는 순간, 구르며 쏘기 0.8: 위로 굴러 나가며 재장전 중인 석궁병에게 두 발.', clock: 1.2, charge: 2, slow: true,
      run: (s) => {
        killed(s, 'f1');
        killed(s, 'f2');
        s.hero.pos = { x: 3, y: 2 };
        return [
          ...shot(0, 'f1', { x: 3, y: 3 }, { x: 6, y: 3 }, 2, true, 'f2', 'crossbow'),
          { t: 0.25, type: 'move', src: 'hero', from: { x: 2, y: 3 }, to: { x: 3, y: 2 }, text: 'dash' },
          ...shot(0.5, 'f2', { x: 6, y: 3 }, { x: 3, y: 2 }, 1, false),
          ...shot(0.75, 'f2', { x: 6, y: 3 }, { x: 3, y: 2 }, 1, true),
        ];
      },
      tags: {}, aims: [] },
    { caption: '1.2 동안 두 마리. 권총이 빨라서 석궁병의 재장전보다 먼저 끊었다. 도끼였다면 못 했다.', clock: 1.2, charge: 2, tags: {}, aims: [] },
  ],
};

export const SCENES: Scene[] = [spin, shield];
export { refreshSight };
