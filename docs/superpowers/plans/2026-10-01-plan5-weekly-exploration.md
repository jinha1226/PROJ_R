# Plan 5 — 주간 진행 · 탐험 맵 · 아이소메트릭 전투 · 밸런스

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단계 지도를 12주 진행으로 바꾸고, 탐험을 주인공이 조이패드/키보드로 걸어 다니는 구역형 3D 맵(숲·던전·묘지)으로 만들며, 적이 있는 방이 그대로 전장이 되는 아이소메트릭 전투와 새 구조 기준 밸런스를 완성한다.

**Spec:** `docs/superpowers/specs/2026-10-01-weekly-exploration-design.md` (기존 설계서 5장 대체·6.3 개정)

**Architecture:** `src/sim/week/`(주간 상태·행동), `src/sim/explore/`(탐험 맵 생성·진행·방 전투 설정) — 모두 순수·시드 결정론, `RunState` v2에 직렬화. 전투 시뮬은 `UnitSetup.spawn`(지정 좌표)과 `BattleSetup.obstacles`로 방 배치를 받는다. 3D는 `src/view/explore/`(방 지오메트리·테마 소품·안개·플레이어 이동), 입력은 `src/app/input/`(키보드+Gamepad API 통합). 기존 단계 지도 코드(`src/sim/run/mapgen.ts`, 노드 화면)는 제거하고 영입·사건·상점·휴식·전투 준비·결과·저장은 재사용.

## Global Constraints
- 이전 Plan 제약 유지(300줄, 레이어, 결정론, ko.ts, 커밋 꼬리말).
- 스펙 수치: 12주, 12주차 보스, 영입 방문 60%(2주차 확정)·후보 1~2명, 주 시작 사건 25%, 훈련 = 다음 레벨 필요량의 40%, 휴식 대화 +12(수다쟁이 +15), 지역 카드 3장, 적 단계 = 주차 + (★−1), 적 수 = min(6, 1 + ★ + ⌈주차/3⌉), 방 6~10개, 방 = 24×14m, 정예는 시작에서 먼 방, 모닥불 1회.
- 밸런스 출발점: 적 단계 성장 6%, 적 수 상한 6, 경험치 = 참전 30 + 처치 6 + 승리 20.
- 저장 키 `projr.run.v2`, `version: 2`. v1 저장은 무시.
- 입력: 키보드 + 표준 매핑 Gamepad(왼쪽 스틱 축 0/1, A=0, B=1, X=2, Y=3, LB=4, RB=5, Select=8, Start=9), 데드존 0.2.

## Review Focus
1. **탐험 중 새로고침/이탈** — 방 위치·방문·처치·상자 상태가 복원되고, 전투 도중 새로고침은 후퇴로 정산(재도전 금지).
2. **막다른 방/도달 불가 출구** — 생성된 모든 방이 시작에서 도달 가능하고 출구가 반드시 존재.
3. **조이패드 미연결·중간 분리** — 키보드만으로 모든 조작 가능, 패드 분리 시 예외 없음.
4. **전원 부상 상태에서 주 행동 선택** — 탐험 출전 0명이면 탐험 불가(훈련·휴식만), 12주차 보스는 부상자라도 출전 강제 허용.
5. **방 전투 배치가 벽·장식에 겹침** — 아군·적 스폰 좌표가 장애물·방 경계와 겹치지 않음.

---

### Task W1: 밸런스 기반 수치 + 지정 좌표 스폰
**Files:** Modify `src/sim/battle/{constants,types,setup}.ts`, `src/sim/roster/aftermath.ts`; Test `tests/sim/spawn.test.ts`
- `STAGE_SCALE` 0.08 → 0.06. 경험치: 참전 30 + 처치 6 + 승리 20(후퇴·패배 절반, 단계 보정 유지).
- `UnitSetup.spawn?: Vec2`, `UnitSetup.facing?: number` — 있으면 `slotToPos` 대신 사용.
- [ ] 테스트: spawn 지정 시 그 좌표·방향으로 시작; 없으면 기존 진형; 경험치 새 공식; 적 단계 보정 6%. 기존 테스트 기대값 갱신.

### Task W2: 주간 상태·행동
**Files:** Create `src/sim/week/{types,week,actions,training}.ts`; Modify `src/sim/run/types.ts`(RunState v2); Test `tests/sim/week.test.ts`
```ts
export type WeekPhase = 'start' | 'choose' | 'exploring' | 'report' | 'boss';
// RunState v2: version 2; week: number (1..12); phase; visitors?: Candidate[]; startEvent?: EventView; regionCards?: RegionCard[]; exploration?: Exploration;
//              shop?: { week: number; stock: ShopStock }; report?: WeekReport; (map/at/visited 제거)
export interface RegionCard { theme: 'forest' | 'dungeon' | 'graveyard'; stars: 1 | 2 | 3; reward: 'gold' | 'gear' | 'xp'; rooms: number }
export interface WeekReport { week: number; xp: Record<string, number>; moments: Moment[]; notes: { key: string; vars: Record<string, string> }[] }
export function newRunV2(seed: number, startedAt: string): RunState;           // 1주차 start
export function startWeek(run: RunState): RunState;                              // 방문 후보·주 시작 사건·지역 카드 생성, phase 'start'(보여줄 것 없으면 'choose'), 12주차면 phase 'boss'
export function trainWeek(run: RunState, ids: string[]): RunState;               // 최대 5명, 경험치 = 40% of xpToNext, 25% 훈련 사건(대련: 경쟁심 2명 → 라이벌) → report
export function restWeek(run: RunState, a?: string, b?: string): RunState;       // 전원 injury 0, 대화 → report
export function endWeek(run: RunState): RunState;                                // report 확인 후: 비출전 인원 injury −1, week+1, startWeek
export function canExplore(run: RunState): boolean;                              // 부상 아닌 생존자 ≥ 1
```
- [ ] 테스트: 1주차 시작 상태; 2주차 방문 확정·후보 1~2; 60% 방문률(200회 10%p 오차); 훈련 경험치·대련 라이벌; 휴식; 비출전 자동 회복; 12주차 phase 'boss'; 부상자만 있으면 canExplore false; 결정론·JSON 왕복.

### Task W3: 탐험 맵 생성·진행
**Files:** Create `src/sim/explore/{types,generate,progress,roomBattle,themes}.ts`; Test `tests/sim/explore.test.ts`
```ts
export type RoomType = 'start' | 'battle' | 'elite' | 'chest' | 'event' | 'campfire' | 'exit';
export interface Room { id: string; gx: number; gy: number; type: RoomType; doors: Partial<Record<'n' | 's' | 'e' | 'w', string>>; enemies?: { enemyId: string; x: number; y: number }[]; props: { kind: string; x: number; y: number; r: number }[]; done: boolean }
export interface Exploration { seed: number; theme: Theme; stars: 1 | 2 | 3; reward: RegionCard['reward']; rooms: Record<string, Room>; at: string; visited: string[]; enteredFrom?: 'n' | 's' | 'e' | 'w'; loot: { gold: number; items: string[] }; party: string[] }
export function generateExploration(seed: number, week: number, card: RegionCard, party: string[]): Exploration;
// 격자 4×3 안에 card.rooms개(6~10), 신장 트리 + 고리 1~2, 시작에서 BFS 최장 방 = 정예(★≥2)·출구는 시작에서 거리 ≥ 3, 나머지 battle 비중 ~50%, chest/event/campfire 각 1~2.
// 방 좌표계: 방 중심 (0,0), x∈[−12,12], y∈[−7,7]. 문은 변 중앙 폭 3m. 소품(엄폐물)은 문 앞 3m·스폰 구역 회피.
export function moveTo(e: Exploration, roomId: string): Exploration;            // 문으로 연결된 방만, enteredFrom 갱신, visited 추가
export function roomBattleSetup(run: RunState, e: Exploration, roomId: string, formation: Record<string, Slot>): BattleSetup;
// 아군: 진입 문 안쪽에서 진형을 진입 방향으로 회전해 spawn 지정(벽·소품과 겹치면 가까운 빈 칸으로), 적: room.enemies 좌표, obstacles: room.props
export function resolveRoom(run: RunState, roomId: string, outcome: ...): RunState;     // 전투 승리 → done·보상 누적; 상자 → 장비; 사건 → pickEvent 재사용; 모닥불 → 탐험 파티 HP 회복 플래그(다음 전투 시작 HP 100%)·부상 −1
export function leaveExploration(run: RunState): RunState;                      // 보상 지급, phase 'report'
```
- [ ] 테스트: 방 수 6~10; 모든 방 도달 가능; 출구 존재·거리 ≥ 3; ★≥2면 정예 방; 문 대칭; 소품이 문·스폰 구역과 겹치지 않음; 적 수 공식; moveTo는 문 연결만; roomBattleSetup 스폰이 경계·소품과 겹치지 않음(100시드); 결정론.

### Task W4: 테마 에셋·방 렌더러
**Files:** Modify `scripts/prepare-assets.mjs`(환경 소품 묶음), `public/assets/ART.md`; Create `src/view/explore/{themeKit,roomMesh,dungeonView,fog}.ts`; Test `tests/unit/themeKit.test.ts`
- 소품 GLB: 던전(floor_tile_large, wall*, pillar, torch*, barrel, box, chest), 숲(Medieval Hexagon nature: tree*, rock*, bush*), 묘지(Halloween: gravestone, grave_A, fence, tree_dead_*, crypt, lantern_standing). `themeKit`: 테마별 바닥·경계·장식 소품 키 → 파일, 스케일.
- `roomMesh`: 방 바닥(테마 재질), 경계(던전 벽 / 숲 나무 열 / 묘지 철책), 문 틈, 소품 인스턴스. `dungeonView`: 전체 방 배치(방 간격 30×20m, 통로 바닥), 안개(미방문 방 어둡게·실루엣).
- [ ] 테스트: 모든 테마 키가 실제 GLB 파일·manifest에 존재; 방 경계에 문 위치만 비어 있음(순수 함수 `boundarySegments`).

### Task W5: 입력·탐험 이동
**Files:** Create `src/app/input/{input,gamepad,keyboard}.ts`, `src/view/explore/{explorer,partyTrail}.ts`; Test `tests/unit/input.test.ts`, `tests/unit/partyTrail.test.ts`
```ts
export interface InputState { move: { x: number; y: number }; interact: boolean; cancel: boolean; rotateL: boolean; rotateR: boolean; menu: boolean; toggleManual: boolean; attack: boolean; skill1: boolean; skill2: boolean; ult: boolean }
export class Input { poll(): InputState; }  // 키보드 + navigator.getGamepads(), 엣지(눌린 순간) 판정, 데드존 0.2, 패드 없으면 키보드만
```
- 탐험: 주인공 이동(3.6m/s, 방 경계·소품 충돌), 동료는 경로 기록을 따라 간격 1.2m로 추적(`partyTrail`), 문 통과 시 `moveTo`, 상호작용 대상(상자·사건·모닥불·출구) 2m 내 A/E로 실행, 적 방 진입 → 전투 준비.
- [ ] 테스트: 키보드 대각 정규화; 데드존; 엣지 판정; 패드 미지원 환경 무예외; partyTrail 간격·순서.

### Task W6: 아이소메트릭 카메라·방 전투
**Files:** Modify `src/view/scene/{camera,arena}.ts`, `src/ui/screens/battleScreen.ts`/`battleRuntime.ts`(arena 옵션), `src/view/scene/cameraInput.ts`; Test `tests/unit/camera.test.ts`
- 카메라 방위 45°·고도 40° 기본, `rotateStep(±1)`(90° 부드럽게), 자동 추적·수동 팬·줌 유지(팬은 카메라 방위 기준).
- 전투 화면 옵션 `arena: { theme, room }` → 방 렌더러로 전장 구성, 장애물은 room.props.
- [ ] 테스트: 회전 후 팬 방향이 화면 기준 유지; rotateStep 4회 = 원위치.

### Task W7: 주간 UI
**Files:** Create `src/ui/week/{hubScreen,regionCards,trainScreen,reportScreen,bossIntro}.ts`, `src/ui/styles/week.css`; Modify 상점(상시) 진입점
- 허브: "N주차 · 습격까지 M주", 방문 후보(영입), 주 시작 사건, 행동 버튼 3개(탐험 불가 시 비활성+이유), 용병단·상점 버튼. 지역 카드 3장. 훈련 인원 선택(최대 5). 주 마감 보고. 12주차 보스 안내.
- [ ] E2E 일부(W9).

### Task W8: 밸런스 패스
**Files:** Create `scripts/balance.mjs`(헤드리스 측정 리포트), `tests/sim/balanceTargets.test.ts`; Modify 수치 데이터
- 측정: 표준 성장 파티(주차별 권장 레벨 = 1 + 0.6×(주차−1) 근사, 직업 혼합, 평범한 장비) × ★1~3 × 주차 2/5/8/11 × 시드 40 → 승률; 보스(레벨 7~8, 5명) 시드 60.
- 목표 미달 시 조정 대상: 적 수 공식, 단계 성장률, 보스 체력/공격, 경험치·훈련 효율. 결과 표를 `docs/balance.md`에 기록.
- [ ] 테스트: ★1 ≥ 0.85, ★2 0.6~0.8, ★3 0.4~0.6(주차 5·8), 보스 0.5~0.75 (허용 폭은 스펙보다 5%p 넓게).

### Task W9: 흐름 통합·정리·E2E
**Files:** Create `src/app/weekFlow.ts`, `tests/e2e/week.spec.ts`; Modify `src/app/{main,save}.ts`(v2), `README.md`; Delete `src/sim/run/{mapgen,state}.ts`·`src/ui/run/mapScreen.ts`·관련 테스트(재사용 모듈은 유지)
- 흐름: 타이틀 → 새 여정 → 주 시작(영입/사건) → 행동 → (탐험: 지역 → 맵 이동 → 방 → 전투 준비 → 전투 → 방 정산 → … → 귀환/출구) → 주 보고 → 레벨업 → 다음 주 … → 12주차 보스 → 결말.
- 저장 지점: 주 시작·행동 확정·방 이동·전투 시작(inBattle)·전투 정산·보고 확인. 전투 중 새로고침 = 후퇴 정산.
- E2E: 새 여정 → 2주차까지 진행(훈련) → 탐험 선택 → 키보드로 다음 방 이동 → 적 방 전투(fast-forward) → 귀환 → 보고; 새로고침 후 이어하기로 같은 주·방 복원.
- 헤드리스 전체 런: 간단한 정책으로 12주 완주 → won/lost, 결정론.
- [ ] 전체 검증 → 커밋 → 푸시 → CI·Pages
