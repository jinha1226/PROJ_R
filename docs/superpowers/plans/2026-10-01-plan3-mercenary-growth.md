# Plan 3 — 용병·성장·장비·연대기

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 용병을 "전투 유닛"이 아닌 성장하는 캐릭터로 만든다 — 생성(이름·특성·배경·개인 성장치), 레벨업 3택(스킬 풀 36), 전술 슬롯, 장비 30종과 외형 변화, 등급(신입→영웅), 연대기·별명·부상·흉터·사망·추모. 런 구조(Plan 4) 전이므로 **용병단 모드**(용병단 생성 → 연속 전투 → 결과·레벨업·장비 → 다음 전투)로 플레이할 수 있게 한다.

**Architecture:** 영속 엔티티 `Mercenary`/`Roster`는 `src/sim/roster/`의 순수 데이터·순수 함수. 전투 진입 시 `mercToUnitSetup`이 성장치·장비·패시브·부상·흉터·별명을 계산해 `UnitSetup`을 만든다(전투 시뮬은 Mercenary를 모름). 전투 후 `resolveBattle`이 이벤트 흐름으로 경험치·부상·흉터·사망·연대기·별명·관계·전리품을 계산한다. 전투 중 효과(스킬 레벨, 고유 장비 효과, 별명·흉터 효과)는 Plan 1·2 레지스트리에 등록한다.

**Tech Stack:** Plan 1·2와 동일.

**Spec:** `docs/superpowers/specs/2026-10-01-mercenary-roguelike-design.md` (2.3~2.5, 4장)

## Global Constraints
- Plan 1·2 제약 전부 유지.
- 스펙 수치: 최대 레벨 10, 필요 경험치 `40 + 30 × (레벨 − 1)`, 성장 편차 0.85~1.15(생성 시 고정), 등급 신입 1~3 / 숙련 4~6 / 베테랑 7~9 / 영웅 10, 부상 2~3전투 전 능력치 −15%, 흉터 = 생명선 25% 이하까지 깎였다 생존 시 30%, 사망 영구.
- 스킬 슬롯: 기본 공격 + 액티브 2 + 궁극기 1 + 패시브 2. 스킬 레벨 1~3: 피해·치유 ×(1 + 0.2×(L−1)), 쿨타임 ×(1 − 0.1×(L−1)).
- 숙련(4)부터 액티브 강화 선택지, 베테랑(7)부터 전술 슬롯 2, 영웅(10)에서 궁극기 강화.
- 모든 생성·보상 난수는 시드 RNG(`roster.seed` + 전투 번호 + 용병 id)로 결정론.

## Review Focus
1. **용병 전원 사망/출전 가능 인원 0** — 용병단 모드가 멈추지 않고 "전멸" 상태를 보여줘야 한다. → T7.
2. **레벨업 대기 중 다음 전투 시작** — 미선택 레벨업이 사라지지 않고 누적·보존되어야 한다. → T4/T7.
3. **장착 불가 장비(직업 무기 유형 불일치)** — 장착 시도 거부, 견습→승급 시 맞지 않는 무기는 자동 해제되어 인벤토리로. → T2/T4.
4. **최대 레벨·최대 스킬 레벨에서 레벨업 제안** — 제안할 것이 3개 미만이면 있는 만큼만(0이면 능력치만 오르고 모달 없음). → T4.
5. **이미 사망한 용병과의 관계/연대기** — 추모 목록으로 옮겨지고 출전·장비 대상에서 제외, 관계는 남은 쪽 '상실'로 1회만 처리. → T5.

---

### Task T0: 전장 밝기 (사용자 피드백) — 완료 (171eba5)

### Task T1: 데이터 — 스킬 풀·패시브·장비·흉터·별명·이름
**Files:** Create `src/data/skills/pool/{warrior,berserker,rogue,crossbow,mage,priest}.ts`, `src/data/{passives,items,scars,titles,names}.ts`, `src/ui/i18n/koGrowth.ts`; Modify `src/data/types.ts`, `src/data/classes.ts`(skillPool 필드), `skills/index.ts`, `ko.ts`; Test `tests/unit/growthData.test.ts`

- `ClassDef.pool: string[]` — 직업 액티브 풀 5개(기존 2 + 신규 3). 신규 18개:
  - warrior: `shield_wall`(자신 보호막 0.3·주변 r3 도발 2초, cd14), `cleaving_blow`(부채꼴 r2 90° dmg 1.2 + 넘어짐 0.8, cd9), `rally`(아군 r5 heal 1.5, cd12)
  - berserker: `leap_slam`(dash 6 + 대상 원 r2 dmg 1.5 + 넘어짐 1, cd10), `rending_strike`(dmg 1.6 + bleed 6s 0.25, cd8), `frenzy`(자신 보호막 0.15 + 주변 r2.5 dmg 1.1, cd11)
  - rogue: `smoke_bomb`(자기 중심 r3 적 둔화 3s + 자신 dash 뒤로 3, cd12), `poison_blade`(dmg 1.0 + bleed 6s 0.3, cd7), `fan_of_knives`(자기 중심 r3 dmg 0.9 + 표식 4s, cd10)
  - crossbow: `explosive_bolt`(투사체 + 명중점 r2 dmg 1.3 + 넘어짐 0.8, cd10), `pinning_shot`(투사체 dmg 1.2 + 기절 1s, cd11), `rain_of_bolts`(대상 r3.5 텔레그래프 dmg 1.2 + 둔화, cd12)
  - mage: `frost_lance`(투사체 dmg 1.5 + 둔화 3s; 젖음 반응 소모 → 기절 1s, cd8), `chain_spark`(dmg 1.3; 젖음 반응 비소모 +1.0, cd7), `meteor`(대상 r2.5 텔레그래프 windup 1.4 dmg 2.6 + 화상, cd16)
  - priest: `holy_shield`(아군 보호막 0.25 6s, cd8), `mass_heal`(아군 r5 heal 2.0, cd12), `blessed_strike`(dmg 1.2, 표식 반응 +1.0, 자신 heal 1.0, cd8)
- `passives.ts` — 공용 6종(`PassiveDef { id, statMult?: Partial<Stats>, momentumMult?: number }`): toughness(maxHp×1.15), sharpEdge(atk×1.1), ironSkin(def×1.15), quickHands(atkSpeed×1.1), fleetFoot(moveSpeed×1.1, dodge×1.15), momentumSurge(momentum×1.25). 스킬 풀 합계 = 직업 30 + 공용 6 = 36.
- `items.ts` — 30종 `ItemDef { id, slot: 'weapon'|'armor'|'trinket', tier: 0..4, weaponType?, stats: Partial<Stats>(가산), visual?: { weapon?: string; offhand?: string; helmet?: boolean; cape?: boolean }, unique?: UniqueId }`.
  - 무기 유형↔직업: sword_shield(견습·전사), axe2h(광전사), daggers(도적), crossbow(석궁수), staff(마법사), wand(사제). 무기 12(유형별 2: 낡은/일반 + 정예 이상 6), 방어구 10(낡은~전설, helmet/cape 시각), 장신구 8.
  - 무기 atk 가산 tier별 [0,3,6,10,15]; 방어구 def [0,4,8,13,20] + maxHp [0,10,25,40,60]; 장신구는 개별.
  - 고유 효과 8종(`UniqueId`): markReset(표식된 적 처치 시 액티브 쿨타임 초기화), knockdownBleed(넘어진 적 타격 시 출혈 3s 0.2), friendGuard(친구 4m 내 def×1.2), lifesteal(준 피해 10% 회복), firstStrike(전투 시작 기세 +30), lastStand(HP 30% 이하 atk×1.25), thorns(근접 피격 시 공격자에게 atk×0.3 반사), wetLightning(젖은 적에게 피해 ×1.25).
- `scars.ts` — 3종 `ScarDef { id, statMult, startEmotion? }`: limp(moveSpeed×0.9, 시작 시 resolve), oneEye(crit×1.6, dodge×0.6), hardened(maxHp×0.9, def×1.2).
- `titles.ts` — 6종 `TitleDef { id, check(record) }`: guardian(rescues≥3), undying(downedSurvived≥3), giantSlayer(bossKills≥1), hundredCuts(kills≥50), shadow(dodges≥30), healingHand(healing≥3000). 보너스는 T3.
- `names.ts` — 한국어 판타지 이름 40개, 한 줄 배경 20개(`{class}` 치환 가능).
- ko: 신규 스킬·패시브·장비·고유 효과·흉터·별명·등급·연대기 문장 템플릿.
- [ ] 테스트: 직업 풀 5개·모든 스킬 존재·kind 'active'; 풀+공용 = 36; 장비 30·슬롯별 개수·무기 유형이 모든 직업을 덮음; 모든 id ko 이름; 이름 ≥40·중복 없음.

### Task T2: Mercenary 모델·생성·UnitSetup 변환
**Files:** Create `src/sim/roster/{types,generate,toSetup,formation,equipment}.ts`; Modify `src/sim/battle/types.ts`(UnitSetup 필드); Test `tests/sim/mercenary.test.ts`

```ts
export type Rank = 'rookie' | 'skilled' | 'veteran' | 'hero';
export interface MercRecord { battles: number; kills: number; rescues: number; downedSurvived: number; bossKills: number; dodges: number; healing: number }
export interface ChronicleEntry { battle: number; key: string; vars: Record<string, string | number> }
export interface Mercenary {
  id: string; name: string; classId: ClassId; level: number; xp: number; color: string; backstory: string;
  traits: TraitId[]; revealed: TraitId[]; growth: { maxHp: number; atk: number; def: number };
  actives: string[]; ultimate: string; passives: string[]; skillLevels: Record<string, number>;
  tactics: TacticId[]; gear: { weapon?: string; armor?: string; trinket?: string };
  injury: number; scars: ScarId[]; title?: TitleId; tempTraits: { trait: TraitId; battles: number }[];
  chronicle: ChronicleEntry[]; record: MercRecord; alive: boolean; pendingLevelUps: number; protagonist?: boolean;
}
export interface Roster { seed: number; battles: number; mercs: Mercenary[]; memorial: Mercenary[]; relations: Relation[]; inventory: string[]; tacticsOwned: TacticId[] }
export const rankOf: (level: number) => Rank;
// generate.ts
export function createProtagonist(seed: number): Mercenary; // 견습, 이름 '이름 없는 모험가', 특성 2(첫째 공개), 낡은 검(worn sword_shield) 장착
export function generateRecruit(rng: Rng, opts: { level: number; usedNames: Set<string>; classId?: ClassId }): Mercenary; // 특성 2개(같은 특성·서로 dislikes 쌍 제외), 성장 편차, 개인 색, 배경, 직업 키트, 낡은 무기
export function newRoster(seed: number, recruits: number): Roster; // 주인공 + 신규 N명
// equipment.ts
export function canEquip(m: Mercenary, itemId: string): boolean; // 슬롯·무기 유형
export function equip(roster: Roster, mercId: string, itemId: string): Roster; // 불가 시 throw, 기존 장비는 인벤토리로 (불변 갱신)
export function unequip(roster: Roster, mercId: string, slot: ItemSlot): Roster;
// toSetup.ts
export function mercStats(m: Mercenary): Stats; // base + growth×(L−1)×편차 + 장비 가산 → 패시브·흉터 배율 → 부상 ×0.85
export function mercToUnitSetup(m: Mercenary, index: number, slot: {col, row}): UnitSetup; // id = m.id, traits = traits ∪ tempTraits, gear 시각(무기 visual·방어구 helmet/cape·베테랑↑ 망토), skillLevels, passives, uniques, scars, title, level
// formation.ts
export function autoFormation(mercs: Mercenary[]): { merc: Mercenary; col: 0|1|2; row: 0|1|2|3 }[]; // 선봉·공격수·유격 col2, 지원 col1, 원거리·술사 col0, 행 순서대로, 최대 5명
```
`UnitSetup` 추가 필드: `skillLevels?: Record<string, number>`, `passives?: string[]`, `uniques?: UniqueId[]`, `scars?: ScarId[]`, `title?: TitleId`, `rank?: Rank`, `gearTiers?: { weapon?: number; armor?: number }`, `injured?: boolean`.
- [ ] 테스트: 같은 시드 → 같은 용병; 특성 2개 상이·상충 없음; 편차 범위; mercStats가 장비·부상·흉터 반영; 무기 유형 불일치 장착 거부; 장착 시 기존 장비 인벤토리 복귀; 베테랑은 cape true; autoFormation 역할 배치.

### Task T3: 전투 중 성장 효과
**Files:** Create `src/sim/progression/{skillLevels,uniques,titleEffects,scarEffects}.ts`, `index.ts`(battle.ts에서 import); Modify `src/sim/battle/effects.ts`(스킬 레벨 배율), `actions.ts`(쿨타임 배율), `damage.ts`(heal·lifeline 배율 훅); Test `tests/sim/progressionEffects.test.ts`

- 스킬 레벨: damage/heal 효과 ×(1+0.2(L−1)), 쿨타임 ×(1−0.1(L−1)).
- 고유 효과 8종: 레지스트리(데미지 보정, 반응기, 능력치 보정)로 구현. firstStrike는 tick 0 반응기에서 기세 +30.
- 별명: guardian(의도가 protect/guard일 때 def×1.15), undying(생명선 ×1.25), giantSlayer(보스·정예 대상 피해 ×1.1), hundredCuts(처치 시 기세 +10), shadow(dodge +0.05 가산), healingHand(치유 ×1.1).
- 흉터 시작 감정(limp → resolve)은 tick 0 반응기. 흉터 능력치는 T2 mercStats에서 처리.
- 패시브 momentumSurge: 기세 보정.
- [ ] 테스트: 스킬 L3 피해가 L1의 1.4배; 쿨타임 0.8배; markReset·knockdownBleed·lifesteal·thorns·wetLightning·lastStand·friendGuard·firstStrike 각 1개; undying 생명선; giantSlayer 보스 피해; limp 시작 resolve.

### Task T4: 경험치·레벨업 제안·승급
**Files:** Create `src/sim/roster/{leveling,offers}.ts`; Test `tests/sim/leveling.test.ts`

```ts
export const xpToNext = (level: number) => 40 + 30 * (level - 1);
export function addXp(m: Mercenary, xp: number): Mercenary; // 레벨 상승마다 pendingLevelUps+1, 최대 레벨 10에서 xp 고정
export type LevelOffer =
  | { kind: 'newActive'; skillId: string } | { kind: 'upgrade'; skillId: string }
  | { kind: 'passive'; passiveId: string } | { kind: 'promote'; classId: ClassId } | { kind: 'tactic'; tacticId: TacticId };
export function levelOffers(m: Mercenary, roster: Roster, seed: number): LevelOffer[]; // 최대 3개, 결정론
// 견습 레벨 3 첫 승급: promote 3개(견습 제외 6직업 중 무작위)
// 후보: 배우지 않은 직업 풀 액티브 / 업그레이드(숙련↑ 액티브 L<3, 영웅 궁극기 L<3) / 패시브(슬롯<2이고 미보유) / 베테랑 도달 시 보유 전술 중 미장착 1개
export function applyOffer(m: Mercenary, offer: LevelOffer, replaceSlot?: 0 | 1): Mercenary;
// newActive: 빈 슬롯 또는 replaceSlot 교체(필수: 슬롯이 꽉 차면 replaceSlot 없을 때 throw). promote: 직업·키트 교체, 맞지 않는 무기 해제(roster 단계에서 인벤토리로 — applyOfferToRoster 사용)
export function applyOfferToRoster(r: Roster, mercId: string, offer: LevelOffer, replaceSlot?: 0 | 1): Roster; // pendingLevelUps−1
```
- [ ] 테스트: xp 곡선; 다중 레벨업 누적; 최대 레벨; 견습 승급 제안; 승급 후 키트·무기 해제; 슬롯 교체; 제안 결정론; 제안 없음(모든 것 습득·최대) → 빈 배열; 숙련 전에는 업그레이드 제안 없음.

### Task T5: 전투 후 처리
**Files:** Create `src/sim/roster/{aftermath,chronicle,titles,loot}.ts`; Test `tests/sim/aftermath.test.ts`

```ts
export interface BattleReport { outcome: Outcome; events: BattleEvent[]; finalUnits: { id: string; alive: boolean; downed: boolean; lifeline: number; maxHp: number; minLifelineFrac: number }[]; stage: number }
export interface Aftermath { roster: Roster; xp: Record<string, number>; levelUps: string[]; injuries: string[]; scars: { id: string; scar: ScarId }[]; deaths: string[]; titles: { id: string; title: TitleId }[]; loot: string[]; moments: Moment[]; revealed: { id: string; trait: TraitId }[] }
export function resolveBattle(roster: Roster, deployed: string[], report: BattleReport): Aftermath;
```
- 경험치: 참전 20 + 처치×5 + 승리 15, ×(1+0.1(stage−1)), 사제 제자 +25%. 후퇴/패배는 참전 xp의 50%.
- 기록 갱신(kills/rescues/downedSurvived/bossKills/dodges/healing/battles) → 별명 판정(최초 1개 자동, 이후 새 별명은 연대기만 기록).
- 부상: 전투 종료 시 쓰러져 있었으면 injury = 2~3(시드). 매 전투 후 참전하지 않은 용병 포함 injury −1(0 하한, 이번 부상 제외).
- 흉터: 생존했고 전투 중 최소 생명선 비율 ≤ 0.25이면 30% 확률, 미보유 흉터 중 하나.
- 사망: died 이벤트 대상 → alive=false, memorial로 이동, 장비는 인벤토리로. 친구·전우인 생존자: tempTraits에 vengeful 3전투(이미 vengeful이면 생략) + 연대기.
- 숨은 특성: 첫 전투 후 revealed에 두 번째 특성 추가.
- 관계: Plan 2 `applyBattleToRelations` 결과 반영(사망자 관계 제거).
- 연대기 키: firstKill, downedRescued{by}, rescued{who}, bossKill, eliteKill, newFriend/newComrade/newRival/newFeud{who}, title{title}, scar{scar}, friendDied{who}, levelUp{level}(등급 변화 시만), promoted{class}, revealed{trait}.
- 전리품: 승리 시 1개(+정예/보스 처치 시 +1), 등급 = clamp(floor(stage/3), 0..4) ± 시드 변동.
- tempTraits 남은 전투 −1.
- [ ] 테스트: xp 계산·후퇴 절반; 부상 부여·감소; 흉터 조건; 사망→추모·장비 회수·상실; 별명 획득; 연대기 항목; 숨은 특성 공개; 전리품 결정론; 입력 roster 불변.

### Task T6: 외형 성장
**Files:** Modify `src/view/actors/actor.ts`, `modelManifest.ts`(장비 메시 목록 함수), `src/view/overlay/unitOverlay.ts`, `icons.ts`; Test `tests/unit/gearLook.test.ts`

- 장비 등급 색: 장비 메시(무기·보조·투구·망토)에만 적용 — worn 회갈 탈색(lerp #8a7a66 0.5, metalness 0), common 원색, elite 푸른 기(#7ab0ff 0.25, metalness 0.3), master 보라(#c08aff 0.3, 0.45), legendary 금(#ffd060 0.4, 0.6 + emissive 0.15).
- 등급: veteran → 망토 강제, hero → 발밑 금색 오라 링(펄스) + 이름표 금테.
- 부상: 이름표 옆 붕대 아이콘(lucide Bandage) + 링 채도 감소.
- `gearLook(spec)` 순수 함수로 메시별 색 계산 → 테스트.
- [ ] 테스트: tier별 색·metalness, worn은 탈색, rank hero → aura true.

### Task T7: 용병단 모드 UI
**Files:** Create `src/ui/screens/{companyScreen,aftermathScreen}.ts`, `src/ui/company/{rosterCards,characterSheet,levelUpModal,equipPanel,memorialPanel}.ts`, `src/app/companyFlow.ts`, `src/ui/styles/company.css`; Modify `sandboxScreen.ts`(모드 버튼), `main.ts`, `battleScreen.ts`(결과 후 콜백에 report 전달)

- 흐름: 샌드박스 타이틀 → `용병단 모드` → 시드로 용병단 생성(주인공 + 4명) → **용병단 화면**(카드, 출전 체크 최대 5, 적 선택(단계 표시), `출전`) → 전투 → 결과 → **전투 후 화면**(경험치 바, 레벨업, 부상·흉터·사망·별명·전리품·순간들) → 레벨업 대기자가 있으면 **레벨업 모달**(3택 카드; 새 액티브가 슬롯 초과면 교체 슬롯 선택; 승급은 직업 카드) → 용병단 화면.
- 캐릭터 시트(카드 클릭): 탭 `능력치`(최종 능력치·성장 편차 등급 A/B/C·특성(공개된 것만, 숨은 것은 '?')·별명·흉터·부상), `스킬`(액티브·궁극기·패시브와 레벨), `장비`(슬롯 3 + 인벤토리 목록, 장착 가능만 활성), `관계`(규칙 문장), `연대기`.
- 전멸(살아있는 용병 0) 시 "용병단이 전멸했다" + 새 용병단 버튼(Review Focus 1). 출전 가능(부상 아님 우선, 부상자도 선택 가능) 0명이면 출전 버튼 비활성.
- 저장은 메모리(새로고침 시 초기화 — Plan 4에서 localStorage).
- [ ] E2E `tests/e2e/company.spec.ts`: 용병단 모드 시작 → 출전 → 전투 fast-forward → 전투 후 화면 → (레벨업 있으면 첫 카드 선택) → 용병단 화면 복귀 → 캐릭터 시트 탭 전환 → 스크린샷.

### Task T8: 연속 전투 스모크·마무리
**Files:** Test `tests/sim/campaignSmoke.test.ts`; Modify `README.md`
- 헤드리스: 용병단 생성 → 12전투(단계 1→6, 적 프리셋 순환, 레벨업은 첫 제안 자동 선택, 전리품은 장착 가능하면 장착) → 예외 없음, 평균 레벨 상승, 연대기 항목 증가, 결정론(같은 시드 같은 최종 roster JSON).
- [ ] 전체 검증(lint/typecheck/test/build/e2e) → 커밋 → 푸시 → CI·Pages 확인
