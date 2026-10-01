# Plan 7a — 파티 출격: 용병단·추종 이동·파티 자동전투·명령·손실

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 출격 모드를 "최대 5인 용병 파티를 이끌고 들어가 전리품과 동료를 살려 데려오는" 구조로 바꾼다. 리더만 조종하고 나머지는 추종하며, 전투는 기존 AI가 자동으로 하고 플레이어는 집중 공격·후퇴·재집결만 명령한다. 쓰러짐·영구 사망·시체 회수·부분 탈출·게임 오버까지.

**Spec:** `docs/superpowers/specs/2026-10-01-party-extraction-design.md` (1~5장, 9장, 10장의 Plan 7a 범위)

**Architecture:** 최대 재사용. `WorldState.hero`는 **파티 공통 상태**(공용 짐·채널·독 면역·은신)로 유지하고 `heroId`는 **현재 리더**를 가리킨다(`heroUnit()` = 리더). 파티원은 기존 전투 유닛(`team: 'ally'`)이며, 탐험 중에는 world가 조종(`controlled`), 전투 중에는 기존 전투 AI가 조종한다. 공용 짐은 기존 `Loadout`에 칸·무게 한도 덮어쓰기(`slots`·`carry`·`baseWeight`)를 더해 `addItem`·`putInto` 등을 그대로 쓴다. 용병 데이터·성장·부상은 기존 `Mercenary`/`addXp`/`injury`를 쓴다. 새 파일: `src/sim/extract/company.ts`(용병단·선술집·정산), `src/sim/world/{party,follow,partyCombat}.ts`.

**Tech Stack:** TypeScript, three.js, Vitest, Playwright

## Global Constraints
- 기존 규칙: 파일 300줄, 계층 core → data → sim → app → view/ui, sim에 DOM·three·`Math.random`·`Date.now` 금지, 커밋 꼬리말.
- 기존 전투(아레나) 결과 불변: `tests/sim/engineGolden.test.ts` 통과 유지. 새 전투 필드는 선택이며 생략 시 현재 동작.
- 스펙 수치: 시작 용병 3명, 용병단 최대 8, 출격 최대 5, 선술집 후보 2~3(출격마다 갱신), 추종 따라잡기 최대 +35%, 25m+ 이탈·시야 밖이면 재배치, 전투 판정 10m·종료 3초, 후퇴 3초, 재집결 2초, 탈출 반경 4m·8초·피격 시 감소, 중상 = 2회 출격 불가, 부상 1단계/출격 회복.
- 저장 키 `projr.extract.v2`(`version: 2`). v1 저장은 무시한다(출시 전).
- 출격 모드 입력: 이동(WASD·스틱·터치 스틱), 조사 E/Ⓑ, 집중 F/Ⓧ, 후퇴 R/Ⓨ(또는 LB), 재집결 G/RB, 일시정지 Esc/Start. 기본 공격·개별 스킬·자동 토글 입력은 출격 모드에서 쓰지 않는다.

## Review Focus
1. **리더 승계** — 리더가 쓰러지거나 죽는 순간 다음 서 있는 파티원이 리더가 되고, 카메라·조사·탈출 판정이 새 리더 기준으로 이어진다. 모두 쓰러지면 정확히 한 번 실패 처리.
2. **추종자가 갇히거나 영영 뒤처짐** — 좁은 문·나무 사이·벽 모서리에서도 결국 따라오고, 재배치는 화면(시야) 안에서는 일어나지 않는다.
3. **전투↔탐험 전환 깜빡임** — 경계가 짧게 끊겼다 이어져도 AI와 추종이 매 틱 번갈아 잡지 않는다(3초 유예).
4. **짐 용량 감소** — 파티원이 죽어 칸·한도가 줄면 넘친 짐은 바닥에 남고, 아이템이 사라지거나 복제되지 않는다. 시체의 장비는 시체를 조사해 되찾을 수 있다.
5. **부분 탈출 정산** — 지점 안/밖, 서 있음/쓰러짐 조합마다 귀환·중상·사망이 정확하고, 용병단 생존자 0이면 게임 오버.

---

### Task 1: 공용 짐 (기존 Loadout 확장)
**Files:** Modify `src/sim/extract/loadout.ts`; Test `tests/sim/partyPack.test.ts`
```ts
export interface Loadout { /* 기존 */ slots?: number; carry?: number; baseWeight?: number }  // 공용 짐용 덮어쓰기
// bagSlots/carryLimit: 덮어쓰기가 있으면 그 값. totalWeight: baseWeight 포함.
export function partyPack(members: Loadout[], pack: Stack[], pouch: Stack | null): Loadout;
// slots = Σ bagSlots(member), carry = Σ carryLimit(member), baseWeight = Σ 장착 무게, equipped {} · quick []
```
- [ ] 테스트: 덮어쓰기 없으면 기존 결과 동일(기존 extractInventory 테스트 그대로 통과); 3명(맨몸 6+작은 배낭 10+6)이면 22칸; 무게 한도 합; 장착 무게가 감속에 반영; 파티원 1명 빠진 팩으로 다시 만들면 칸 감소 → `settleCapacity`로 넘침이 dropped(총수량 보존).

### Task 2: 출격 용병단 프로필·선술집·정산
**Files:** Create `src/sim/extract/company.ts`; Modify `src/sim/extract/profileTypes.ts`, `src/app/extractSave.ts`(키 v2·검증); Test `tests/sim/extractCompany.test.ts`
```ts
export interface XCompany {
  version: 2; seed: number; gold: number; stash: Stack[]; pouch: Stack | null;
  mercs: Mercenary[];                       // 생존 용병 (기존 타입, injury = 부상 단계: 1 부상, 2+ 중상)
  gear: Record<string, Loadout>;            // 용병별 장착 (bag/quick 비움)
  party: string[];                          // 출격 순서(맨 앞 = 리더), 최대 5
  tavern: { merc: Mercenary; fee: number }[];
  fallen: { name: string; level: number; classId: string; sortie: number }[];
  sorties: number; extracted: number; bestHaul: number; nextId: number;
}
export function newCompany(seed: number): XCompany;                 // 용병 3명, 각자 기본 장비, 골드 80, 파티 = 3명
export function canDeploy(m: Mercenary): boolean;                    // injury < 2
export function setParty(c: XCompany, ids: string[]): XCompany;      // 생존·출격 가능·최대 5
export function hire(c: XCompany, i: number): XCompany;              // 골드·8명 제한
export function refreshTavern(c: XCompany): XCompany;                // 시드+출격 수로 2~3명
export function equipMerc / unequipMerc / stashToMerc ...             // 기존 profile 함수를 용병 단위로(무기 계열 검사·reconcileWeapon 재사용)
export interface SortieEnd { outcome: 'extracted' | 'failed'; pack: Stack[]; pouch: Stack | null; members: { id: string; state: 'home' | 'carried' | 'dead'; xp: number; gear: Loadout }[] }
export function settleCompany(c: XCompany, end: SortieEnd): { company: XCompany; lost: Stack[]; gained: Stack[]; died: string[] };
export const isGameOver = (c: XCompany) => c.mercs.length === 0;
```
- 정산: 'home' = 귀환(경험치), 'carried' = 귀환 + injury 2, 'dead' = 영구 사망(장비 상실, `fallen` 기록). 탈출 성공이면 짐 → 창고(넘침 허용), 실패면 짐 상실. 출격하지 않은 인원 injury −1, 출격한 생존자도 정산 후 −1 아님(중상만 유지). 이후 선술집 갱신.
- 상인·판매가(기본 장비 0G)·창고 넘침 규칙은 기존 merchant 재사용.
- [ ] 테스트: 신규 용병단 3명·장비·파티; 중상 용병은 파티 불가; 영입(골드·8명 제한); 정산 4가지(home/carried/dead/실패); 생존자 0 → 게임 오버; 비출격 부상 회복; 저장 왕복·v1 거부.

### Task 3: 파티 월드 상태와 리더
**Files:** Create `src/sim/world/party.ts`; Modify `src/sim/world/{types,worldState,heroRefresh,activation,perception}.ts`, `src/sim/extract/heroSetup.ts`; Test `tests/sim/party.test.ts`
```ts
export interface PartyState { order: string[]; mercs: Record<string, Mercenary>; gear: Record<string, Loadout>; mode: 'explore' | 'combat'; calmTicks: number;
  command?: { kind: 'retreat' | 'regroup'; until: number; dir?: Vec2 }; focus?: string; trail: Vec2[]; dead: string[] }
// WorldState.party: PartyState. heroId = 현재 리더. hero.loadout = partyPack(...) (공용 짐 뷰).
export function createPartyWorld(region: Region, members: { merc: Mercenary; gear: Loadout }[], pack: Stack[], pouch: Stack | null, seed: number): WorldState;
export function partyUnits(w: WorldState): UnitState[];                // 살아 있는 파티원(쓰러짐 포함), 출격 순서
export function updateLeader(w: WorldState): void;                     // 리더 쓰러짐/사망 → 다음 서 있는 파티원
export function refreshParty(w: WorldState): void;                     // 짐 무게 → 전원 이동속도, 장착 변경 반영
```
- 기존 `createWorld`(1인)는 `createPartyWorld`의 1인 경우로 대체하고 테스트도 이식한다. 활성화·발각은 리더만이 아니라 **모든 파티원**을 기준으로 한다.
- [ ] 테스트: 5인 생성 시 스폰이 출발점 주변 빈 자리; 리더 쓰러짐 → 승계(이벤트 1회); 전원 쓰러짐 → outcome 'failed' 1회; 짐이 무거우면 전원 감속; 뒤쪽 파티원이 보여도 발각.

### Task 4: 추종 이동
**Files:** Create `src/sim/world/follow.ts`; Test `tests/sim/follow.test.ts`
```ts
export const SLOT_OFFSETS: Vec2[];                         // 리더 기준(진행 방향 = +x) 뒤쪽 V자 4자리
export function updateFollow(w: WorldState): void;         // 탐험 중: 슬롯 목표(막히면 발자국 경로), NavGrid 경로, 따라잡기 가속, 시야 밖 25m+ 재배치
```
- 발자국(trail): 리더가 0.8m 이동할 때마다 기록(최근 60개).
- [ ] 테스트: 열린 들판에서 5인이 3초 안에 슬롯 근처(2m)로 정렬; 폭 4m 문을 통과해 20초 안에 전원 반대편 도달; 나무 숲 사이에서도 리더와 거리 ≤ 8m 유지(30초 측정); 리더 순간이동(40m) → 시야 밖 추종자 재배치, 시야 안이면 걸어서 따라옴; 결정론.

### Task 5: 파티 자동전투와 명령
**Files:** Create `src/sim/world/partyCombat.ts`; Modify `src/sim/battle/types.ts`(`BattleState.focusTargetId?`), `src/sim/battle/ai/considerations.ts`(집중 목표 가산), `src/sim/world/heroControl.ts`(액션 입력 제거·명령 입력), `src/sim/world/worldSim.ts`; Test `tests/sim/partyCombat.test.ts`
```ts
export interface PartyInput { move: Vec2; interact: boolean; focus: boolean; retreat: boolean; regroup: boolean }
export function updatePartyMode(w: WorldState): void;      // 경계 적이 파티원 10m 안 → combat(전원 AI), 3초 없으면 explore(추종)
export function applyCommand(w: WorldState, input: PartyInput): void;
// focus: 리더 정면 120° 안 가장 가까운 경계 적(없으면 가장 가까운 적) → b.focusTargetId, 고려 항목 +40
// retreat: 3초간 전원 world 조종, 적 무리 중심 반대 방향 8m 지점으로; regroup: 2초간 리더 슬롯으로
```
- 전투 중 스틱 입력은 리더만 직접 움직인다(입력이 있는 틱에 리더 controlled, 없으면 AI).
- [ ] 테스트: 적 발각 → 전원 intent 생성(AI 작동), 리더 입력 없으면 리더도 싸움; 전투 종료 3초 후 explore 복귀·슬롯 재집결; 경계가 1초 끊겼다 이어지면 모드 유지; focus 지정 후 원거리 파티원의 목표가 집중 대상; retreat 3초 동안 파티 중심이 적에게서 멀어짐; regroup 후 리더와 평균 거리 감소; 기존 아레나 golden 불변.

### Task 6: 파티 상호작용·시체·탈출·손실
**Files:** Modify `src/sim/world/{interact,extraction,worldSim}.ts`; Test `tests/sim/partyExtraction.test.ts`
- 조사·문·루팅은 리더 기준. 짐 = 공용 팩.
- 파티원 사망(생명줄 소진): 시체 더미 생성(그 용병 장착 장비 전부), 팩 용량 재계산 → 넘침은 리더 발밑 더미로. 사망 이벤트에 목격자(근처 파티원) 기록.
- 탈출: 반경 4m. 서 있는 파티원 중 **리더**가 지점 안이면 게이지 진행(쓰러진 파티원이 있으면 ×0.6), 피격 시 −2초(0 아래로 안 내려감). 완료 시 지점 안 파티원만 귀환(쓰러짐 = carried), 밖은 dead.
- `WorldSim.end()`: `SortieEnd` 생성(Task 2 형식).
- [ ] 테스트: 파티원 사망 → 시체 더미에 장비·팩 칸 감소·넘침 보존; 시체 조사로 장비 회수; 탈출 게이지 피격 감소·쓰러진 동료 감속; 지점 안/밖·서 있음/쓰러짐 정산 4조합; 귀환 두루마리는 파티 전원(쓰러짐 포함) 귀환.

### Task 7: 거점·출격 화면 적응 (가로 기준 최소 UI)
**Files:** Modify `src/app/extractFlow.ts`, `src/ui/extract/{hubScreen,sortieScreen,hud,bagPanel,resultScreen,worldRuntime,touchControls}.ts`, `src/app/input/{input,touch}.ts`, `src/ui/styles/extract.css`; Create `src/ui/extract/{rosterPanel,gameOverScreen}.ts`; Test `tests/unit/input.test.ts`, `tests/e2e/extract.spec.ts`
- 거점: 용병단 목록(초상 색·직업·레벨·HP·부상), 파티 편성(순서·최대 5·중상 불가), 용병 선택 시 그 용병의 장착 8부위, 창고·상인(기존), 선술집(후보·영입), 레벨업(용병별).
- 출격 HUD: 파티 상태 목록(이름·HP 막대·쓰러짐·리더 표시), 들고 있는 가치, 시간, 미니맵(파티원 점), 상황 버튼(조사), 명령(집중·후퇴·재집결). 짐 창 = 공용 팩(파티원별 장비 교체는 거점에서만, 현장은 획득·버리기·사용).
- 입력: F 집중 / R 후퇴 / G 재집결 / 패드 Ⓧ·Ⓨ·RB / 터치 버튼. 기존 공격·스킬·자동 입력은 출격 화면에서 사용하지 않는다.
- 결과: 귀환·중상·사망 용병 목록, 얻은/잃은 것. 게임 오버 화면(기록·새 용병단).
- [ ] 테스트: 명령 키 매핑; e2e — 새 용병단 3명 출격 → 상자 조사 → 탈출 → 창고 확인 / 전멸(`finish('failed')`) → 출격 인원 사망·남은 인원 유지 / 용병단 전멸 → 게임 오버 화면 / 터치 명령 버튼 표시.

### Task 8: 파티 봇·밸런스·문서
**Files:** Modify `tests/sim/support/sortieBot.ts`, `tests/sim/sortieBalance.test.ts`, `docs/balance.md`, `README.md`
- 봇: 3~5인 파티(기본 장비), 리더 이동만 제어, 전투는 자동, 위급 시 후퇴 명령, 정한 시각 귀환. 지표: 탈출률·귀환 인원·사망 수·회수 가치.
- 단독 배율(`SOLO_*`)은 파티 기준으로 재조정(파티 배율 상수로 이름 변경).
- [ ] 테스트: 상시 느슨한 기준(일찍 귀환 탈출률 ≥ 50%, 늦게 귀환보다 높음, 시간 초과 없음); BALANCE=1 표를 balance.md에 기록; README 출격 설명 갱신.
