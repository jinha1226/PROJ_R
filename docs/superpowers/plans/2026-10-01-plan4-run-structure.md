# Plan 4 — 런 구조·화면·저장

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "이름 없는 모험가 → 용병단"의 한 판(런)을 처음부터 끝까지 플레이할 수 있게 한다. 지역 지도(12단계 × 3갈래), 노드 7종(전투·정예·만남·사건·휴식·상점·보스), 전투 준비(진형 배치·관계 미리보기), 용병단 화면(관계도 포함), 자동 저장·이어하기, 승리 시 용병단 이름 짓기와 명예의 전당.

**Architecture:** 런 상태 `RunState`는 JSON 직렬화 가능한 순수 데이터(`src/sim/run/`). 지도 생성·노드 처리·영입·사건·휴식·상점은 모두 `(RunState, 입력) → RunState` 순수 함수 + 시드 RNG. 전투는 Plan 3의 `companyBattleSetup`/`resolveBattle`을 재사용(진형 지정 추가). 화면은 `src/ui/run/`, 흐름 제어는 `src/app/runFlow.ts`, 저장은 `src/app/save.ts`(localStorage, try/catch).

**Spec:** `docs/superpowers/specs/2026-10-01-mercenary-roguelike-design.md` 5장(런 구조), 6.1~6.2(화면), 4.4(주인공 이름)

## Global Constraints
- Plan 1~3 제약 유지. 스펙 5장 수치: 12단계 × 3갈래, 인접 갈래로만 연결, 1단계 전투, 2단계 만남 보장, 정예 4단계부터, 휴식 6단계 전후·11단계, 12단계 보스. 출전 최대 5명, 대기 최대 3명(총 8명). 패배 = 후퇴(참전자 전원 부상, 골드 30% 손실, 보상 없음, 런 계속). 런 실패 = 주인공 사망 또는 전원 사망. 영입 후보 2~3명, 20% 확률로 기존 동료와 과거 관계.
- 경제(이 계획에서 정함): 시작 골드 60. 전투 보상 20+5×단계, 정예 40+8×단계 + 정예 장비 확정, 보스 200. 상점 가격 등급별 1:40 · 2:90 · 3:160 · 4:260, 판매가 50%, 부상 치료 30/명. 영입비: 후보 중 1명 무료, 나머지 25+10×레벨.
- 저장 키 `projr.run.v1`, 명예의 전당 키 `projr.hall.v1`, `version: 1`. localStorage 접근은 모두 try/catch(사용 불가 시 저장 없이 동작).

## Review Focus
1. **저장 데이터가 손상/구버전/없음** — 이어하기가 예외 없이 "저장 없음"으로 처리되고 새 런을 시작할 수 있어야 한다. → P6.
2. **런 도중 주인공 사망·전원 사망** — 즉시 게임오버로 전환, 지도 진행 불가. → P2/P9.
3. **용병단이 가득 찬 상태(8명)에서 만남** — 영입 버튼 비활성 + 이유 표시, 노드는 진행 가능. → P3/P8.
4. **골드 부족** — 상점·영입·치료에서 구매 불가 처리(음수 골드 금지). → P3/P5.
5. **진형에 아무도 없음/부상자만** — 출전 버튼 비활성(0명), 부상자 배치는 허용하되 표시. → P8.

---

### Task P1: 런 모델·지도 생성
**Files:** Create `src/sim/run/{types,mapgen,state}.ts`; Test `tests/sim/mapgen.test.ts`, `tests/sim/runState.test.ts`
```ts
export type NodeType = 'battle' | 'elite' | 'encounter' | 'event' | 'rest' | 'shop' | 'boss';
export interface MapNode { id: string; step: number; lane: 0 | 1 | 2; type: NodeType; next: string[] }
export interface RunMap { nodes: Record<string, MapNode>; steps: number }
export type RunStatus = 'active' | 'won' | 'lost';
export interface RunState {
  version: 1; seed: number; gold: number; roster: Roster; map: RunMap; at: string | null; visited: string[];
  status: RunStatus; companyName?: string; formation: Record<string, { col: 0 | 1 | 2; row: 0 | 1 | 2 | 3 }>;
  pending?: PendingNode; startedAt: string; namedProtagonist: boolean;
}
export function generateMap(seed: number): RunMap;
export function newRun(seed: number, startedAt: string): RunState; // 주인공 1명만, 골드 60
export function reachable(run: RunState): MapNode[]; // at=null이면 1단계 전부, 아니면 현재 노드의 next 중 미방문
export function enterNode(run: RunState, nodeId: string): RunState; // reachable 검사, at·visited 갱신, pending 생성(P2~P5가 채움)
```
- [ ] 테스트: 12단계·각 1~11단계 3노드·12단계 보스 1노드; 1단계 전부 전투, 2단계 전부 만남, 11단계 전부 휴식, 6단계에 휴식 ≥1, 정예는 4단계 이상만, 3~10단계 상점 ≥1; 연결은 인접 갈래만(|Δlane| ≤ 1), 11단계 → 보스; 모든 노드는 보스까지 도달 가능; 결정론; reachable/enterNode 규칙(도달 불가 노드 진입 시 throw).

### Task P2: 전투 노드·보상·패배 규칙·진형
**Files:** Create `src/sim/run/{encounters,battleNode,outcome}.ts`; Modify `src/sim/roster/companyBattle.ts`(formation 인자); Test `tests/sim/battleNode.test.ts`
```ts
export function enemyGroup(rng: Rng, type: 'battle' | 'elite' | 'boss', stage: number): { enemyId: string; col; row }[];
// battle: 진영(산적/언데드) 무작위, 인원 min(7, 2 + ceil(stage/2)); 1단계는 해골 졸개 2~3(튜토리얼). elite: 산적 두목 + 산적 3~5. boss: 잿빛 기사 + 해골 궁수 2.
export function battleSetupForNode(run: RunState, node: MapNode): BattleSetup; // 진형 사용(없으면 autoFormation), 단계 = node.step
export function finishBattle(run: RunState, node: MapNode, deployed: string[], report: BattleReport): { run: RunState; aftermath: Aftermath; reward: { gold: number; items: string[] } };
// victory: resolveBattle + 골드 보상 + (정예: 정예(2)+ 장비 1 추가 확정) ; boss 승리 → status 'won'
// defeat/retreat: resolveBattle(xp 절반 등) 후 참전 생존자 전원 injury ≥ 2, 골드 floor(×0.7), 전리품 제거
// 이후 주인공 사망 또는 생존 용병 0 → status 'lost'
export function checkRunEnd(run: RunState): RunStatus;
```
`companyBattleSetup(r, deployed, enemyKeyOrGroup, stage, seed, formation?)` — 그룹 배열도 받도록 확장.
- [ ] 테스트: 단계별 인원 증가·1단계 튜토리얼; 정예에 두목; 진형 반영; 승리 골드·정예 장비; 후퇴 시 부상·골드 30% 손실·전리품 없음; 주인공 사망 → lost; 보스 승리 → won; 입력 불변.

### Task P3: 만남(영입)·주인공 이름
**Files:** Create `src/sim/run/recruit.ts`; Test `tests/sim/recruit.test.ts`
```ts
export interface Candidate { merc: Mercenary; fee: number; past?: { with: string; kind: 'friend' | 'feud' | 'rival' } }
export function encounterCandidates(run: RunState, node: MapNode): Candidate[]; // 2~3명, 레벨 = max(1, round(step/2)), 1명 무료, 20% 과거 관계(살아있는 동료 중)
export function recruit(run: RunState, c: Candidate): RunState; // 총원 8 초과·골드 부족이면 throw, 관계 레코드 추가(friend 50 / feud −50 / rival true), 연대기 joined
export function nameProtagonist(run: RunState, name: string): RunState; // 1~12자, 공백 제거, 빈 값이면 '이름 없는 모험가' 유지; namedProtagonist=true, 연대기
export const ROSTER_CAP = 8;
```
- [ ] 테스트: 후보 수·무료 1명·레벨; 과거 관계 비율(200회 중 10~30%); 영입 시 골드 차감·관계 추가; 가득 참·골드 부족 throw; 이름 짓기 규칙.

### Task P4: 사건
**Files:** Create `src/data/events.ts`, `src/sim/run/events.ts`, `src/ui/i18n/koEvents.ts`; Test `tests/sim/events.test.ts`
```ts
export type EventEffect =
  | { kind: 'gold'; amount: number } | { kind: 'affinity'; a: string; b: string; amount: number }
  | { kind: 'injure'; merc: string; battles: number } | { kind: 'healAll' } | { kind: 'item'; itemId: string }
  | { kind: 'tactic'; tacticId: TacticId } | { kind: 'xp'; mercs: string[]; amount: number } | { kind: 'rival'; a: string; b: string };
export interface EventChoice { id: string; textKey: string; actor?: string; available: boolean; reasonKey?: string }
export interface EventView { eventId: string; vars: Record<string, string>; choices: EventChoice[] }
export function pickEvent(run: RunState, node: MapNode): EventView; // 조건(특정 특성 보유자 등)을 만족하는 사건 중 시드 선택; 특성 선택지는 해당 특성 보유자(공개 여부 무관)가 있을 때만 available
export function resolveEvent(run: RunState, view: EventView, choiceId: string): { run: RunState; effects: EventEffect[]; resultKey: string; vars: Record<string, string> };
```
사건 8종: 상인과 시비(다혈질 필요; 말리기/편들기/[냉정함] 중재), 부상당한 여행자(돕기/외면/[이타적] 치료→선물), 버려진 야영지(뒤지기: 장비 또는 부상/[신중함] 함정 발견→안전한 장비), 모닥불 이야기(두 명 대화 +12/[수다쟁이] 전원 +4), 수상한 도박꾼(30골드 걸기 50%/[영광 추구] 결투/거절), 훈련장(최저 레벨 2명 xp 30/[경쟁심 2명] 대련→라이벌·xp 50), 기사의 유품(전술 카드/팔기 40골드), 겁에 질린 마을(경비: 골드 30·1명 부상/[겁쟁이·보호본능] 두 사람 친밀도 +15·골드 20).
- [ ] 테스트: 조건 없는 사건만 남는 파티에서도 항상 사건이 나옴; 특성 선택지 available 판정; 각 사건의 결과가 상태에 반영(골드·친밀도·부상·장비·전술·xp·라이벌); 골드 부족 시 걸기 불가; 결정론.

### Task P5: 휴식·상점
**Files:** Create `src/sim/run/{rest,shop}.ts`; Test `tests/sim/restShop.test.ts`
```ts
export function restHeal(run: RunState): RunState; // 전원 injury 0
export function restTalk(run: RunState, a: string, b: string): RunState; // 친밀도 +12(chatty 있으면 +15), 연대기
export interface ShopStock { items: { itemId: string; price: number }[] }
export function shopStock(run: RunState, node: MapNode): ShopStock; // 5개, 등급 = 단계 기반, 시드
export function buy(run: RunState, stock: ShopStock, index: number): { run: RunState; stock: ShopStock }; // 골드 부족 throw
export function sell(run: RunState, inventoryIndex: number): RunState; // 50%
export function healOne(run: RunState, mercId: string): RunState; // 30골드, injury 0
```
- [ ] 테스트: 치료·대화 효과; 상점 결정론·가격표; 구매·판매·치료 골드 계산; 골드 부족 throw.

### Task P6: 저장·명예의 전당
**Files:** Create `src/app/save.ts`; Test `tests/unit/save.test.ts`
```ts
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export function saveRun(run: RunState, kv?: KV): boolean; export function loadRun(kv?: KV): RunState | null; export function clearRun(kv?: KV): void;
export interface HallEntry { companyName: string; protagonist: string; result: 'won' | 'lost'; step: number; survivors: { name: string; level: number; title?: string }[]; fallen: string[]; date: string; seed: number }
export function addHall(e: HallEntry, kv?: KV): void; export function loadHall(kv?: KV): HallEntry[]; // 최신순 최대 20
```
기본 kv는 `globalThis.localStorage`(없거나 예외면 메모리 없음 → false/null/[]).
- [ ] 테스트: 왕복 저장; 손상 JSON·구버전·필수 필드 누락 → null; 저장소 예외 → false; 명예의 전당 정렬·20개 제한.

### Task P7: 화면 1 — 타이틀·지도·용병단(관계도·전술)
**Files:** Create `src/ui/run/{titleScreen,mapScreen,rosterScreen,relationGraph,runHud}.ts`, `src/ui/company/rosterPanel.ts`(카드+시트+핸들러 공용화), `src/ui/styles/run.css`; Modify `companyScreen.ts`(rosterPanel 사용), `characterSheet.ts`(전술 선택: 등급별 슬롯 1/2, 보유 전술 카드 중 선택), `main.ts`(타이틀이 첫 화면)
- 타이틀: 새 런(시드 입력·무작위) / 이어하기(저장 있을 때만) / 명예의 전당 / 전투 샌드박스.
- 지도: 12열 × 3행 노드(아이콘: 전투 Swords, 정예 Skull, 만남 Users, 사건 ScrollText, 휴식 Tent, 상점 Store, 보스 Crown), 연결선 SVG, 방문/현재/도달 가능 강조, 상단 HUD(골드·단계·시드·용병단 버튼·저장 후 타이틀로).
- 용병단 화면: 카드·시트(공용) + 관계도 탭(원형 배치, 관계색 선: 친구 초록·전우 금·라이벌 주황·반목 보라·사제 하늘, 선 클릭 → 규칙 문장).
- [ ] 단위 테스트: `relationGraph`의 레이아웃·선 색 계산 순수 함수(`graphModel`).

### Task P8: 화면 2 — 전투 준비·만남·사건·휴식·상점·결과
**Files:** Create `src/ui/run/{prepScreen,formationGrid,encounterScreen,eventScreen,restScreen,shopScreen,endScreen,hallScreen}.ts`
- 전투 준비: 3×4 배치칸(왼쪽 후열 → 오른쪽 전열) + 대기 명단. 드래그 앤 드롭 + 클릭-클릭 배치(카드 선택 후 칸 클릭), 칸 클릭으로 해제. 인접 관계 미리보기(4m 이내 쌍: "친구 인접: 방어↑", "라이벌 인접: 공속·치명↑", "반목 인접: 공격↓", "전우: 연계기 「…」 가능"), 적 미리보기(종류·수), 출전(0명이면 비활성), 카드 클릭 시 시트.
- 만남: 후보 카드(직업·레벨·공개 특성·배경·과거 관계·비용), 영입(가득 참/골드 부족 시 비활성+이유), 지나가기. 첫 영입 후 주인공 이름 입력 모달.
- 사건: 본문 + 선택지(특성 선택지는 아이콘·보유자 이름, 불가 시 비활성·이유) → 결과 문장 → 계속.
- 휴식: 치료(부상자 목록) / 대화(두 명 선택).
- 상점: 판매 목록(가격·등급·효과·장착 가능 직업), 보관함 판매, 부상자 치료.
- 결과: 승리 → 용병단 이름 입력 → 결과 화면(파티·연대기 하이라이트·전사자) → 명예의 전당 기록. 패배(게임오버) → 결과 화면 → 기록. 명예의 전당 화면.
- [ ] 단위 테스트: `formationGrid`의 인접 판정·미리보기 문구 순수 함수(`adjacencyPreview`).

### Task P9: 런 흐름·E2E·전체 런 스모크
**Files:** Create `src/app/runFlow.ts`, `tests/e2e/run.spec.ts`, `tests/sim/runSmoke.test.ts`; Modify `README.md`
- runFlow: 타이틀 → 새 런/이어하기 → 지도 → 노드별 화면 → (전투: 준비 → 전투 → 결과(계속) → 전투 후 화면 → 레벨업 → 지도) → … → 승리/게임오버. 노드 진입·완료마다 자동 저장, 런 종료 시 저장 삭제 + 명예의 전당.
- E2E: 새 런(시드 고정) → 1단계 전투(fast-forward) → 결과 → 지도 → 2단계 만남에서 영입 → 주인공 이름 입력 → 지도에 영입자 반영 → 새로고침 → 이어하기로 같은 위치·골드 복원.
- 헤드리스 스모크: 간단한 정책(전투 우선 경로, 가능한 영입, 레벨업 첫 제안, 장착 가능 장비 장착, 사건 첫 선택지, 휴식 치료, 상점 통과)으로 시드 5개 완주 시도 → 예외 없이 won/lost로 끝남, 결정론, 단계 도달 분포 기록(밸런스는 Plan 5).
- [ ] 전체 검증 → 커밋 → 푸시 → CI·Pages 확인
