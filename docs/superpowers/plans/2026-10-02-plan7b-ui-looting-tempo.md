# Plan 7b — 세로·가로 UI, 줌, 속도감, 루팅 개편

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 출격 화면을 모바일 세로 최우선 + 가로 레이아웃으로 만들고(회전해도 시뮬레이션 유지), 핀치·휠 줌을 넣고, 출격의 이동·전투 템포를 빠르게 하며, 루팅을 자동 획득 + 조사형 + 자동 수납으로 바꾼다.

**Spec:** `docs/superpowers/specs/2026-10-01-party-extraction-design.md` §6, §7, §12

**Architecture:** 템포는 전투 엔진의 선택 필드(`BattleSetup.tempo`, `moveScale`, 기본 1)로 지역 모드에서만 적용한다. 루팅은 `src/sim/world/{interact,autoLoot}.ts`. HUD 상태는 순수 함수 `src/ui/extract/hudState.ts`가 한 번 계산하고, 컴포넌트(파티 바·미니맵·명령 바·가치·상황 버튼)는 같은 DOM을 쓰며 **레이아웃은 CSS(`.portrait`/`.landscape`)만 두 벌**이다. 방향 판별은 `matchMedia('(orientation: portrait)')`+resize, 회전 시 WorldSim 재생성 없음. 줌은 `IsoCamera`에 배율·상하한, 입력은 `src/app/input/zoom.ts`(순수 계산) + UI 연결.

**Tech Stack:** TypeScript, three.js, Vitest, Playwright

## Global Constraints
- 기존 규칙(300줄, 계층, sim 결정론, 커밋 꼬리말). 아레나 전투 결과 불변(`engineGolden`).
- 스펙 수치: 이동 +30%(`moveScale 1.3`), 템포 ×1.33(선딜·후딜·쿨다운 ≈ −25%), 자동 획득 반경 1.5m, 조사 1초(상자·배낭·약초)/1.5초(보급)/2초(유물·보물방), 세로 버튼 최소 56px, 줌 상하한.
- 위험 시계 분 단위는 유지.

## Review Focus
1. **회전 중 상태 유지** — 세로↔가로 전환에서 WorldSim·카메라 대상·짐 창·채널 진행이 그대로이고 입력이 끊기지 않는다.
2. **핀치와 스틱 충돌** — 스틱을 잡은 채 다른 손가락으로 줌할 수 없게(스틱·버튼 위 터치는 핀치에서 제외), 두 손가락 핀치가 스틱을 만들지 않는다.
3. **자동 획득이 좋은 물건을 몰래 버리지 않음** — 칸·무게가 꽉 차면 자동 획득은 멈추고, 희귀품·장비는 절대 자동으로 줍거나 버리지 않는다.
4. **조사 중 교전 시작** — 전투 모드 진입 시 조사가 취소되고(아이템 보존), 경계 중인 동료가 먼저 반응한다.
5. **템포 변경이 다른 모드로 새지 않음** — 주간 게임·샌드박스·용병단 모드의 전투 시간과 결과가 그대로다.

---

### Task 1: 출격 템포와 이동속도
**Files:** Modify `src/sim/battle/{types,setup,actions,movement}.ts`, `src/sim/world/party.ts`; Test `tests/sim/tempo.test.ts`
- `BattleSetup.tempo?`·`moveScale?` → `BattleState.tempo`·`moveScale`(기본 1). 행동 단계 시간 ÷ tempo, 쿨다운 ÷ tempo, 이동속도 × moveScale. `createPartyWorld`가 1.33/1.3으로 설정.
- [ ] 테스트: golden 불변; 같은 스킬의 선딜 틱이 지역 모드에서 ≈ 75%; 쿨다운 ≈ 75%; 같은 입력 1초 이동 거리 ≈ 130%.

### Task 2: 루팅 개편 (자동 획득·조사 시간·자동 수납·경계)
**Files:** Create `src/sim/world/autoLoot.ts`; Modify `src/sim/world/{interact,partyCombat,follow,worldSim,extraction}.ts`, `src/data/extract/lootTables.ts`(자동 획득 규칙); Test `tests/sim/looting.test.ts`
```ts
export const AUTO_RADIUS = 1.5;
export function isAutoPick(id: string): boolean;          // 잡동사니·0~1등급 부산물·약초류·동전·보석 조각 (장비·유물·열쇠·2등급+ 제외)
export function updateAutoLoot(w: WorldState): void;      // 서 있는 파티원 1.5m 안: 바닥 더미의 자동 획득 아이템, 약초 컨테이너(조사 없이)
export const SEARCH_TICKS: Record<ContainerKind, number>; // crate/bag/herb 20, supply 30, relic/vault 40
// finishSearch: 가치 높은 순으로 자동 수납, 남거나 희귀(3등급+)면 'loot' 이벤트(선택 창), 아니면 'found' 이벤트만
```
- 전투 모드로 바뀌면 조사 채널 취소. 조사 중 추종자는 바깥을 향한다.
- [ ] 테스트: 지나가면 동전·약초 자동 획득, 장비는 그대로; 꽉 차면 멈춤(아이템 보존); 상자 조사 1초·유물 2초; 조사 후 자동 수납·창 없음, 짐 부족 시 'loot' 이벤트; 희귀품은 'loot' 이벤트; 조사 중 적 접근 → 전투 모드·조사 취소; 조사 중 추종자 시선이 바깥.

### Task 3: 공통 HUD 상태
**Files:** Create `src/ui/extract/hudState.ts`; Test `tests/unit/hudState.test.ts`
```ts
export interface HudState { party: { id; name; color; hp; down; dead; lead }[]; value: number; slots: [number, number]; weight: [number, number];
  clock: string; phase: Phase; combat: boolean; channel?: { label: string; frac: number }; prompt?: string; orders: { focus: boolean; retreat: boolean; regroup: boolean };
  minimap: { pois; extracts; party; hero; seen } }
export function hudState(w: WorldState, nearby: Nearby): HudState;
```
- [ ] 테스트: 파티 상태·리더·쓰러짐·전사; 가치·칸·무게; 시계 문자열; 채널 라벨(대기 포함); 프롬프트; 전투 아닐 때 집중 비활성 아님(기습 가능)·후퇴는 전투 중만.

### Task 4: 세로·가로 레이아웃과 회전
**Files:** Modify `src/ui/extract/{hud,sortieScreen,touchControls,bagPanel,worldRuntime}.ts`, `src/ui/styles/extract.css`; Create `src/ui/extract/{partyBar,minimap,orientation}.ts`
- HUD는 hudState만 그린다. 루트에 `.portrait`/`.landscape`. 세로: 상단 띠·하단 엄지 영역·하단 시트 짐 창. 가로: 좌측 파티·우측 정보·하단 명령. PC는 스틱 숨김. 세로 회전 안내 제거.
- 회전 시 레이아웃 클래스·카메라 시야만 바꾼다(WorldSim 유지).
- [ ] 테스트(e2e): 세로 뷰포트에서 `.portrait`·버튼 크기 ≥ 56px; 가로로 바꾸면 `.landscape`이고 같은 월드(tick 증가, 파티 그대로).

### Task 5: 줌
**Files:** Create `src/app/input/zoom.ts`; Modify `src/view/explore/exploreCamera.ts`, `src/ui/extract/{sortieScreen,worldRuntime}.ts`; Test `tests/unit/zoom.test.ts`
```ts
export const ZOOM_MIN = 7, ZOOM_MAX = 22;                 // 화면 세로 월드 높이(m)
export const clampZoom = (h: number) => …;
export function pinchHeight(start: number, d0: number, d1: number): number;   // 손가락 간격 비율로
export function wheelHeight(h: number, deltaY: number): number;
```
- 기본: 가로 11, 세로 15(세로 화면에서 좌우 시야 확보). +/− 버튼, 휠, 핀치(스틱·버튼 위 터치 제외), localStorage `projr.zoom` 기억(try/catch).
- [ ] 테스트: clamp; 핀치 확대/축소; 휠; e2e: + 버튼으로 카메라 높이 감소.

### Task 6: 타격감
**Files:** Modify `src/ui/extract/worldRuntime.ts`, `src/ui/styles/extract.css`
- 치명타·처치·아군 쓰러짐에 짧은 흔들림(IsoCamera shake), 출격 화면 데미지 숫자 확대.
- [ ] 확인: 스크린샷.

### Task 7: 밸런스·E2E·문서
**Files:** Modify `tests/sim/support/sortieBot.ts`(자동 수납 반영), `docs/balance.md`, `README.md`, `tests/e2e/extract.spec.ts`
- [ ] BALANCE 표 재측정·기록, 상시 기준 유지; e2e 전부; README 갱신.
