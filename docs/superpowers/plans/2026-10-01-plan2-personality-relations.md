# Plan 2 — 플레이 피드백 반영 + 성격·감정·관계

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) 사용자 피드백 3건(카메라 조작, 화면 내 현재 행동 표시, 직관적 상태 아이콘)을 반영하고, (B) 성격 특성 12종·감정 6종·관계 5종·전우 연계기를 실제 전투 행동으로 구현해 화면에서 알아볼 수 있게 한다.

**Architecture:** 성격·관계는 `src/sim/personality/`에 모으고 Plan 1의 레지스트리(고려 요소, 능력치 보정, 피해 보정)와 새 레지스트리(반응기 reactor, 기세 보정, 치명타 방어 lethal guard)에 등록하는 방식으로 붙인다. 전투 중 관계 행동은 `relation_trigger` 이벤트로 내보내고 view가 아이콘·연결선·말풍선으로 연출한다. 전투 후 관계 변화는 순수 함수 `applyBattleToRelations`로 계산한다(영속화는 Plan 4).

**Tech Stack:** Plan 1과 동일 + `lucide`(ISC, SVG 아이콘).

**Spec:** `docs/superpowers/specs/2026-10-01-mercenary-roguelike-design.md` (3장 성격·관계, 6.3 연출)

## Global Constraints
- Plan 1 제약 전부 유지(300줄, 레이어 규칙, 결정론, ko.ts 문자열 집중, 커밋 꼬리말).
- 성격·관계 수치는 스펙 3장 표의 값을 그대로 사용: 친구 ≥40, 전우 ≥80 & 함께한 전투 ≥10, 반목 ≤−40, 사제 레벨 차 ≥4 & ≥30, 근접 반경 4m, 친구 위험 기준 HP 30%.
- 관계는 아군끼리만 존재. 쌍 키는 정렬된 `"idA|idB"`.
- 화면의 아이콘은 lucide SVG(이모지 금지 — 헤드리스·일부 OS에서 깨짐).

## Review Focus
1. **관계 대상이 전투에 없음/이미 사망** — 관계 레코드가 있어도 상대가 출전하지 않았거나 죽었으면 발동하지 않아야 한다. → B5 테스트.
2. **감정 중첩·상충** — 공포 중 용기, 분노 중 냉정함, 복수 대상 사망 등. 상충 시 규칙대로 해소되고 영구 고착되지 않아야 한다. → B3 테스트.
3. **연계기 도중 파트너가 쓰러짐** — 리더 행동은 계속되거나 취소되되 파트너 상태가 꼬이지 않아야 한다. → B6 테스트.
4. **카메라 수동 조작 후 전장 밖으로 이탈** — 팬은 전장 경계로 제한, 줌은 범위 제한. → A1 테스트.
5. **관계 레코드가 없는 기존 프리셋** — Plan 1 프리셋·테스트가 그대로 통과해야 한다(성격 없음 = 기존 행동). → 전체 회귀.

---

## Part A — 플레이 피드백

### Task A1: 카메라 수동 조작
**Files:** Modify `src/view/scene/camera.ts`; Create `src/view/scene/cameraInput.ts`; Modify `src/ui/hud/controls.ts`, `src/ui/screens/battleScreen.ts`, `src/ui/screens/battleRuntime.ts`, `src/ui/i18n/ko.ts`; Test `tests/unit/camera.test.ts`

**Interfaces:**
```ts
// camera.ts (추가)
export class BattleCamera {
  readonly mode: 'auto' | 'manual';
  zoomBy(factor: number): void;        // height *= factor, [6, 24] 클램프, 수동 전환
  panBy(dx: number, dz: number): void; // 월드 단위, 중심을 x∈[-13,13], z∈[-8,8]로 클램프, 수동 전환
  panScreen(dxPx: number, dyPx: number, viewW: number, viewH: number): void; // 화면 픽셀 드래그 → 월드 이동(고도각 보정)
  resetAuto(): void;
  // frame(): mode==='auto'일 때만 추적. 흔들림은 두 모드 모두 적용.
}
// cameraInput.ts
export function attachCameraInput(el: HTMLElement, cam: BattleCamera, onClick: (x: number, y: number) => void): () => void;
// 휠: zoomBy(1.1^sign) · 좌/우/가운데 드래그(이동 5px 초과 시 드래그로 판정): panScreen · 5px 이하 좌클릭: onClick(유닛 선택)
// 키: WASD/방향키 팬(초당 12m, rAF 대신 keydown 반복으로 1m씩), Q/E 줌, C 자동 복귀. 반환 함수는 리스너 해제.
```
HUD: 컨트롤에 `자동 카메라`(data-testid="camera-auto") 버튼, 수동 모드일 때 강조.

- [ ] 테스트 `tests/unit/camera.test.ts`: zoomBy가 [6,24] 클램프 + 수동 전환; panBy가 경계 클램프; 수동 모드에서 frame()이 중심을 움직이지 않음; resetAuto 후 frame()이 다시 추적. (OrthographicCamera는 Node에서 동작)
- [ ] FAIL 확인 → 구현 → PASS → 커밋 `Add manual camera pan/zoom with auto-follow reset`

### Task A2: lucide 아이콘 + 직관적 상태 아이콘
**Files:** Create `src/view/overlay/icons.ts`; Modify `src/view/overlay/unitOverlay.ts`, `overlay.css`; Test `tests/unit/icons.test.ts`

**Interfaces:**
```ts
export type IconKey = TagId | `intent:${IntentKind}` | `emotion:${EmotionId}` | `relation:${RelationTriggerKind}`;
export const ICONS: Record<IconKey, { icon: IconNode; color: string; label: string }>; // label = ko 이름
export function iconSvg(key: IconKey, size?: number): string; // <svg> 문자열 (lucide createElement → outerHTML)
```
태그 매핑: marked→Target(주황), knockdown→ArrowDownToLine(회갈), wet→Droplets(파랑), stun→Star(노랑), burn→Flame(주황빨강), bleed→Droplet(진홍), slow→Snail(보라), shield→Shield(하늘), taunted→Megaphone(빨강).
의도 매핑: attack→Sword, skill→Sparkles, approach→Footprints, kite→Undo2, dodge→Wind, rescue→HandHeart, guard→ShieldHalf, idle→Ellipsis, retreat→Flag, protect→ShieldPlus, flee→Rabbit.
감정: rage→Angry, fear→Frown, elation→Laugh, revenge→Skull, resolve→BicepsFlexed, courage→Medal. 관계 트리거: protect→ShieldPlus, rivalry→Flame, revenge→Skull, courage→Medal, combo→Link, feud→HeartCrack, mentor→Crown.
오버레이 태그 줄: 원형 배지(배경=색, 흰 아이콘 12px), `title` 속성에 한국어 이름.
- [ ] 테스트: 모든 TagId·IntentKind·EmotionId·RelationTriggerKind 키가 ICONS에 존재, iconSvg가 `<svg` 로 시작.
- [ ] FAIL → 구현(이모지/글자 배지 제거) → PASS → 커밋 `Show status effects as lucide icon badges`

### Task A3: 화면 안에 현재 행동 표시
**Files:** Modify `unitOverlay.ts`, `overlay.css`, `battleRuntime.ts`, `controls.ts`, `ko.ts`; Create `src/view/fx/targetLineFx.ts`; Test `tests/unit/intentLabel.test.ts`

**Interfaces:**
```ts
// unitOverlay.ts
export function intentLabel(intent: Intent | null, nameOfTarget: (id: string) => string): { icon: IconKey; text: string } | null;
// attack → '공격 → {대상}', skill → '{스킬명} → {대상}', approach → '접근 → {대상}', kite '거리 벌림', dodge '회피', rescue '구출 → {대상}',
// guard '호위', protect '엄호 → {대상}', flee '도망', idle → null(표시 안 함)
```
- 모든 살아있는 유닛 이름표 위에 의도 줄(아이콘+짧은 문구). 적은 아이콘만, 아군은 아이콘+문구.
- 선택된 유닛은 발밑에서 목표까지 바닥 선(`TargetLineFx`, 아군 파랑/적 빨강 점선).
- HUD 토글 `행동 표시`(data-testid="toggle-intent", 키 H). 기본 켬.
- [ ] 테스트: intentLabel 각 kind 문구, idle → null.
- [ ] FAIL → 구현 → PASS. E2E 스크린샷으로 확인. 커밋 `Show unit intents in-world with target line`

---

## Part B — 성격·감정·관계

### Task B1: 데이터·타입
**Files:** Create `src/data/traits.ts, emotions.ts, combos.ts`; Modify `src/data/types.ts, presets.ts`, `src/sim/battle/types.ts, setup.ts`, `src/ui/i18n/ko.ts` (+ `src/ui/i18n/barks.ts`); Test `tests/unit/personalityData.test.ts`

```ts
// data/types.ts 추가
export type TraitId = 'reckless'|'cautious'|'protective'|'coward'|'competitive'|'vengeful'|'hotheaded'|'calm'|'glory'|'loner'|'chatty'|'altruist';
export type EmotionId = 'rage'|'fear'|'elation'|'revenge'|'resolve'|'courage';
export type RelationKind = 'friend'|'comrade'|'rival'|'feud'|'mentor';
export type RelationTriggerKind = 'protect'|'rivalry'|'revenge'|'courage'|'combo'|'feud'|'mentor';
export interface Relation { a: string; b: string; affinity: number; rival: boolean; battlesTogether: number; contests: number }
export interface TraitDef { id: TraitId; affinityMult: number; likes: TraitId[]; dislikes: TraitId[] }
export interface EmotionDef { id: EmotionId; durationSec: number; statMult: Partial<Stats>; momentumMult: number }
export interface ComboDef { id: string; classes: [ClassId, ClassId]; lead: ClassId; skill: string; partnerSkill: string; cooldown: number }
```
- traits.ts: 12종. affinityMult: chatty 1.5, loner 0.5, 나머지 1. likes: protective→[coward, altruist], altruist→[coward, protective], coward→[protective, altruist], calm→[hotheaded]. dislikes: cautious↔reckless, hotheaded↔hotheaded, glory↔glory.
- emotions.ts: rage(5s, atk×1.2, def×0.8), fear(4s, moveSpeed×1.1), elation(6s, momentumMult 1.5), revenge(8s, atk×1.25), resolve(—, 1회 버팀), courage(6s).
- combos.ts: 8쌍 + generic. 스킬은 `data/skills/combo.ts`에 정의(kind 'active', aiValue 0 — AI 후보가 아니라 연계 시스템이 시전):
  warrior+mage `shield_chant`(리더 mage: 원형 r3 대상 지점, 텔레그래프, dmg 2.4 + burn; 파트너 warrior: taunt r4 + 자기 보호막), rogue+crossbow `mark_snipe`(리더 crossbow: 투사체 dmg 3.0, marked 반응 +1.5; 파트너 rogue: mark_for_death 효과), berserker+warrior `hammer_anvil`(리더 berserker: dash + dmg 2.2, knockdown 반응 +1.5; 파트너 warrior: shield_bash 효과), priest+warrior `holy_bulwark`(리더 priest: 아군 r5 shield 0.3 + heal 2; 파트너 warrior: taunt), mage+priest `purging_storm`(리더 mage: r3 wet + dmg 1.6; 파트너 priest: judgment 효과), rogue+berserker `blood_hunt`(리더 rogue: dmg 2.5 + bleed; 파트너 berserker: charge 효과), crossbow+mage `fire_arrows`(리더 crossbow: r3 텔레그래프 dmg 2.0 + burn; 파트너 mage: water_splash 없이 cast 애니만—효과 없음 `combo_assist`), berserker+priest `zealot_charge`(리더 berserker: dash + dmg 2.0; 파트너 priest: 리더에게 heal 3 + shield 0.2). generic `joint_strike`(리더: dmg 2.0, 파트너: dmg 1.2 같은 대상).
- `UnitSetup`에 `traits: TraitId[]`, `level: number` 추가(기본 [] / 1). `BattleSetup`에 `relations?: Relation[]`.
- presets: `AllyPresetMember`에 `traits?: TraitId[]`, `level?: number`. `ALLY_PRESETS`에 `bonds`(관계 시연) 추가 + `ALLY_RELATIONS: Record<string, Relation[]>`(프리셋 키별, 멤버 인덱스 기반 id `a0..`).
  bonds: a0 브란 warrior Lv5 [protective, calm], a1 오웬 priest Lv1 [altruist, coward], a2 카엘 berserker [competitive, hotheaded], a3 유나 rogue [competitive, reckless], a4 세린 mage [vengeful, chatty].
  관계: a0|a1 affinity 60(친구+사제), a2|a3 rival true affinity 10, a0|a4 affinity 85 battles 12(전우), a3|a4 affinity −50(반목).
  standard 프리셋에도 특성 부여(브란 [protective], 카엘 [hotheaded], 리아 [cautious], 세린 [chatty], 오웬 [altruist]), 관계 없음.
- barks.ts: 트리거별 한국어 대사 3~4개(`protect`, `rivalry`, `rivalKill`, `revenge`, `courage`, `fear`, `rage`, `combo`, `feud`, `rescued`, `downedFriend`). 선택은 view에서 `Math.random`(연출 전용).
- ko.ts: trait/emotion/relation/trigger 이름과 설명, 관계 규칙 문장(`ruleProtect: '{a}는 {b}가 위험하면 엄호한다'` 등), reason 키 추가(`protectFriend, rivalry, revenge, fear, rage, glory, comboPair`).
- [ ] 테스트: 모든 콤보 스킬 존재·클래스 쌍 유일, 모든 trait/emotion ko 이름, bonds 관계가 멤버 id를 참조, likes/dislikes가 유효한 TraitId.
- [ ] FAIL → 구현 → PASS → 커밋

### Task B2: 관계 상태·레지스트리 확장
**Files:** Create `src/sim/personality/relations.ts`, `src/sim/battle/reactors.ts`; Modify `src/sim/battle/{types,setup,stats,damage,battle}.ts`; Test `tests/sim/relations.test.ts`

```ts
// relations.ts
export const pairKey: (a: string, b: string) => string;
export function relationKinds(r: Relation, levelA: number, levelB: number): Set<RelationKind>; // 스펙 3.3 기준값
export function relationOf(s: BattleState, a: string, b: string): Relation | undefined;
export function hasRelation(s: BattleState, a: UnitState, b: UnitState, kind: RelationKind): boolean; // 둘 다 살아있고 출전 중일 때만
export function partners(s: BattleState, u: UnitState, kind: RelationKind): UnitState[]; // id 정렬
// BattleState에 relations: Map<string, Relation> 추가(createState가 setup.relations로 채움, 양쪽 모두 출전한 쌍만)
// reactors.ts
export type Reactor = (s: BattleState, events: BattleEvent[]) => void; // 이번 틱 이벤트를 보고 반응
export const reactors: Reactor[]; export function registerReactor(r: Reactor): void; export function runReactors(s: BattleState): void;
// stats.ts 추가: momentumModifiers 레지스트리(registerMomentumModifier(u,s)=>number), damage.gainMomentum이 곱함
// damage.ts 추가: lethalGuards 레지스트리(registerLethalGuard((u,s)=>boolean)) — hp ≤ 0이 될 때 true면 hp=1로 버팀
// battle.step: updateRescue 뒤 runReactors(s) (이번 틱 이벤트 배열 전달; 반응기가 추가한 이벤트는 다음 틱에 처리되지 않도록 처리 시작 시점 길이까지만)
```
- [ ] 테스트: pairKey 대칭; relationKinds 기준값 경계(39/40, 79/80+전투 9/10, −40, 사제 레벨차 3/4); 출전하지 않은 상대와의 관계는 state에 없음; 사망한 파트너는 partners()에서 제외; lethal guard가 1회 버팀; momentum 보정 적용.
- [ ] FAIL → 구현 → PASS(Plan 1 테스트 전부 포함) → 커밋

### Task B3: 감정 시스템
**Files:** Create `src/sim/personality/emotions.ts`; Modify `src/sim/battle/types.ts`(UnitState.emotions), `snapshot.ts`(UnitSnap.emotions); Test `tests/sim/emotions.test.ts`

```ts
export interface EmotionInstance { id: EmotionId; ticksLeft: number; targetId?: string; used?: boolean }
export function addEmotion(s: BattleState, u: UnitState, id: EmotionId, opts?: { targetId?: string; durationSec?: number }): void;
// calm 특성: 지속시간 ×0.5, statMult 효과 절반(1 + (m-1)/2). courage 보유 중 fear 무시. fear 추가 시 courage 있으면 무시.
// 같은 감정 재부여 시 지속시간 갱신·targetId 교체. emit 'emotion' {dst, data:{id, targetId}}
export function hasEmotion(u: UnitState, id: EmotionId): boolean;
export function tickEmotions(s: BattleState): void; // 감소·만료(emit 'emotion_end'); revenge 대상이 죽으면 즉시 종료; fear는 HP>40%가 되면 종료
// 등록: statModifier(감정 statMult), momentumModifier(elation 1.5), lethalGuard(resolve: 미사용이면 used=true 후 버팀, emit 'resolve')
```
- [ ] 테스트: 분노 시 실효 공격력 ×1.2; calm이면 ×1.1이고 지속 절반; courage 중 fear 무시; revenge 대상 사망 시 종료; resolve 1회 버팀 후 다음 치명타엔 쓰러짐; fear는 HP 회복 시 종료.
- [ ] FAIL → 구현 → PASS → 커밋

### Task B4: 특성 → 전투 행동
**Files:** Create `src/sim/personality/traitBehaviors.ts`, `src/sim/personality/index.ts`(등록 진입점, battle.ts에서 side-effect import); Modify `src/sim/battle/ai/candidates.ts`(flee 후보), `decide.ts`(flee 실행), `setup.ts`(cautious 첫 행동 지연); Test `tests/sim/traits.test.ts`

규칙(고려 요소/보정/반응기로 등록):
- reckless: gapClose +15, dodge 후보 −30, 기세 ×1.25.
- cautious: dodge 후보 +30, 시작 decisionIn +10틱.
- protective: protect 후보 +20(B5), 위험 아군 대상 heal/shield +10.
- coward: HP ≤30%이고 4m 내 친구 없음 → fear; 친구가 4m 내면 courage(+`relation_trigger` courage). fear 중에는 `flee` 후보(자기 진영 끝 방향 4m) +60, 스킬 −30.
- competitive: 다른 아군이 노리는 HP ≤40% 적 대상 +12(막타 경쟁).
- vengeful: 친구가 쓰러지면 쓰러뜨린 적에게 revenge(+`relation_trigger` revenge).
- hotheaded: 피격 시 15% 확률 rage.
- calm: B3에서 처리.
- glory: 보스·정예 대상 +20, 처치 시 기세 +30.
- loner: 4m 내 아군 없으면 atk ×1.15.
- chatty: 전투 후 친밀도 ×1.5(B7).
- altruist: heal/shield/rescue/protect 후보 +20.
- revenge 감정 보유 시: 대상 +60(reason 'revenge'), 그 외 적 −20. rage 보유 시: 근접 접근·스킬 +15, kite/dodge −20(reason 'rage').
- [ ] 테스트(각 특성 1개 이상): 겁쟁이 저체력 고립 → flee 의도; 겁쟁이 + 친구 근처 → courage, flee 안 함; 복수심 → 친구 쓰러짐 이벤트 후 revenge 대상 = 가해자, 의도 대상 = 가해자; 영광 추구 → 보스 우선; 외톨이 고립 시 atk 증가; 신중함 첫 결정 지연; 특성 없는 유닛은 Plan 1과 동일 점수(회귀: 기존 ai.test 통과).
- [ ] FAIL → 구현 → PASS → 커밋

### Task B5: 관계 → 전투 행동
**Files:** Create `src/sim/personality/relationBehaviors.ts`; Modify `candidates.ts`(protect 후보), `decide.ts`; Test `tests/sim/relationBehaviors.test.ts`

- 친구·사제(스승→제자): 파트너 HP <30%이고 그를 노리는 적이 있으면 `protect` 후보(dest = 파트너와 그 적 사이 0.35 지점, target = 그 적), 점수 45(+protective 20, +altruist 20, 사제 +10), reason 'protectFriend'. 처음 선택될 때 `relation_trigger` {src, dst=파트너, data:{kind:'protect'|'mentor'}} (같은 쌍·종류는 6초 쿨다운).
- 친구 4m 내: def ×1.1(statModifier).
- 라이벌 4m 내: atkSpeed ×1.1, crit ×1.1. 라이벌이 노리는 대상 +12(reason 'rivalry'). 라이벌이 처치하면 `relation_trigger` rivalry + 기세 +10. 라이벌이 쓰러지면 rage.
- 반목 4m 내: atk ×0.9. 반목 상대 대상 heal/shield/protect/rescue −25. 처음 근접 시 `relation_trigger` feud(10초 쿨다운).
- 친구가 쓰러지면 vengeful 아니어도 `downedFriend` 대사용 이벤트 `relation_trigger` {kind:'protect', data:{downed:true}}는 내지 않음 — 대신 'bark' 이벤트 {src, data:{key:'downedFriend'}}.
- [ ] 테스트: 친구 위험 → protect 의도 + relation_trigger; 관계 없으면 protect 없음; 파트너 미출전/사망이면 미발동(Review Focus 1); 라이벌 근접 버프·반목 근접 디버프 수치; 반목 상대는 치유 우선순위 하락(사제가 반목 상대 대신 다른 부상자 치유); 라이벌 처치 시 trigger.
- [ ] FAIL → 구현 → PASS → 커밋

### Task B6: 전우 연계기
**Files:** Create `src/sim/personality/pairCombos.ts`, `src/data/skills/combo.ts`; Modify `skills/index.ts`, `candidates.ts`/`decide.ts`(pairCombo 후보), `actions.ts`(파트너 동시 행동); Test `tests/sim/pairCombos.test.ts`

```ts
export function comboFor(a: UnitState, b: UnitState): ComboDef; // 직업 쌍 일치 → 해당, 없으면 generic(리더 = id 작은 쪽)
// 후보: 리더(직업이 combo.lead인 쪽, generic이면 id 작은 쪽)만 생성. 조건: 전우 관계, 둘 다 행동 가능, 거리 ≤ 6m, 쌍 쿨다운 0(BattleState.pairCooldowns), 리더 기세 ≥ 50.
// 점수 70 + (대상 적 수 보정), reason 'comboPair'. 실행: 리더 startAction(combo.skill, target), 파트너 startAction(combo.partnerSkill, 같은 대상 또는 자신), 둘 다 기세 −50, 쿨다운 combo.cooldown(25초).
// emit 'pair_combo' {src: 리더, dst: 파트너, skillId: combo.id}. 파트너가 행동 중이면 파트너 행동을 취소하고 덮어씀(위험 회피 중 forced면 후보 생성 안 함).
```
- [ ] 테스트: 전우 쌍이 조건 충족 시 pair_combo 발생·두 유닛 모두 행동 시작; 쿨다운 동안 재발동 안 함; 전우 아님(친밀도 79)이면 없음; 파트너가 시전 중 쓰러지면 리더 행동은 계속되고 예외 없음(Review Focus 3); generic 콤보 선택.
- [ ] FAIL → 구현 → PASS → 커밋

### Task B7: 전투 후 관계 변화와 "순간들"
**Files:** Create `src/sim/roster/relationships.ts`; Test `tests/sim/relationshipUpdate.test.ts`

```ts
export interface Moment { kind: 'rescue'|'protect'|'rivalry'|'revenge'|'courage'|'combo'|'newFriend'|'newComrade'|'newRival'|'newFeud'|'death'; a: string; b?: string }
export interface RelationUpdate { relations: Relation[]; moments: Moment[] }
export function applyBattleToRelations(input: { relations: Relation[]; allies: UnitSetup[]; events: BattleEvent[]; seed: number }): RelationUpdate;
// 스펙 3.4: 함께 출전 +2×(두 사람 affinityMult 곱)·궁합(likes면 ×1.5, dislikes면 ×0.5 후 −1)·battlesTogether+1; rescued +20; relation_trigger protect +5;
// 막타 경쟁: died 이벤트의 처치자 A와, 같은 대상에게 직전 3초 내 피해를 준 다른 아군 B → 쌍 contests+1; contests ≥3이면 rival 판정(둘 중 competitive 있으면 확정, 아니면 시드 RNG 30%)
// 관계 유형이 새로 생기면 newFriend/newComrade/newRival/newFeud 순간 추가. 전투 중 trigger/rescued/pair_combo/died도 순간으로 변환(중복 제거, 최대 8개).
```
- [ ] 테스트: 기본 +2·chatty·loner 배율; likes/dislikes 보정; 구출 +20; 경쟁 3회 → competitive면 라이벌; 친구 기준 넘으면 newFriend 순간; 결정론(같은 입력 같은 결과); 입력 배열 불변.
- [ ] FAIL → 구현 → PASS → 커밋

### Task B8: 관계·감정 연출
**Files:** Create `src/view/fx/tetherFx.ts`, `src/view/overlay/barks.ts`; Modify `eventRouter.ts`, `unitOverlay.ts`, `battlePlayer.ts`(timeScale), `camera.ts`(punch), `battleRuntime.ts`, `battleLog.ts`; Test `tests/unit/battlePlayerSlowmo.test.ts`, `tests/unit/eventRouterRelations.test.ts`

- 오버레이: 감정 아이콘(상태 줄 앞쪽, 테두리 강조), 관계 트리거 시 2초간 큰 아이콘 팝업.
- TetherFx: 두 유닛 사이 관계색 선(protect 하늘, rivalry 주황, revenge 빨강, courage 금색, combo 흰금, feud 보라, mentor 금색) 1.2초 페이드, 유닛 이동을 따라감.
- Barks: 말풍선 DOM 2초, 유닛 머리 위, 겹치면 위로 쌓임. `relation_trigger`·`emotion`(rage/fear)·`bark`·`pair_combo`·`rescued`에서 대사 선택.
- 슬로모션: `BattlePlayer.slowmo(realSec, scale)` — pair_combo 시 0.6초 동안 0.3배, 카메라 punch(높이 −25% 후 복귀) — 수동 모드에서도 적용.
- 전투 기록: 관계·감정 줄 추가, `연계·구출만` 필터에 relation_trigger·pair_combo 포함.
- [ ] 테스트: slowmo 중 틱 진행률 감소 후 복귀; router가 relation_trigger에 tether·bark 콜백 호출(가짜 deps).
- [ ] FAIL → 구현 → PASS → 커밋

### Task B9: UI·샌드박스·E2E
**Files:** Modify `inspectPanel.ts`, `resultOverlay.ts`, `sandboxScreen.ts`, `battleScreen.ts`, `main.ts`(setup에 relations 주입), `ko.ts`; Modify `src/sim/battle/setup.ts`(setupFromPresets가 ALLY_RELATIONS·traits·level 반영); Test `tests/sim/bondsSmoke.test.ts`, `tests/e2e/bonds.spec.ts`

- 정보 패널: 특성(이름+한 줄 설명), 감정, 관계 목록(규칙 문장).
- 결과 화면: "이번 전투의 순간들"(B7 moments, 아이콘+문장), 관계 변화(+/− 친밀도, 새 관계).
- 샌드박스: 아군 프리셋에 `bonds`(관계 시연) 추가.
- 헤드리스 스모크(`bondsSmoke`): bonds vs skeletons 40시드 → relation_trigger(protect·rivalry 중 하나 이상), emotion, pair_combo가 전체 실행 중 각각 최소 1회 발생; 모든 전투 종료.
- E2E: bonds vs skeletons 시드 고정, 4x로 진행 → 결과 화면에 "순간들" 섹션 표시, 오류 없음, 스크린샷 3장(전투 중 관계 연출, 정보 패널, 결과).
- [ ] FAIL → 구현 → PASS(lint/typecheck/test/build/e2e) → 커밋 → 푸시 → CI·Pages 확인
