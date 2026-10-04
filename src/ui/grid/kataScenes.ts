import { makeWeapon } from '../../sim/grid/items';
import { newState, refreshSight } from '../../sim/grid/state';
import type { Cell, FoeKind, GEvent, GridMap, GridState } from '../../sim/grid/types';

/** What the demo shows over each figure: hearts left of how many, and the move it declared (or what the plan will do to it). */
export interface Tag { h: number; m: number; intent?: string; stun?: boolean; fate?: string }
export interface Step {
  caption: string;
  /** the kata planned so far: label and slot cost */
  slots: [string, number][];
  charge: number;
  run?: (s: GridState) => GEvent[];
  tags: Record<string, Tag>;
  aims: [Cell, Cell][];
  /** the execute step: the whole round in one go */
  exec?: boolean;
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

/** Three goblins close in, a crossbow aims at the agent's cell: spin shot the ring, roll out of the line. */
const ring: Scene = {
  name: '포위 탈출',
  setup: () => room({ x: 3, y: 3 }, [{ kind: 'minion', pos: { x: 2, y: 3 } }, { kind: 'minion', pos: { x: 4, y: 2 } }, { kind: 'minion', pos: { x: 3, y: 4 } }, { kind: 'archer', pos: { x: 7, y: 3 } }]),
  steps: [
    { caption: '적 선언: 고블린 셋이 덤비고, 석궁병이 내 칸을 노린다.', slots: [], charge: 6,
      tags: { f1: { h: 1, m: 1, intent: '공격' }, f2: { h: 1, m: 1, intent: '공격' }, f3: { h: 1, m: 1, intent: '공격' }, f4: { h: 2, m: 2, intent: '조준' } }, aims: [[{ x: 7, y: 3 }, { x: 4, y: 3 }]] },
    { caption: '1~2칸: 회전 사격 (충전 3). 붙은 셋에게 한 발씩.', slots: [['회전 사격', 2]], charge: 3,
      tags: { f1: { h: 1, m: 1, fate: '처치' }, f2: { h: 1, m: 1, fate: '처치' }, f3: { h: 1, m: 1, fate: '처치' }, f4: { h: 2, m: 2, intent: '조준' } }, aims: [[{ x: 7, y: 3 }, { x: 4, y: 3 }]] },
    { caption: '3칸: 위로 구르기. 화살은 빈 칸에 꽂힌다.', slots: [['회전 사격', 2], ['구르기', 1]], charge: 3,
      tags: { f1: { h: 1, m: 1, fate: '처치' }, f2: { h: 1, m: 1, fate: '처치' }, f3: { h: 1, m: 1, fate: '처치' }, f4: { h: 2, m: 2, intent: '빗나감' } }, aims: [[{ x: 7, y: 3 }, { x: 4, y: 3 }]] },
    { caption: '실행.', slots: [['회전 사격', 2], ['구르기', 1]], charge: 3, exec: true,
      run: (s) => {
        const h = { ...s.hero.pos };
        for (const id of ['f1', 'f2', 'f3']) killed(s, id);
        s.hero.pos = { x: 3, y: 2 };
        return [
          ...shot(0, 'f1', { x: 2, y: 3 }, h), ...shot(0.22, 'f2', { x: 4, y: 2 }, h), ...shot(0.44, 'f3', { x: 3, y: 4 }, h),
          { t: 0.8, type: 'move', src: 'hero', from: h, to: { x: 3, y: 2 }, text: 'dash' },
          { t: 1.25, type: 'shoot', src: 'f4', from: { x: 7, y: 3 }, to: { x: 3, y: 3 }, text: 'crossbow' },
        ];
      },
      tags: { f4: { h: 2, m: 2, intent: '재장전' } }, aims: [] },
  ],
};

/** A hobgoblin charges, a crossbow aims: put the goblin in the charge, step aside, and let the bolt find the hobgoblin. */
const pile: Scene = {
  name: '돌진 엮기',
  setup: () => room({ x: 3, y: 3 }, [{ kind: 'brute', pos: { x: 7, y: 3 } }, { kind: 'minion', pos: { x: 3, y: 2 } }, { kind: 'archer', pos: { x: 3, y: 5 } }]),
  steps: [
    { caption: '적 선언: 홉고블린이 이 줄로 돌진, 석궁병은 아래에서 내 칸을 노린다. 고블린은 위에서 덤빈다.', slots: [], charge: 4,
      tags: { f1: { h: 3, m: 3, intent: '돌진' }, f2: { h: 1, m: 1, intent: '공격' }, f3: { h: 2, m: 2, intent: '조준' } }, aims: [[{ x: 7, y: 3 }, { x: 1, y: 3 }], [{ x: 3, y: 5 }, { x: 3, y: 3 }]] },
    { caption: '1칸: 잡기. 고블린을 돌진 줄 위(오른쪽 칸)로 끌어 놓는다.', slots: [['잡기', 1]], charge: 4,
      tags: { f1: { h: 3, m: 3, intent: '돌진' }, f2: { h: 1, m: 1, fate: '돌진에 깔림' }, f3: { h: 2, m: 2, intent: '조준' } }, aims: [[{ x: 7, y: 3 }, { x: 1, y: 3 }], [{ x: 3, y: 5 }, { x: 3, y: 3 }]] },
    { caption: '2칸: 왼쪽 위로 구르기. 돌진도 화살도 내 자리를 놓친다.', slots: [['잡기', 1], ['구르기', 1]], charge: 4,
      tags: { f1: { h: 3, m: 3, fate: '충돌 → 기절' }, f2: { h: 1, m: 1, fate: '처치' }, f3: { h: 2, m: 2, intent: '조준' } }, aims: [[{ x: 7, y: 3 }, { x: 1, y: 3 }], [{ x: 3, y: 5 }, { x: 3, y: 3 }]] },
    { caption: '3칸: 석궁병에게 권총 한 발. 기절한 홉고블린은 다음 라운드에 처형.', slots: [['잡기', 1], ['구르기', 1], ['권총', 1]], charge: 3,
      tags: { f1: { h: 3, m: 3, fate: '충돌 → 기절' }, f2: { h: 1, m: 1, fate: '처치' }, f3: { h: 2, m: 2, fate: '♥ -1' } }, aims: [[{ x: 7, y: 3 }, { x: 1, y: 3 }], [{ x: 3, y: 5 }, { x: 3, y: 3 }]] },
    { caption: '실행.', slots: [['잡기', 1], ['구르기', 1], ['권총', 1]], charge: 3, exec: true,
      run: (s) => {
        foe(s, 'f2').pos = { x: 4, y: 3 };
        s.hero.pos = { x: 2, y: 2 };
        killed(s, 'f2');
        foe(s, 'f1').pos = { x: 5, y: 3 };
        foe(s, 'f3').hp = 1;
        return [
          { t: 0, type: 'bump', src: 'hero', dst: 'f2', from: { x: 3, y: 3 }, to: { x: 3, y: 2 } },
          { t: 0.12, type: 'push', src: 'f2', from: { x: 3, y: 2 }, to: { x: 4, y: 3 } },
          { t: 0.45, type: 'move', src: 'hero', from: { x: 3, y: 3 }, to: { x: 2, y: 2 }, text: 'dash' },
          ...shot(0.8, 'f3', { x: 3, y: 5 }, { x: 2, y: 2 }, 1, false),
          { t: 1.2, type: 'move', src: 'f1', from: { x: 7, y: 3 }, to: { x: 6, y: 3 }, text: 'dash' },
          { t: 1.3, type: 'move', src: 'f1', from: { x: 6, y: 3 }, to: { x: 5, y: 3 }, text: 'dash' },
          { t: 1.42, type: 'bump', src: 'f1', dst: 'f2', from: { x: 5, y: 3 }, to: { x: 4, y: 3 } },
          { t: 1.45, type: 'hit', src: 'f1', dst: 'f2', amount: 1, crit: true, to: { x: 4, y: 3 } },
          { t: 1.45, type: 'die', src: 'f1', dst: 'f2', to: { x: 4, y: 3 } },
          { t: 1.5, type: 'stun', src: 'f1', dst: 'f1', to: { x: 5, y: 3 } },
          { t: 1.85, type: 'shoot', src: 'f3', from: { x: 3, y: 5 }, to: { x: 3, y: 3 }, text: 'crossbow' },
        ];
      },
      tags: { f1: { h: 3, m: 3, stun: true }, f3: { h: 1, m: 2, intent: '재장전' } }, aims: [] },
  ],
};

export const SCENES: Scene[] = [ring, pile];
export { refreshSight };
