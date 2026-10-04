import { makeWeapon } from '../../sim/grid/items';
import { newState, refreshSight } from '../../sim/grid/state';
import type { Cell, FoeKind, GEvent, GridMap, GridState } from '../../sim/grid/types';

/** What the demo shows over each figure: hearts left of how many, and the move it is about to make. */
export interface Tag { h: number; m: number; intent?: string; stun?: boolean }
export interface Step { caption: string; run?: (s: GridState) => GEvent[]; tags: Record<string, Tag>; aims: [Cell, Cell][]; slow?: boolean }
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

/** Kick the goblin into the crossbow's line: the bolt meant for the agent kills it. */
const fireLine: Scene = {
  name: '사선 비틀기',
  setup: () => room({ x: 2, y: 3 }, [{ kind: 'minion', pos: { x: 3, y: 2 } }, { kind: 'archer', pos: { x: 7, y: 3 } }]),
  steps: [
    { caption: '석궁병이 내 줄을 조준 중. 다음 적 차례에 화살이 날아온다. 대각선의 고블린도 날 노린다.',
      tags: { f1: { h: 1, m: 1, intent: '공격' }, f2: { h: 2, m: 2, intent: '조준' } }, aims: [[{ x: 7, y: 3 }, { x: 2, y: 3 }]] },
    { caption: '고블린을 걷어차 사선 위로.',
      run: (s) => {
        const g = foe(s, 'f1');
        const from = { ...g.pos };
        g.pos = { x: 3, y: 3 };
        return [
          { t: 0, type: 'bump', src: 'hero', dst: 'f1', from: { ...s.hero.pos }, to: from },
          { t: 0.15, type: 'push', src: 'f1', from, to: { ...g.pos } },
        ];
      },
      tags: { f1: { h: 1, m: 1 }, f2: { h: 2, m: 2, intent: '조준' } }, aims: [[{ x: 7, y: 3 }, { x: 3, y: 3 }]] },
    { caption: '적 차례: 화살이 고블린 등에 꽂힌다. 처치.', slow: true,
      run: (s) => {
        killed(s, 'f1');
        return [
          { t: 0, type: 'shoot', src: 'f2', dst: 'f1', from: { x: 7, y: 3 }, to: { x: 3, y: 3 }, text: 'crossbow' },
          { t: 0.05, type: 'hit', src: 'f2', dst: 'f1', amount: 2, crit: true, to: { x: 3, y: 3 } },
          { t: 0.05, type: 'die', src: 'f2', dst: 'f1', to: { x: 3, y: 3 } },
        ];
      },
      tags: { f2: { h: 2, m: 2, intent: '재장전' } }, aims: [] },
    { caption: '다음 턴: 충전 2로 석궁병에게 두 발.', slow: true,
      run: (s) => {
        killed(s, 'f2');
        return [
          { t: 0, type: 'shoot', src: 'hero', dst: 'f2', from: { ...s.hero.pos }, to: { x: 7, y: 3 }, text: 'pistol' },
          { t: 0.05, type: 'hit', src: 'hero', dst: 'f2', amount: 1, to: { x: 7, y: 3 } },
          { t: 0.5, type: 'shoot', src: 'hero', dst: 'f2', from: { ...s.hero.pos }, to: { x: 7, y: 3 }, text: 'burst' },
          { t: 0.55, type: 'hit', src: 'hero', dst: 'f2', amount: 1, crit: true, to: { x: 7, y: 3 } },
          { t: 0.55, type: 'die', src: 'hero', dst: 'f2', to: { x: 7, y: 3 } },
        ];
      },
      tags: {}, aims: [] },
  ],
};

/** Step aside: the hobgoblin's charge runs over the goblin behind, the stunned hobgoblin is finished with one shot. */
const charge: Scene = {
  name: '돌진 받아넘기기',
  setup: () => room({ x: 4, y: 3 }, [{ kind: 'brute', pos: { x: 7, y: 3 } }, { kind: 'minion', pos: { x: 3, y: 3 } }]),
  steps: [
    { caption: '홉고블린이 이 줄로 돌진 준비. 부딪힐 때까지 달려온다. 뒤에는 고블린.',
      tags: { f1: { h: 3, m: 3, intent: '돌진' }, f2: { h: 1, m: 1, intent: '공격' } }, aims: [[{ x: 7, y: 3 }, { x: 1, y: 3 }]] },
    { caption: '위로 한 칸 비켜선다.',
      run: (s) => { s.hero.pos = { x: 4, y: 2 }; return [{ t: 0, type: 'move', src: 'hero', from: { x: 4, y: 3 }, to: { x: 4, y: 2 } }]; },
      tags: { f1: { h: 3, m: 3, intent: '돌진' }, f2: { h: 1, m: 1 } }, aims: [[{ x: 7, y: 3 }, { x: 1, y: 3 }]] },
    { caption: '적 차례: 홉고블린이 빈자리를 지나 고블린을 들이받는다. 고블린 처치, 홉고블린 기절.', slow: true,
      run: (s) => {
        const b = foe(s, 'f1');
        b.pos = { x: 4, y: 3 };
        killed(s, 'f2');
        return [
          { t: 0, type: 'move', src: 'f1', from: { x: 7, y: 3 }, to: { x: 6, y: 3 }, text: 'dash' },
          { t: 0.12, type: 'move', src: 'f1', from: { x: 6, y: 3 }, to: { x: 5, y: 3 }, text: 'dash' },
          { t: 0.24, type: 'move', src: 'f1', from: { x: 5, y: 3 }, to: { x: 4, y: 3 }, text: 'dash' },
          { t: 0.4, type: 'bump', src: 'f1', dst: 'f2', from: { x: 4, y: 3 }, to: { x: 3, y: 3 } },
          { t: 0.45, type: 'hit', src: 'f1', dst: 'f2', amount: 1, crit: true, to: { x: 3, y: 3 } },
          { t: 0.45, type: 'die', src: 'f1', dst: 'f2', to: { x: 3, y: 3 } },
          { t: 0.5, type: 'stun', src: 'f1', dst: 'f1', to: { x: 4, y: 3 } },
        ];
      },
      tags: { f1: { h: 3, m: 3, stun: true } }, aims: [] },
    { caption: '다음 턴: 기절한 적에게 처형 사격(충전 3). 즉사.', slow: true,
      run: (s) => {
        killed(s, 'f1');
        return [
          { t: 0, type: 'shoot', src: 'hero', dst: 'f1', from: { ...s.hero.pos }, to: { x: 4, y: 3 }, text: 'pistol' },
          { t: 0.05, type: 'hit', src: 'hero', dst: 'f1', amount: 3, crit: true, to: { x: 4, y: 3 } },
          { t: 0.05, type: 'die', src: 'hero', dst: 'f1', to: { x: 4, y: 3 } },
        ];
      },
      tags: {}, aims: [] },
  ],
};

export const SCENES: Scene[] = [fireLine, charge];
export { refreshSight };
