import { makeWeapon } from '../../sim/grid/items';
import { newState, refreshSight } from '../../sim/grid/state';
import type { Cell, FoeKind, GEvent, GridMap, GridState } from '../../sim/grid/types';

/** The move a foe has declared, shown over it. */
export interface Tag { intent?: string; stun?: boolean }
export interface Step {
  /** what the player did, and what fired from it */
  input: string;
  chain: string[];
  run?: (s: GridState) => GEvent[];
  tags: Record<string, Tag>;
  aims: [Cell, Cell][];
  /** game time (from the step's start) where the chain turns to slow motion */
  slowAt?: number;
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
const hurt = (s: GridState, id: string, frac: number) => { const f = foe(s, id); f.hp = Math.max(0, Math.round(f.maxHp * frac)); f.alive = f.hp > 0; };
const pop = (t: number, name: string): GEvent => ({ t, type: 'engrave', src: 'hero', text: name });
const shoot = (t: number, dst: string, from: Cell, to: Cell, kill: boolean, text = 'pistol', src = 'hero'): GEvent[] => [
  { t, type: 'shoot', src, dst, from: { ...from }, to: { ...to }, text },
  { t: t + 0.02, type: 'hit', src, dst, amount: 6, crit: kill, to: { ...to } },
  ...(kill ? [{ t: t + 0.02, type: 'die' as const, src, dst, to: { ...to } }] : []),
];
const slash = (t: number, dst: string, from: Cell, to: Cell, kill: boolean, amount = 8): GEvent[] => [
  { t, type: 'bump', src: 'hero', dst, from: { ...from }, to: { ...to } },
  { t: t + 0.08, type: 'hit', src: 'hero', dst, amount, crit: kill, to: { ...to } },
  ...(kill ? [{ t: t + 0.08, type: 'die' as const, src: 'hero', dst, to: { ...to } }] : []),
];

/** One slash: the blade kill fires the gun, the gun kill fires a dash; later a parry stuns and the stun calls the execution. */
const relay: Scene = {
  name: '칼 → 총 → 칼',
  setup: () => room({ x: 2, y: 3 }, [{ kind: 'minion', pos: { x: 3, y: 3 } }, { kind: 'minion', pos: { x: 4, y: 1 } }, { kind: 'brute', pos: { x: 5, y: 3 } }]),
  steps: [
    { input: '권총을 든 요원, 왼손엔 요원 칼. 고블린이 붙었고 홉고블린이 다가온다.', chain: [],
      tags: { f1: { intent: '공격' }, f2: { intent: '접근' }, f3: { intent: '접근' } }, aims: [] },
    { input: '입력: 붙은 고블린 베기 (한 번)', chain: ['칼로 처치 → 총 연계: 가장 가까운 적에게 한 발', '총으로 처치 → 칼 연계: 2칸 앞 적에게 돌진 베기', '연쇄 ×3 → 슬로모, 다음 행동 0턴'], slowAt: 0.9,
      run: (s) => {
        hurt(s, 'f1', 0); hurt(s, 'f2', 0); hurt(s, 'f3', 0.55);
        s.hero.pos = { x: 4, y: 3 };
        return [
          ...slash(0, 'f1', { x: 2, y: 3 }, { x: 3, y: 3 }, true),
          pop(0.3, '총 연계'),
          ...shoot(0.4, 'f2', { x: 2, y: 3 }, { x: 4, y: 1 }, true),
          pop(0.75, '칼 연계'),
          { t: 0.85, type: 'move', src: 'hero', from: { x: 2, y: 3 }, to: { x: 4, y: 3 }, text: 'dash' },
          ...slash(1.05, 'f3', { x: 4, y: 3 }, { x: 5, y: 3 }, false, 9),
          { t: 1.15, type: 'combo', src: 'hero', dst: 'f3', amount: 3 },
        ];
      },
      tags: { f3: { intent: '내려치기' } }, aims: [] },
    { input: '홉고블린의 내려치기 — 칼로 받아낸다', chain: ['패링 → 칼 반격 + 기절', '기절한 적 옆 → 처형: 총구를 대고 한 발'], slowAt: 0.5,
      run: (s) => {
        hurt(s, 'f3', 0);
        return [
          { t: 0, type: 'bump', src: 'f3', dst: 'hero', from: { x: 5, y: 3 }, to: { x: 4, y: 3 } },
          { t: 0.1, type: 'parry', src: 'hero', dst: 'f3' },
          pop(0.2, '되받아치기'),
          ...slash(0.3, 'f3', { x: 4, y: 3 }, { x: 5, y: 3 }, false, 5),
          { t: 0.42, type: 'stun', src: 'hero', dst: 'f3', to: { x: 5, y: 3 } },
          pop(0.6, '처형'),
          ...shoot(0.75, 'f3', { x: 4, y: 3 }, { x: 5, y: 3 }, true),
        ];
      },
      tags: {}, aims: [] },
  ],
};

/** Surrounded: one slash with two more foes adjacent fires the spin shot; a dodged bolt fires the counter shot. */
const ring: Scene = {
  name: '포위 · 회피',
  setup: () => room({ x: 4, y: 3 }, [{ kind: 'minion', pos: { x: 3, y: 3 } }, { kind: 'minion', pos: { x: 5, y: 3 } }, { kind: 'minion', pos: { x: 4, y: 4 } }, { kind: 'archer', pos: { x: 7, y: 1 } }]),
  steps: [
    { input: '고블린 셋에게 포위, 구석의 석궁병이 조준 중.', chain: [],
      tags: { f1: { intent: '공격' }, f2: { intent: '공격' }, f3: { intent: '공격' }, f4: { intent: '조준' } }, aims: [[{ x: 7, y: 1 }, { x: 4, y: 3 }]] },
    { input: '입력: 왼쪽 고블린 베기 (한 번)', chain: ['적이 둘 이상 붙은 채 베기 → 회전 사격 (충전 2)', '칼로 처치 → 총 연계: 석궁병에게 한 발', '연쇄 ×3 → 슬로모'], slowAt: 0.25,
      run: (s) => {
        hurt(s, 'f1', 0); hurt(s, 'f2', 0); hurt(s, 'f3', 0); hurt(s, 'f4', 0.5);
        const h = { x: 4, y: 3 };
        return [
          ...slash(0, 'f1', h, { x: 3, y: 3 }, true),
          pop(0.2, '회전 사격'),
          ...shoot(0.3, 'f2', h, { x: 5, y: 3 }, true, 'spin'),
          ...shoot(0.48, 'f3', h, { x: 4, y: 4 }, true, 'spin'),
          pop(0.7, '총 연계'),
          ...shoot(0.8, 'f4', h, { x: 7, y: 1 }, false),
          { t: 0.9, type: 'combo', src: 'hero', dst: 'f4', amount: 3 },
        ];
      },
      tags: { f4: { intent: '조준' } }, aims: [[{ x: 7, y: 1 }, { x: 4, y: 3 }]] },
    { input: '석궁병의 화살 — 굴러서 피한다', chain: ['회피 성공 → 반격 사격'], slowAt: 0.35,
      run: (s) => {
        hurt(s, 'f4', 0);
        s.hero.pos = { x: 4, y: 2 };
        return [
          { t: 0, type: 'shoot', src: 'f4', from: { x: 7, y: 1 }, to: { x: 4, y: 3 }, text: 'crossbow' },
          { t: 0.05, type: 'move', src: 'hero', from: { x: 4, y: 3 }, to: { x: 4, y: 2 }, text: 'roll' },
          pop(0.4, '반격'),
          ...shoot(0.55, 'f4', { x: 4, y: 2 }, { x: 7, y: 1 }, true),
        ];
      },
      tags: {}, aims: [] },
  ],
};

export const SCENES: Scene[] = [relay, ring];
export { refreshSight };
