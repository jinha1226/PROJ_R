# Plan 6 — 판타지 익스트랙션 시험판 (주인공 단독 출격)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 타이틀의 `출격 (시험)`으로 들어가는 독립 모드에서, 주인공 혼자 120×90m 지역에 들어가 직접 조작으로 싸우고, 칸+무게 가방에 전리품을 챙기고, 위험 시계를 보며 탈출하거나 쓰러져 전부 잃는 루프를 완성한다.

**Spec:** `docs/superpowers/specs/2026-10-01-extraction-prototype-design.md`

**Architecture:** 기존 전투 엔진(`src/sim/battle/`)을 **기본값이 현재 동작인 확장**(경계·직사각형 장애물·잠든 유닛·조작 유닛·지역 모드)으로 넓히고, 새 `src/sim/world/`가 그 엔진의 틱 함수들을 지역 층(활성화·발각·순찰·위험 시계·상호작용·탈출)과 합쳐 지역 전체를 하나의 결정론적 시뮬레이션으로 돌린다. 아이템·가방·지역 생성·전리품·거점 프로필은 순수 `src/sim/extract/` + `src/data/extract/`. 3D는 `src/view/world/`(지형 인스턴싱·유닛 풀·시야), UI는 `src/ui/extract/`(거점·HUD·루팅 창·결과·터치 조작), 흐름은 `src/app/extractFlow.ts`, 저장은 `projr.extract.v1`. 기존 주간 게임·샌드박스·방 전투는 동작 변화 없음.

**Tech Stack:** TypeScript, three.js, Vitest, Playwright (기존과 동일)

## Global Constraints
- 이전 Plan 제약 유지: 파일 300줄, 레이어 core → data → sim → app → view/ui, sim에서 three/DOM/`Math.random`/`Date.now` 금지, 한국어 문구는 ko.ts 또는 UI 모듈 상수, 커밋 꼬리말.
- 기존 동작 무변화: `BattleSetup`의 새 필드는 모두 선택이며 생략 시 현재와 같은 결과(기존 테스트 전부 그대로 통과 = 회귀 기준).
- 스펙 수치: 지역 120×90m, 관심 지점 8~10, 시야 18m, 활성 반경 25m, 탈출 8초(피격 시 초기화), 탈출 지점 2~3(하나는 8분에 닫힘), 위험 시계 0–4 낮 / 4–7 해질녘 / 6:30 경고 / 8 밤 / 10~ 마력 폭풍, 창고 40칸, 가방 6/10/14/18칸, 겹침 3~5, 무게 60%까지 무영향·100%에서 −30%·초과 줍기 불가, 뒤지기 1~2초, 현장 장비 교체 2초, 판매 = 가치·구매 = 가치×2, 안전 주머니 1칸.
- 성능 예산: 전체 유닛 ≤ 120, 동시 활성 ≤ 20, 데스크톱 60fps / 모바일 30fps.
- 저장 키 `projr.extract.v1`(`version: 1`), 거점에서만 저장. 출격 중 새로고침 = 출격 무효(출발 전 상태).
- 입력: 키보드(WASD·J/K/L/;·1~4·E·Tab·Esc) + 표준 Gamepad(A=0 공격, B=1 상호작용, X=2·Y=3 액티브, RB=5 궁극기, 십자키 12~15 퀵슬롯, Select=8 자동, Start=9 일시정지) + 터치(왼쪽 가상 스틱, 오른쪽 버튼).

## Review Focus
1. **가방이 꽉 찬/무게 초과 상태에서의 루팅·현장 교체** — 교체로 빠진 장비가 들어갈 칸이 없으면 바닥에 떨어져야 하고, 아이템이 사라지거나 복제되면 안 된다.
2. **뒤지기·탈출 게이지·귀환 두루마리 도중 피격/쓰러짐/이동** — 각각 취소·초기화되고, 쓰러지는 순간 손실 정산이 정확히 한 번 일어난다.
3. **발각 연쇄로 모두 깨어남** — 경계가 전파되어도 동시 활성 20 상한을 지키고 틱 비용이 예산 안이다.
4. **모바일 멀티터치** — 스틱을 누른 채 공격·스킬 버튼을 동시에 누를 수 있고, 세로 화면이면 가로 회전 안내가 뜬다.
5. **지형에 갇힘·도달 불가** — 생성된 모든 관심 지점·탈출 지점이 출발점에서 걸어서 도달 가능하고, 넉백·도주로 벽 안에 끼지 않는다.

---

### Task X1: 전투 엔진 확장 (기본값 = 현재 동작)
**Files:** Modify `src/sim/battle/{types,setup,constants,movement,rules,battle,engagement,projectiles}.ts`, `src/sim/battle/ai/{candidates,decide}.ts`; Create `src/sim/battle/geometry.ts`; Test `tests/sim/engineWorld.test.ts`
```ts
export interface Bounds { minX: number; maxX: number; minY: number; maxY: number }
export interface Obstacle { pos: Vec2; radius: number; kind: 'rock' | 'pillar' | 'box'; half?: Vec2 }   // box: 축 정렬 직사각형(half = 반 너비·반 높이)
export interface BattleSetup { /* 기존 */ bounds?: Bounds; mode?: 'arena' | 'world' }
export interface UnitSetup { /* 기존 */ controlled?: boolean }      // true면 AI 판단 생략(입력이 조종)
export interface UnitState { /* 기존 */ dormant: boolean }           // true면 판단·이동·교전·타깃 후보에서 제외
export interface BattleState { /* 기존 */ bounds: Bounds; mode: 'arena' | 'world' }
// geometry.ts
export function pushOutOfObstacle(p: Vec2, r: number, o: Obstacle): Vec2;     // 원/박스 공통
export function segmentBlocked(s: BattleState, a: Vec2, b: Vec2): boolean;     // 박스·기둥이 시선을 막는가
export function clampToBounds(b: Bounds, p: Vec2, margin: number): Vec2;
```
- `ARENA` 상수 사용처(movement clamp, candidates clampToArena)를 `s.bounds`로 교체. 기본 bounds = 현재 ARENA.
- `mode: 'world'`: 광폭화(BERSERK)·`MAX_TICKS`·팀 전멸 판정 끔(`checkOutcome` 무동작).
- 잠든 유닛: `decide`·`moveUnits`·`updateEngagement` 건너뜀, `foesOf`/`friendsOf`/`unitsInRadius`에서 제외. 투사체는 비행 중인 것만 진행.
- 박스 장애물: 이동 충돌·도주/회피 목적지 보정·`useCover`·원거리 스킬 시야(시선 막히면 사격 후보 inRange=false).
- [ ] 테스트: 기존 시나리오 3종(헤드리스 결과 해시)이 확장 전과 동일; bounds 지정 시 그 안으로 클램프; 박스 충돌(모서리·내부 시작 시 밀어냄); segmentBlocked; dormant 유닛은 움직이지도 타깃되지도 않음; controlled 유닛은 intent 없음; world 모드는 300초 넘어도·적 0명이어도 outcome null.

### Task X2: 익스트랙션 아이템 데이터
**Files:** Create `src/data/extract/{types,gear,goods}.ts`, `src/data/extract/index.ts`; Test `tests/unit/extractItems.test.ts`
```ts
export type GearSlot = 'weapon' | 'head' | 'chest' | 'hands' | 'feet' | 'belt' | 'trinket' | 'bag';
export type ItemKind = 'gear' | 'consumable' | 'part' | 'junk' | 'relic' | 'key';
export interface XItemDef {
  id: string; kind: ItemKind; tier: 0 | 1 | 2 | 3 | 4; value: number; weight: number; stack: number;   // stack 1 = 겹침 없음
  slot?: GearSlot; weaponType?: WeaponType; stats?: Partial<Stats>; unique?: UniqueId;
  visual?: { weapon?: string; offhand?: string; helmet?: boolean; cape?: boolean };
  belt?: { quickSlots: 1 | 2 | 3 | 4 }; bag?: { slots: 6 | 10 | 14 | 18; carry: number };
  use?: { kind: 'heal'; frac: number } | { kind: 'antidote'; sec: number } | { kind: 'smoke'; radius: number } | { kind: 'recall'; sec: number };
}
export function xitem(id: string): XItemDef;     // 없으면 throw
export const X_ITEMS: Record<string, XItemDef>;
```
- 장비: 6무기형 × 등급 0~4(무기형별 최소 3개), 머리·가슴·장갑·신발 각 4~5개, 벨트 4(퀵슬롯 1~4), 가방 4(6/10/14/18칸, 무게 한도 20/30/40/55), 장신구 5(기존 고유 효과 재사용).
- 소모품: 체력 포션(소·중), 해독제, 연막탄, 귀환 두루마리(희귀). 부산물(해골·산적 기반 — 뼈 조각, 해골 가루, 흐린 영혼석, 산적 휘장 등), 잡동사니 6+, 유물 4+(무겁고 비쌈), 보물방 열쇠.
- 무료 기본 장비 세트 상수 `STARTER_KIT`(낡은 무기 직업별, 누더기 가슴, 맨몸 주머니 = 가방 없음 6칸 취급).
- [ ] 테스트: 모든 장비에 slot·등급별 가치 단조 증가; 무기형마다 0등급 존재; 가방·벨트 수치가 스펙과 일치; stack ∈ {1,3,5}; 모든 아이템 value>0·weight≥0; id 유일.

### Task X3: 가방·장착·무게 규칙
**Files:** Create `src/sim/extract/{inventory,loadout}.ts`; Test `tests/sim/extractInventory.test.ts`
```ts
export interface Stack { id: string; n: number }
export interface Loadout { equipped: Partial<Record<GearSlot, string>>; bag: Stack[]; quick: (Stack | null)[]; pouch: Stack | null }
export function bagSlots(l: Loadout): number;            // 가방 장비 없으면 6
export function quickSlots(l: Loadout): number;          // 벨트 없으면 1
export function carryLimit(l: Loadout): number;          // 가방 없으면 15
export function totalWeight(l: Loadout): number;         // 장착 + 가방 + 퀵 + 주머니
export function speedMult(l: Loadout): number;           // ≤60% 1.0, 100% 0.7, 선형
export function carriedValue(l: Loadout): number;        // 잃을 수 있는 가치(주머니 제외)
export function addItem(l: Loadout, id: string, n?: number): { loadout: Loadout; added: number };   // 겹침 우선, 칸·무게 초과분은 added에서 제외
export function removeAt(l: Loadout, where: 'bag' | 'quick' | 'pouch', index: number, n?: number): { loadout: Loadout; taken: Stack };
export function equipFromBag(l: Loadout, index: number, classWeapon: WeaponType): { loadout: Loadout; dropped: Stack[] };  // 빠진 장비가 들어갈 자리 없으면 dropped
export function loseOnDeath(l: Loadout): Loadout;        // 주머니만 남김
```
- 가방을 벗으면 칸 수가 줄어 넘치는 스택은 dropped. 벨트 교체 시 넘치는 퀵슬롯도 동일.
- [ ] 테스트: 겹침·칸 초과·무게 초과 부분 추가; speedMult 경계(60%, 80%, 100%); 가방/벨트 교체 시 넘침 → dropped(아이템 보존: 전후 총수량 동일); 무기형 불일치 장착 거부; loseOnDeath; carriedValue 주머니 제외.

### Task X4: 길찾기 격자
**Files:** Create `src/sim/world/nav.ts`; Test `tests/sim/nav.test.ts`
```ts
export class NavGrid {
  constructor(bounds: Bounds, obstacles: Obstacle[], cell?: number, clearance?: number);   // 1m, 0.4m
  walkable(p: Vec2): boolean;
  path(from: Vec2, to: Vec2): Vec2[] | null;        // 8방향 A*, 시선 직선화, 막혀 있으면 null
  reachable(from: Vec2): (p: Vec2) => boolean;      // 플러드필(생성 검증용)
}
```
- 결정론(동점 시 좌표 순), 120×90 격자에서 경로 1회 < 5ms(헤드리스 측정 테스트는 느슨하게 50ms).
- [ ] 테스트: 직선 가능 시 1~2점; 벽 우회; 막힌 목적지 null; 박스 모서리 통과 시 clearance 유지; 같은 입력 같은 경로.

### Task X5: 지역 생성
**Files:** Create `src/sim/extract/{region,poi,regionLayouts}.ts`; Test `tests/sim/region.test.ts`
```ts
export type PoiKind = 'ruins' | 'camp' | 'nest' | 'temple' | 'vault' | 'swamp' | 'boss';
export interface Container { id: string; kind: 'crate' | 'supply' | 'relic' | 'bag' | 'herb' | 'vault'; pos: Vec2; table: string; tier: number }
export interface Spawn { id: string; enemyId: string; pos: Vec2; stage: number; group: string; patrol?: Vec2[] }
export interface Poi { id: string; kind: PoiKind; name: string; center: Vec2; radius: number; risk: 1 | 2 | 3; door?: { box: Obstacle; key: string } }
export interface Region {
  seed: number; bounds: Bounds; obstacles: Obstacle[]; props: { ref: string; pos: Vec2; rot: number; scale: number }[];
  pois: Poi[]; containers: Container[]; spawns: Spawn[]; extracts: { id: string; pos: Vec2; radius: number; closesAt?: number }[];
  hazards: { kind: 'poison'; center: Vec2; radius: number }[]; start: Vec2;
}
export function generateRegion(seed: number, tier?: number): Region;
```
- 레이아웃 틀 3종(길 십자 / 강+다리 / 절벽 협곡), 120×90 경계는 나무·절벽 띠. 관심 지점 8~10: 폐허 2~3, 캠프 1~2, 둥지 1~2, 신전 1, 보물방 1(문 = 박스 장애물, 열쇠는 다른 지점 컨테이너에), 늪 0~1, 보스 1(가장 먼 곳). 최소 간격 22m.
- 구조물: 폐허·신전·보물방 벽은 박스 장애물(문 틈 3m), 숲·묘지 소품은 원형 장애물. 맵 곳곳 작은 컨테이너 10~16개.
- 적: 지점 위험도별 수비대(산적·해골 계열, 무리 ID 공유), 순찰조 2~3개(지점 사이 길 경로). 탈출 지점 2~3(가장자리, 하나는 `closesAt: 8분`), 출발점은 탈출 지점과 다른 가장자리.
- [ ] 테스트(40시드): 지점 수·간격; 모든 지점·탈출·컨테이너가 출발점에서 `NavGrid.reachable`; 보물방 열쇠가 보물방 밖 컨테이너에 존재; 적·컨테이너가 장애물 안에 없음; 보스가 출발점에서 가장 먼 지점; 유닛 총수 ≤ 120; 결정론·JSON 왕복.

### Task X6: 전리품 표
**Files:** Create `src/sim/extract/loot.ts`, `src/data/extract/lootTables.ts`; Test `tests/sim/extractLoot.test.ts`
```ts
export function rollContainer(c: Container, seed: number, minute: number): Stack[];    // 지점 위험도·컨테이너 종류·후반 보너스(8분 이후 등급 +1 확률)
export function rollDrop(enemyId: string, stage: number, seed: number): Stack[];       // 시체 전리품
```
- [ ] 테스트: 같은 입력 같은 결과; relic 상자 평균 가치 > crate(1000회); 8분 이후 평균 가치 상승; vault는 유물 1개 이상 보장; herb는 소모품·잡동사니만.

### Task X7: 지역 시뮬레이션 — 상태·활성화·발각·순찰
**Files:** Create `src/sim/world/{types,worldState,activation,perception,patrol}.ts`; Test `tests/sim/worldAi.test.ts`
```ts
export interface WorldState {
  b: BattleState; region: Region; tick: number; heroId: string;
  groups: Record<string, { alerted: boolean; home: Vec2; spawns: string[] }>;
  ai: Record<string, { mode: 'idle' | 'patrol' | 'alert' | 'return'; wp: number; path?: Vec2[]; repathIn: number }>;
  containers: Record<string, { opened: boolean; items: Stack[] }>; piles: { id: string; pos: Vec2; items: Stack[] }[];
  hero: { loadout: Loadout; channel?: { kind: 'search' | 'extract' | 'recall' | 'equip' | 'drink'; ticks: number; total: number; target?: string };
          poisonImmuneUntil: number; hiddenUntil: number };
  doorsOpen: string[]; events: WorldEvent[]; outcome: 'extracted' | 'downed' | null; xp: number;
}
export function createWorld(region: Region, hero: Mercenary, loadout: Loadout, seed: number): WorldState;
export function updateActivation(w: WorldState): void;   // 영웅 25m 안 또는 경계 무리 → 활성, 최대 20(가까운 순), 나머지 dormant
export function updatePerception(w: WorldState): void;   // 시야 부채꼴 100°·10m(밤 7m) + 근접 3m, segmentBlocked면 불가, hidden이면 불가 → 무리 전체 alert
export function updatePatrol(w: WorldState): void;       // 비경계: 순찰 경로 따라 이동(NavGrid), 경계: 전투 AI, 집에서 20m+ & 영웅 8m 밖 → return(경계 해제)
```
- 활성 상한 초과 시 먼 유닛부터 잠재움(경계여도). 사냥꾼(폭풍 스폰)은 leash 없음.
- [ ] 테스트: 25m 밖은 dormant, 다가가면 깨어남; 상한 20 유지(경계 무리 3개 동시); 뒤·벽 너머에서는 발각 안 됨; 한 명 발각 → 무리 전체 alert; 멀리 도주 → return 후 idle 복귀; 순찰조가 경로를 순환.

### Task X8: 지역 시뮬레이션 — 주인공 조작·상호작용·시계·탈출
**Files:** Create `src/sim/world/{heroControl,interact,clock,extraction,worldSim}.ts`; Test `tests/sim/worldSim.test.ts`
```ts
export interface HeroInput { move: Vec2; attack: boolean; skill1: boolean; skill2: boolean; ult: boolean; quick: number | null; interact: boolean; auto: boolean }
export class WorldSim {
  constructor(region: Region, hero: Mercenary, loadout: Loadout, seed: number);
  readonly w: WorldState;
  step(input: HeroInput): void;                         // 20틱/초, outcome 이후 무동작
  lootTake(containerOrPile: string, index: number): boolean;   // 일시정지/루팅 창에서 호출(칸·무게 규칙)
  lootDrop(where: 'bag' | 'quick', index: number): void;       // 발밑 더미로
  equip(index: number): void;                            // 2초 채널
  snapshot(radius: number): Snapshot;                    // 영웅 주변 유닛만
}
```
- 조작: 이동 = 입력 × 이동속도 × `speedMult`; 공격/스킬 = 바라보는 방향 120° 안 사거리 내 가장 가까운 적(없으면 사거리 내 가장 가까운 적, 그것도 없으면 범위 스킬은 정면 앞 지점, 단일 대상은 무동작) → `startAction`. `auto: true`면 controlled 해제(기존 AI).
- 상호작용: 컨테이너 2m → 뒤지기 1.5초(이동·피격 시 취소) → 열림(`rollContainer`, 분 단위 시각); 시체 → `rollDrop`; 잠긴 문 + 열쇠 → 문 박스 제거(`doorsOpen`); 탈출 지점 안 → 8초 채널(피격 시 0으로); 퀵슬롯 사용: 포션 0.8초 후 회복, 해독제 즉시, 연막탄 반경 12m 무리 return + hidden 4초, 귀환 두루마리 10초 채널(피격 취소) → 탈출.
- 시계: 4분 순찰조 +2(지점 사이), 6:30 경고 이벤트, 8분 `closesAt` 탈출 지점 닫힘·시야 축소·지점 수비대 단계 +2 스폰 1무리, 10분부터 60초마다 사냥꾼 무리(정예, 단계 계속 증가)가 영웅 쪽 가장자리에서 출현.
- 독안개: 영역 안 초당 최대 체력 3% 피해(해독제 면역).
- 종료: 영웅 downed → `outcome 'downed'`, 탈출/귀환 완료 → `'extracted'`. 처치 경험치 누적.
- [ ] 테스트: 입력 이동·무게 감속; 정면 우선 자동 조준; 뒤지기 취소(이동·피격); 탈출 8초·피격 초기화·닫힌 지점 무효; 귀환 두루마리; 열쇠로 문 열림 후 통행 가능; 시계 이벤트 시각; 독 피해·해독제; downed 즉시 종료 1회; 같은 입력 기록 재생 → 같은 결과(결정론); 성능: 120유닛 지역에서 1200틱(1분) 헤드리스 < 3초.

### Task X9: 거점 프로필·상인·정산·저장
**Files:** Create `src/sim/extract/{profile,merchant}.ts`, `src/app/extractSave.ts`; Test `tests/sim/extractProfile.test.ts`
```ts
export interface XProfile { version: 1; seed: number; hero: Mercenary; gold: number; stash: Stack[]; loadout: Loadout; sorties: number; extracted: number; bestHaul: number }
export function newProfile(seed: number): XProfile;                 // 견습, 기본 장비, 골드 50
export function claimStarterKit(p: XProfile): XProfile;             // 비어 있는 슬롯만 채움(무료, 무제한)
export function stashMove(p: XProfile, from: ..., to: ...): XProfile;   // 창고 ↔ 장착/가방/퀵/주머니
export function canSortie(p: XProfile): { ok: boolean; reason?: string };   // 창고 40칸 초과면 불가
export function settleSortie(p: XProfile, end: { outcome: 'extracted' | 'downed'; loadout: Loadout; xp: number }): { profile: XProfile; lost: Stack[]; gained: Stack[] };
export function sell(p: XProfile, stashIndex: number, n?: number): XProfile;   // 가치 그대로
export function buy(p: XProfile, itemId: string): XProfile;                    // 가치 ×2, 상인 목록 = 소모품 + 0~1등급 장비
// extractSave.ts: saveProfile / loadProfile(검증) / clearProfile — 키 projr.extract.v1
```
- 경험치 → 기존 `addXp`/레벨업 제안 재사용(거점에서 선택).
- [ ] 테스트: 신규 프로필; 기본 장비 수령은 빈 칸만; 탈출 → 가방·장착이 프로필로(창고 넘쳐도 보존, canSortie false); 쓰러짐 → 주머니만 남고 lost 목록 정확; 판매·구매 골드; 저장 왕복·손상 저장 거부.

### Task X10: 지역 렌더링
**Files:** Create `src/view/world/{terrain,instancing,unitPool,visionMask,worldMarkers}.ts`; Modify `src/view/explore/envAssets.ts`(여러 테마 동시 로드); Test `tests/unit/unitPool.test.ts`
- 지형: 바닥 평면(레이아웃별 색 구역) + 소품을 참조별 `InstancedMesh`로 묶음(GLB 메시별 인스턴싱). 박스 장애물 = 던전 벽 모델 반복 배치.
- 유닛 풀: 영웅 30m 안 스냅샷 유닛에만 Actor 할당, 멀어지면 회수·재사용(모델 종류별 풀). 기존 보간·이펙트(eventRouter, damageNumbers, telegraphFx) 재사용.
- 시야: 영웅 중심 반경 18m 밖을 어둡게 하는 마스크(밤엔 12m), 미니맵용 방문 격자.
- 마커: 컨테이너(상자 모델 + 열림 상태), 탈출 지점 링(닫히면 붉게), 독안개 원, 바닥 더미.
- 장갑·신발·벨트 외형: 모델 메시 구조를 확인해 해당 메시가 있으면 등급 색, 없으면 생략(판정을 ledger에 기록).
- [ ] 테스트: unitPool 할당·회수·재사용(three 객체는 가짜 팩토리 주입); 시야 반경 함수.

### Task X11: 입력 확장·터치 조작
**Files:** Modify `src/app/input/input.ts`; Create `src/ui/extract/touchControls.ts`; Test `tests/unit/input.test.ts`(추가)
- `InputState`에 `quick: number | null`(1~4 / 십자키), 공격 J·클릭, 액티브 K·L, 궁극기 `;`, 자동 Tab/Select 추가.
- 터치: `pointer: coarse`일 때 표시. 왼쪽 절반 첫 터치 위치에 가상 스틱(반경 60px, 데드존 0.15), 오른쪽 큰 공격 버튼 + 스킬 2 + 궁극기, 위쪽 퀵슬롯, 상호작용 버튼은 대상 근처일 때만. 멀티터치(pointerId별 추적). `Input`에 `virtual` 소스로 합류. 세로 화면이면 회전 안내.
- [ ] 테스트: 새 키 매핑; 가상 스틱 벡터·데드존; 두 포인터 동시(스틱+공격) 상태 합성.

### Task X12: 거점·HUD·루팅 창·결과 UI와 흐름
**Files:** Create `src/ui/extract/{itemCell,hubScreen,sortieScreen,hud,lootPanel,resultScreen}.ts`, `src/ui/styles/extract.css`, `src/app/extractFlow.ts`; Modify `src/app/main.ts`, `src/ui/run/titleScreen.ts`
- 아이템 칸: 아이콘(종류별) + **등급 테두리 색**(회색/초록/파랑/보라/주황) + 겹침 수, 최소 48px, 탭/클릭/패드 포커스 동일 동작.
- 거점: 창고 40칸, 장착 8부위, 퀵슬롯, 안전 주머니, 무게·칸 표시, 상인(사기·팔기), 기본 장비 받기, 레벨업 선택, `출격`.
- 출격 화면: WorldSim 고정 틱 구동(BattlePlayer 방식, 일시정지 = 틱 정지), HUD(체력, **들고 있는 가치**, 시계·단계, 미니맵, 퀵슬롯, 탈출/뒤지기 게이지, 경고 알림), 루팅 창(컨테이너 ↔ 가방, 꺼내기·버리기·장착), 일시정지 메뉴(가방 정리, 거점으로 = 출격 무효 확인).
- 결과: 탈출 → 가져온 목록·가치·경험치 / 쓰러짐 → 잃은 목록. → 거점.
- 흐름: 타이틀 `출격 (시험)` → 프로필 로드/생성 → 거점 → 로딩 → 출격 → 결과 → 정산 저장 → 거점. 디버그 훅 `window.__PROJR_WORLD__ = { finish(outcome), teleport(x,y), tick() }`.
- [ ] 확인: lint·typecheck·전체 테스트 통과, 수동 스크린샷(거점·출격·루팅·결과).

### Task X13: 봇 출격·밸런스·E2E·문서
**Files:** Create `tests/sim/support/sortieBot.ts`, `tests/sim/sortieBalance.test.ts`(BALANCE=1 전용 보고 + 상시 느슨한 목표), `tests/e2e/extract.spec.ts`; Modify `README.md`, `docs/balance.md`
- 봇: 주인공 AI 전투(`auto`), 가장 가까운 미방문 지점 → 컨테이너 전부 뒤지기(가치 높은 것부터 칸·무게 판단, 넘치면 가치 낮은 것 버림) → `leaveAt`분 또는 체력 35% 미만 또는 가방 가득이면 가장 가까운 열린 탈출 지점.
- 목표(40시드, 기본 장비): `leaveAt 6` 탈출률 60~70%, `leaveAt 10+` 30% 미만, 평균 회수 가치가 시간에 따라 증가, 평균 출격 시간 6~11분. 적 단계·무리 크기·사냥꾼 간격으로 조정하고 결과를 balance.md에 기록.
- e2e: 새 프로필 → 출격 → `__PROJR_WORLD__.teleport`로 상자 옆 → E로 뒤지기 → 루팅 창에서 꺼내기 → 탈출 지점 텔레포트 → 8초 대기 → 결과 → 창고에 아이템; 쓰러짐(`finish('downed')`) → 장착 장비 상실·주머니 유지; 출격 중 새로고침 → 출발 전 상태; 터치 에뮬레이션에서 스틱·공격 버튼 표시.
- README에 `출격 (시험)` 조작·규칙 추가.
- [ ] 테스트: sortieBalance 상시 목표(느슨: leaveAt 6 탈출률 ≥ 45%, leaveAt 12 ≤ 50%, 두 값의 차 ≥ 20%p); e2e 전부 통과.
