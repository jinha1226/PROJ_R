# 규칙형 특성 체계 A (엔진·카드·공명·기억·화면) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 +5%형 특성 82개를 규칙형 카드 68장, 태그 공명, 연쇄 엔진, 영혼의 기억, 레벨 성장 곡선으로 바꾸고 화면에 보여 준다.

**Architecture:** 지금의 발동 엔진(`TriggerDef`, `emit`)과 `TraitDef`(passive Mods + trigger)를 그대로 쓴다. 카드는 `TraitDef`에 `kind`·`text`·`up`을 더한 것이고, 법칙 카드의 강화는 랭크 2로 표현한다(제시 규칙의 "rank < ranks" 그대로). 태그 공명은 새 모듈 `resonance.ts`가 클론별 태그 수를 세어 발동 목록에 법칙을 더하거나, 전투 계산 몇 곳에서 켜졌는지 묻는다. 계획 B(몬스터 밀도·귀환 신호기·첫 임무)는 따로 쓴다.

**Tech Stack:** TypeScript, Vitest, three.js(화면만), Vite

**Spec:** `docs/superpowers/specs/2026-10-07-rule-traits-design.md` (§0–§8, §12. §9–§11은 계획 B)

## Global Constraints

- 파일 400줄 이하(`npm run lint`가 CSS 포함 검사).
- 화면 문구는 짧은 한국어 라벨, 설명조 AI 문체 금지.
- 작업마다 유닛 테스트. e2e와 CI는 계획 끝에서만.
- 커밋은 main에, 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 기존 세이브와의 호환은 고려하지 않는다.
- 수치는 스펙의 시작값을 쓴다. 밸런스는 Task 12에서 조정한다.

## Review Focus

1. 한 행동 안에서 같은 발동이 서로를 무한히 부르지 않는가(연소 폭발 강화처럼 반복을 허용한 카드 포함) → Task 1, Task 8 테스트.
2. 적이 없거나 대상이 죽은 상태에서 발동이 돌아도 예외 없이 지나가는가(처치 후 추가타, 순간이동 자리 없음) → Task 6–9 테스트.
3. 카드를 아직 못 가진 클론, 빈 몸(shell), 소환수에게 카드 효과나 공명이 잘못 붙지 않는가 → Task 4 테스트.
4. 보호막 상한이 올라간 뒤에도 보호막 표시(초상화 바)가 넘치지 않는가 → Task 6 테스트(상한 60).
5. 제시 카드가 3장보다 적어지는 경우(직업 카드를 거의 다 가짐)에도 레벨업 화면이 열리고 고를 수 있는가 → Task 10 테스트.

## File Structure

- `src/sim/party/triggers.ts` (수정): 연쇄 상한 12, 연쇄당 1회, 연쇄 이벤트, 새 사건 종류, 공명·듀오·기억 발동 합치기.
- `src/sim/party/traitTypes.ts` (수정): `CardKind`, `TraitDef.kind/text/up/duo/who`, `card()` 빌더.
- `src/sim/party/traitText.ts` (교체): 카드 정의의 `text`/`up`으로 문장 생성. `traitTextClass.ts`, `traitTextAdvanced.ts`, `traitTextUtil.ts` 삭제.
- `src/sim/party/resonance.ts` (신규): 태그 수, 공명 판정, 공명 법칙 발동, 공명 문장.
- `src/sim/party/cardsCommon.ts` (신규, 공용 12 + 서약 6), `cardsMelee.ts` (전사·도적 16), `cardsRanged.ts` (궁수·마법사 16), `cardsSupport.ts` (성직자 8 + 듀오 10). 기존 `traitCommon.ts`, `traitClasses.ts`, `traitAdvanced.ts` 삭제.
- `src/sim/party/cardFx.ts` (신규): 카드들이 함께 쓰는 효과 도우미(반격, 주변 적, 순간이동, 원소 부여).
- `src/sim/party/memories.ts` (신규): 영혼의 기억 12종.
- `src/sim/party/status.ts` (수정): 원소 반응 3종 추가, 반응 사건, 화상·출혈 중첩, 공명이 바꾸는 상태 규칙.
- `src/sim/party/partyLevel.ts`, `partyCore.ts`, `traitCombat.ts`, `kitEffects.ts`, `shield.ts`, `classKit.ts`, `traitPool.ts`, `roam/roam.ts`, `delve/delveSim.ts`, `overworld/worldGen.ts` (수정): 성장 곡선, 연결 지점, 제시 규칙, 기억 운반.
- `src/ui/overworld/traitPicker.ts`, `pipWindow.ts`, `pipSkills.ts`, `worldScreen.ts`, `delve/delveScreen.ts`, `styles/worldPanels.css` (수정): 카드 표시, 공명 진행도, 기억 이름, 연쇄 팝업.
- 테스트: `tests/unit/chainEngine.test.ts`, `levelCurve.test.ts`, `cardModel.test.ts`, `resonance.test.ts`, `reactions.test.ts`, `cardsCommon.test.ts`, `cardsMelee.test.ts`, `cardsRanged.test.ts`, `cardsSupport.test.ts`, `cardOffer.test.ts`, `memories.test.ts` (신규). 옛 특성 id를 쓰는 테스트는 해당 Task에서 고친다.

## 공통 테스트 도우미

여러 Task가 쓰는 장면 도우미를 Task 1에서 만든다: `tests/unit/support/cardScene.ts`

```ts
import { partyRoom } from '../../../src/sim/party/partySim';
import { entOf, type Party, type Unit } from '../../../src/sim/party/partyCore';
import type { ClassId } from '../../../src/sim/party/partyDefs';

/** A party room with one hero of `cls` at (4,4) and foes parked far away and asleep, ready to be placed by a test. */
export function scene(cls: ClassId = 'warrior'): { p: Party; u: Unit; foes: Unit[] } {
  const p = partyRoom(), u = p.units.find((x) => x.side === 'hero')!;
  u.cls = cls; u.traits = {}; u.level = 1;
  for (const h of p.units) if (h.side === 'hero' && h !== u) entOf(p, h.id)!.alive = false;
  entOf(p, u.id)!.pos = { x: 4, y: 4 };
  const foes = p.units.filter((x) => x.side === 'foe');
  foes.forEach((f, i) => { const e = entOf(p, f.id)!; e.pos = { x: 20 + i, y: 1 }; e.hp = e.maxHp = 200; f.nextAt = 999; });
  return { p, u, foes };
}
/** Puts a foe at a cell, awake, with `hp`. */
export function put(p: Party, f: Unit, x: number, y: number, hp = 200): void {
  const e = entOf(p, f.id)!; e.pos = { x, y }; e.hp = e.maxHp = hp; e.alive = true; f.asleep = false;
}
```

---

### Task 1: 연쇄 엔진

**Files:**
- Modify: `src/sim/party/triggers.ts`
- Modify: `src/sim/party/partyCore.ts` (보호막 파괴, 소환수 사망 사건)
- Create: `tests/unit/support/cardScene.ts` (위 코드)
- Test: `tests/unit/chainEngine.test.ts`

**Interfaces:**
- Produces: `CHAIN_CAP = 12`; `TriggerDef.repeat?: boolean`(연쇄 안에서 반복 허용); `Cond`에 `'counter' | 'shieldBreak' | 'summonDied' | 'reaction' | 'wait'` 추가; `Ctx.reaction?: string`, `Ctx.over?: number`(처치 시 넘친 피해); 연쇄 3단 이상이면 행동이 끝날 때 `{ type: 'buff', text: 'chain', amount: n, src }` 이벤트.

- [ ] **Step 1: 실패하는 테스트**

```ts
import { expect, it } from 'vitest';
import { action, emit, CHAIN_CAP, type TriggerDef } from '../../src/sim/party/triggers';
import { scene } from './support/cardScene';

it('a chain stops at twelve effects in one action', () => {
  const { p, u } = scene();
  let n = 0;
  u.triggers = Array.from({ length: 20 }, (_, i): TriggerDef => ({ id: `t${i}`, when: 'hit', run: () => { n++; u.shield = n; } }));
  const ev: never[] = [];
  action(p, () => emit(p, 'hit', { t: 0, src: u, ev }));
  expect(CHAIN_CAP).toBe(12); expect(n).toBe(12);
});

it('the same effect fires once per chain unless it repeats', () => {
  const { p, u } = scene();
  let once = 0, again = 0;
  u.triggers = [
    { id: 'once', when: 'hit', run: (pp, c) => { once++; u.shield = once + again; emit(pp, 'hit', c); } },
    { id: 'again', when: 'kill', repeat: true, run: (pp, c) => { again++; u.shield = once + again; if (again < 3) emit(pp, 'kill', c); } },
  ];
  const ev: never[] = [];
  action(p, () => { emit(p, 'hit', { t: 0, src: u, ev }); emit(p, 'kill', { t: 0, src: u, ev }); });
  expect(once).toBe(1); expect(again).toBe(3);
});

it('three or more effects in one action leave a chain event with the count', () => {
  const { p, u } = scene();
  u.triggers = ['a', 'b', 'c'].map((id, i): TriggerDef => ({ id, when: 'hit', run: () => { u.shield = i + 1; } }));
  const ev: { type: string; text?: string; amount?: number }[] = [];
  action(p, () => emit(p, 'hit', { t: 0, src: u, ev: ev as never }));
  expect(ev.find((e) => e.text === 'chain')?.amount).toBe(3);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/chainEngine.test.ts` → CHAIN_CAP 5, 반복 발동, chain 이벤트 없음으로 FAIL.

- [ ] **Step 3: 구현** (`triggers.ts`)

```ts
export type Cond = /* 기존 값들 */ | 'counter' | 'shieldBreak' | 'summonDied' | 'reaction' | 'wait';
export interface Ctx { t: number; src: Unit; target?: Unit; amount?: number; status?: StatusId; reaction?: string; over?: number; depth: number; ev: GEvent[] }
export interface TriggerDef { /* 기존 */ repeat?: boolean }
export const CHAIN_CAP = 12;
interface ChainState { count: number; depth: number; fired: Set<string>; ev?: GEvent[]; src?: string; t: number }
const actions = new WeakMap<Party, ChainState>();
const fresh = (t: number): ChainState => ({ count: 0, depth: 0, fired: new Set(), t });
/** Ends a root action: three or more effects in it leave a chain event for the screen. */
function close(p: Party, s: ChainState): void {
  actions.delete(p);
  if (s.count >= 3 && s.ev) s.ev.push({ t: s.t, type: 'buff', src: s.src, text: 'chain', amount: s.count });
}
export function action<T>(p: Party, run: () => T): T {
  if (actions.has(p)) return run();
  const s = fresh(p.time); actions.set(p, s);
  try { return run(); } finally { close(p, s); }
}
```
`emit`의 루프 안: 키 `${c.src.id}:${def.id}`가 `action.fired`에 있고 `!def.repeat`이면 건너뛴다. 발동이 효과를 냈을 때(`effectState` 비교 통과) `fired.add(key)`, 첫 효과일 때 `action.ev ??= c.ev; action.src ??= c.src.id; action.t = c.t`. 루트 처리(`root`)는 `actions.set(p, fresh(c.t))` 후 `finally { if (root) close(p, action) }`.

`partyCore.damage`: 보호막이 0이 되는 곳(`shieldBroken` 호출 옆)에서 `emit(p,'shieldBreak',{t,src:dst,target:attacker,amount:soak,ev})`. 처치 분기에서 `const over = amount - prevHp`(차감 전 체력 `prevHp`를 미리 저장)를 `kill`의 `over`로 넘긴다. `dst.summoner`이면 `emit(p,'summonDied',{t,src:unitOf(p,dst.summoner)!,target:dst,ev})`(소환자가 살아 있을 때).

`partySim.command`의 `wait` 분기에서 `emit(p,'wait',{t:p.time,src:u,ev})`.

- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/chainEngine.test.ts tests/unit/triggerFix.test.ts tests/unit/innateFix.test.ts` → PASS.

- [ ] **Step 5: 커밋** — `git add -A src tests && git commit -m "연쇄 엔진: 상한 12, 연쇄당 1회, 연쇄 이벤트, 새 사건"`

---

### Task 2: 레벨 성장 곡선

**Files:**
- Modify: `src/sim/party/partyLevel.ts` (`refitHp`), `src/sim/party/partyCore.ts` (`strikeAction`)
- Test: `tests/unit/levelCurve.test.ts`, 고칠 것: `tests/unit/partyLevel.test.ts`(체력 +4 기대값)

**Interfaces:**
- Produces: `levelDmg(u: Unit): number` (partyCore, `1 + 0.06 * (level-1)`), `refitHp` 체력 `base * (1 + 0.08*(level-1)) * T.hp(u) …`.

- [ ] **Step 1: 실패하는 테스트**

```ts
import { expect, it } from 'vitest';
import { entOf, levelDmg } from '../../src/sim/party/partyCore';
import { refitHp } from '../../src/sim/party/partyLevel';
import { scene } from './support/cardScene';

it('each level adds 6% damage and 8% health', () => {
  const { p, u } = scene('warrior');
  u.level = 1; refitHp(p, u); const base = entOf(p, u.id)!.maxHp;
  u.level = 6; refitHp(p, u);
  expect(entOf(p, u.id)!.maxHp).toBe(Math.round(base * 1.4));
  expect(levelDmg(u)).toBeCloseTo(1.3);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/levelCurve.test.ts` → `levelDmg` 없음.
- [ ] **Step 3: 구현** — `partyLevel.refitHp`의 `+ HP_PER_LEVEL * (levelOf(u) - 1)`를 `* (1 + 0.08 * (levelOf(u) - 1))`로(기본 체력에 곱), `HP_PER_LEVEL` 삭제. `partyCore`에 `export const levelDmg = (u: Unit): number => 1 + 0.06 * ((u.level ?? 1) - 1);`, `strikeAction`의 `if (u.side === 'hero') {` 블록 첫 줄에 `m *= levelDmg(u);`.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/levelCurve.test.ts tests/unit/partyLevel.test.ts`; `partyLevel.test.ts`의 체력 기대값을 곱셈식으로 고친다 → PASS.
- [ ] **Step 5: 커밋** — `"레벨마다 피해 +6%, 체력 +8%"`

---

### Task 3: 카드 모델과 문장

**Files:**
- Modify: `src/sim/party/traitTypes.ts`, `src/sim/party/traitText.ts`, `src/sim/party/classKit.ts` (`tagsOf`)
- Test: `tests/unit/cardModel.test.ts`

**Interfaces:**
- Produces:
```ts
export type CardKind = 'law' | 'amp' | 'convert' | 'duo' | 'oath';
export interface TraitDef { id; name; tags: Tag[]; pool: 'common' | BaseClass | AdvancedClass | 'keystone' | 'duo'; ranks: 1 | 2 | 3;
  kind?: CardKind; text?: string; up?: string; duo?: [BaseClass, BaseClass]; who?: BaseClass | 'any';
  passive?; trigger?: (rank: number) => TriggerDef; triggers?: (rank: number) => TriggerDef[]; cost? }
export function card(id: string, name: string, kind: CardKind, tags: Tag[], pool: TraitDef['pool'], text: string,
  fx: { passive?: TraitDef['passive']; trigger?: TraitDef['trigger']; triggers?: TraitDef['triggers'] }, up?: string): TraitDef
// ranks = up ? 2 : 1
export function traitText(id: string, rank: number): string // def.text, rank>=2이면 `${text} · 강화: ${up}`; text 없는 옛 정의는 기존 문장 함수로
export const KIND_NAME: Record<CardKind, string> = { law: '법칙', amp: '증폭', convert: '변환', duo: '듀오', oath: '서약' };
```
- `tagsOf(u)`: 카드 하나당 태그 1씩(랭크 무관) + 착용 장비 태그 + 기억 태그(Task 11에서 연결).
- `sourcesOf`: `def.triggers?.(r)`도 합친다.

- [ ] **Step 1: 실패하는 테스트**

```ts
import { expect, it } from 'vitest';
import { card, traitText, KIND_NAME } from '../../src/sim/party/traitTypes';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { tagsOf } from '../../src/sim/party/classKit';
import { scene } from './support/cardScene';

it('a card with an upgrade has two ranks; its text gains the upgrade line at rank 2', () => {
  const c = card('x1', '시험', 'law', ['화염'], 'common', '처치하면 폭발', {}, '폭발이 폭발을 부름');
  TRAITS.x1 = c;
  expect(c.ranks).toBe(2); expect(KIND_NAME[c.kind!]).toBe('법칙');
  expect(traitText('x1', 1)).toBe('처치하면 폭발');
  expect(traitText('x1', 2)).toBe('처치하면 폭발 · 강화: 폭발이 폭발을 부름');
  delete TRAITS.x1;
});

it('tags count one per card, whatever its rank', () => {
  const { u } = scene('mage');
  TRAITS.x2 = card('x2', '시험', 'law', ['화염'], 'common', 't', {}, 'u');
  u.traits = { x2: 2 }; u.gear = undefined;
  expect(tagsOf(u).화염).toBe(1);
  delete TRAITS.x2;
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/cardModel.test.ts` → `card` 없음.
- [ ] **Step 3: 구현** — 위 인터페이스대로. `tagsOf`의 `tags[tag]=(tags[tag]??0)+(rank??0)`를 `+(rank ? 1 : 0)`으로. `traitText.ts`는 `const d = TRAITS[id]; if (d?.text) return rank >= 2 && d.up ? \`${d.text} · 강화: ${d.up}\` : d.text;` 후 기존 경로 유지(옛 정의가 남아 있는 동안).
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/cardModel.test.ts tests/unit/classKit.test.ts tests/unit/traits.test.ts`. 랭크 합으로 태그를 세던 기대값(전직 조건 테스트)은 카드당 1로 고친다 → PASS.
- [ ] **Step 5: 커밋** — `"카드 모델: 종류·문장·강화(랭크 2), 태그는 카드당 1"`

---

### Task 4: 태그 공명

**Files:**
- Create: `src/sim/party/resonance.ts`
- Modify: `src/sim/party/triggers.ts` (`sourcesOf`에 공명 발동), `partyCore.ts` (`stats` 사거리, `strikeAction` 치유 6·협공 3 배수, `damage`에 마지막 타격 기록), `status.ts` (화염 6 중첩, 냉기 3/6, 독 3, 출혈 3, 전기 3/6), `kitEffects.ts` (`summon` 상한, `heal` 넘친 치유 사건을 모든 치유자에게), `classKit.ts` 필요 시
- Test: `tests/unit/resonance.test.ts`

**Interfaces:**
- Produces:
```ts
export const RESONANCE_AT = [3, 6] as const;
export function tagCount(p: Party, u: Unit): Partial<Record<Tag, number>>; // tagsOf + 파티 협공 합산; 빈 몸·소환수는 {}
export function resonant(p: Party, u: Unit | undefined, tag: Tag, level: 1 | 2): boolean;
export function resonanceTriggers(p: Party, u: Unit): TriggerDef[];
export const LAW_TEXT: Record<Tag, [string, string]>; // 스펙 §3 표의 문장
```
- `Unit`에 `lastHitBy?: string; lastHitAt?: number; hitters?: { id: string; t: number }[]; lastStandFloor?: number`.
- 공명 판정 캐시: `WeakMap<Unit, { t: number; tags }>`(같은 시각이면 재사용).

공명 법칙 구현표(스펙 §3, 아래 두 줄은 판결로 바뀐 문장):
| 태그 | 3 | 6 | 위치 |
|---|---|---|---|
| 근접 | hit(사거리 1), 10% → 대상 노출 | kill(사거리 1) → `src.nextAt = t` | 발동 |
| 원거리 | 사거리 +1 | hit(사거리>1), 25% → `strike(…, 1, false)` | `stats` / 발동 |
| 화염 | kill, 대상 화상 → 인접 적 화상(spread) | 화상 중첩(피해 3×중첩) | 발동 / `applyStatus`·`tickStatuses` |
| 냉기 | 냉기 걸린 적 이동 시 피해 4 | 빙결 +1턴, 빙결 대상 피해 ×1.5 | `movedStatus` / `applyStatus`·`statusMult` |
| 독 | 중독 상한 +3 | kill, 대상 중독 → 인접 적 중독 2 | `applyStatus` / 발동 |
| 전기 | **튄 번개 맞은 적도 감전** | **튄 번개 피해 ×3** | `statusMult` |
| 출혈 | 출혈 이동 피해 ×2 | kill, 대상 출혈 → 인접 적 출혈 | `movedStatus` / 발동 |
| 방패 | block → 공격자 노출 | **반격 피해 ×2** | 발동 / `counter` 도우미 |
| 은신 | kill → 1턴 은신 | beforeHit 은신 중 → 치명, hit 50% → 은신 1턴 유지 | 발동 |
| 치유 | overflow → 대상 보호막 + 넘친 양 | 보호막 있는 아군 피해 ×1.2 | 발동 / `strikeAction` |
| 협공(파티) | beforeHit, 이번 턴 다른 아군이 친 대상 → ×1.3 | hit, 1턴 안 서로 다른 아군 3명 → 기절 | 발동 |
| 소환 | 소환 상한 +1 | summonDied → 그 자리 주변 1칸 적 피해 8 | `summon` / 발동 |
| 생존 | crisis → 보호막 최대체력 20% | crisis, 층당 1 → `immuneUntil = t + 1` | 발동 |
| 치명 | crit → 대상 출혈 | crit → `strike(…, 1, false)` (연쇄당 1) | 발동 |

판결(Ruling, 원장에 기록): 기본 규칙상 감전 튐은 이미 모든 2칸 적에게 가고 반격은 이미 적중 발동을 일으키므로, 스펙의 전기 3/6과 방패 6 문장을 위 굵은 글씨로 바꾸고 스펙 §3 표도 같이 고친다.

- [ ] **Step 1: 실패하는 테스트**

```ts
import { expect, it } from 'vitest';
import { resonant, tagCount, LAW_TEXT } from '../../src/sim/party/resonance';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { card } from '../../src/sim/party/traitTypes';
import { applyStatus } from '../../src/sim/party/status';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { scene, put } from './support/cardScene';

const fire = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => { const id = `f${i}`; TRAITS[id] = card(id, id, 'amp', ['화염'], 'common', 't', {}); return [id, 1]; }));

it('three fire cards light the first fire law, six the second; an empty body gets none', () => {
  const { p, u } = scene('mage'); u.gear = undefined;
  u.traits = fire(3);
  expect(tagCount(p, u).화염).toBe(3); expect(resonant(p, u, '화염', 1)).toBe(true); expect(resonant(p, u, '화염', 2)).toBe(false);
  u.traits = fire(6); expect(resonant(p, u, '화염', 2)).toBe(true);
  u.cls = 'shell'; expect(resonant(p, u, '화염', 1)).toBe(false);
  expect(LAW_TEXT.화염[0].length).toBeGreaterThan(4);
});

it('fire 3: a burning foe that dies sets its neighbours alight', () => {
  const { p, u, foes } = scene('mage'); u.gear = undefined; u.traits = fire(3);
  const [a, b] = foes; put(p, a!, 6, 4, 5); put(p, b!, 7, 4);
  const ev: never[] = [];
  applyStatus(p, u, a!, 'burn', 0, ev);
  damage(p, 0, u.id, a!, 99, ev);
  expect((b!.status.burn?.until ?? 0) > 0).toBe(true);
});

it('fire 6: burns stack and burn harder', () => {
  const { p, u, foes } = scene('mage'); u.gear = undefined; u.traits = fire(6);
  const [a] = foes; put(p, a!, 6, 4); const ev: never[] = [];
  applyStatus(p, u, a!, 'burn', 0, ev); applyStatus(p, u, a!, 'burn', 0, ev);
  expect(a!.status.burn?.stacks).toBe(2);
});

it('teamwork counts across the party', () => {
  const { p, u } = scene('warrior');
  TRAITS.tw = card('tw', 'tw', 'amp', ['협공'], 'common', 't', {});
  const others = p.units.filter((x) => x.side === 'hero' && x !== u);
  for (const h of others) { entOf(p, h.id)!.alive = true; h.cls = 'archer'; h.traits = { tw: 1 }; }
  u.traits = { tw: 1 };
  expect(tagCount(p, u).협공).toBe(3); expect(resonant(p, u, '협공', 1)).toBe(true);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/resonance.test.ts` → 모듈 없음.
- [ ] **Step 3: 구현** — `resonance.ts`에 판정·캐시·`LAW_TEXT`(스펙 §3 문장, 위 판결 반영)·`resonanceTriggers`(표의 "발동" 칸 법칙만, id는 `공명:화염3` 형식). `triggers.sourcesOf`에 `...resonanceTriggers(p, u)`. 표의 다른 위치는 각 함수에서 `resonant(p, by, tag, level)`로 묻는다(`by` = 상태를 건 클론 `unitOf(p, s.by)`). `damage`에서 영웅이 적을 칠 때 `dst.lastHitBy = src; dst.lastHitAt = t; dst.hitters = [...(dst.hitters ?? []).filter(h => t - h.t < 1 && h.id !== src), { id: src, t }]`. `heal`의 넘친 치유 사건은 `src.cls === 'healer'` 조건을 빼고 넘친 양이 있으면 항상 보낸다(치유사 기본 발동은 그대로 동작).
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/resonance.test.ts tests/unit/classKit.test.ts tests/unit/innateFix.test.ts` → PASS.
- [ ] **Step 5: 커밋** — `"태그 공명: 3·6 법칙, 협공은 파티 합산"` (스펙 §3 표 수정 포함)

---

### Task 5: 원소 반응과 공용 효과 도우미

**Files:**
- Modify: `src/sim/party/status.ts`, `src/sim/party/shield.ts` (상한 60, 출처 배수)
- Create: `src/sim/party/cardFx.ts`
- Test: `tests/unit/reactions.test.ts`

**Interfaces:**
- Produces (`cardFx.ts`):
```ts
export function foesNear(p: Party, at: Cell, r: number, side: 'foe' | 'hero' = 'foe'): Unit[];
export function counter(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[], mult?: number): void; // strike(basic false) + emit 'counter'; 방패 6·성스러운 방패 배수
export function stepBehind(p: Party, u: Unit, target: Unit, t: number, ev: GEvent[]): boolean; // 대상 곁 빈칸으로 순간이동(teleport 이벤트)
export function restore(p: Party, u: Unit, n: number): void; // 치유 금지(피의 계약)와 상관없이 체력을 되돌림(피해 무효화용)
export function mostHurt(p: Party): Unit | undefined;
```
- `SHIELD_CAP = 60`; `addShield(u, amount, src?)` — `src`가 신성 방벽을 가졌으면 `× (1 + 0.15 × (#방패 + #치유))`.
- 반응: `applyStatus` 끝에서 검사. 화상+냉기 → `증기`(대상 주변 1칸 적 `blindUntil = t + 2`, 피해 6), 화상+감전 → `과부하`(주변 1칸 피해 10), 냉기+감전 → `초전도`(대상 노출 2턴). 새 반응 셋은 두 상태를 지운다. 모든 반응(기존 독연·혈전, `statusMult`·마법사 파쇄 포함)은 `react` 이벤트와 함께 `emit(p, 'reaction', { t, src, target, status: id, reaction: 이름, ev })`. 반응 피해는 `× (1 + mods(src).react)`(Mods에 `react` 추가).

- [ ] **Step 1: 실패하는 테스트**

```ts
import { expect, it } from 'vitest';
import { applyStatus } from '../../src/sim/party/status';
import { entOf } from '../../src/sim/party/partyCore';
import { addShield, SHIELD_CAP } from '../../src/sim/party/shield';
import { scene, put } from './support/cardScene';

it('burn and chill make steam: the foes round are blinded and hurt, both states gone', () => {
  const { p, u, foes } = scene('mage'); const [a, b] = foes; put(p, a!, 6, 4); put(p, b!, 7, 4);
  const ev: { type: string; text?: string }[] = [];
  applyStatus(p, u, a!, 'burn', 0, ev as never); applyStatus(p, u, a!, 'chill', 0, ev as never);
  expect(ev.some((e) => e.type === 'react' && e.text === '증기')).toBe(true);
  expect((b!.blindUntil ?? 0) > 0).toBe(true); expect(entOf(p, b!.id)!.hp).toBeLessThan(200);
  expect(a!.status.burn).toBeUndefined(); expect(a!.status.chill).toBeUndefined();
});

it('burn and shock overload; chill and shock leave the foe exposed', () => {
  const { p, u, foes } = scene('mage'); const [a, b] = foes; put(p, a!, 6, 4); put(p, b!, 6, 5);
  const ev: never[] = [];
  applyStatus(p, u, a!, 'burn', 0, ev); applyStatus(p, u, a!, 'shock', 0, ev);
  expect(entOf(p, b!.id)!.hp).toBe(190);
  applyStatus(p, u, b!, 'chill', 0, ev); applyStatus(p, u, b!, 'shock', 0, ev);
  expect((b!.status.exposed?.until ?? 0) > 0).toBe(true);
});

it('shields now hold up to sixty', () => {
  const { u } = scene(); addShield(u, 100); expect(u.shield).toBe(SHIELD_CAP); expect(SHIELD_CAP).toBe(60);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/reactions.test.ts`.
- [ ] **Step 3: 구현** — 위 인터페이스대로. 초상화 보호막 바(`partyFrames.hpBar`)가 보호막을 최대체력 대비 비율로 그리면서 100%를 넘지 않게 `Math.min(1, …)`.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/reactions.test.ts tests/unit/shieldCarryFix.test.ts tests/unit/innateFix.test.ts` → PASS.
- [ ] **Step 5: 커밋** — `"원소 반응 3종, 반응 사건, 보호막 상한 60, 카드 효과 도우미"`

---

### Task 6: 공용 카드 12 + 서약 6

**Files:**
- Create: `src/sim/party/cardsCommon.ts`
- Modify: `src/sim/party/traitDefs.ts` (`COMMON` → 새 공용, `KEYSTONES` 유지), `traitCombat.ts`
- Delete: `src/sim/party/traitCommon.ts`
- Test: `tests/unit/cardsCommon.test.ts`; 고칠 것: `tests/unit/traits.test.ts`, `partyLevel.test.ts`, `basePower.test.ts`, `personalityData.test.ts`, `tests/bot/delveBotPolicy.ts`(옛 공용 id)

**Interfaces:**
- Consumes: `card`, `counter`, `foesNear`, `restore`, `mostHurt`, Cond `'wait'`, `Ctx.over`.
- Produces: `COMMON_CARDS: TraitDef[]` — id: `finish 마무리`, `combo 연타`, `reflex 반사 신경`, `initiative 선제`, `unyielding 불굴`, `morale 사기`, `leap 도약`, `bloodthirst 피의 갈증`, `firstAid 응급 처치`, `plunder 약탈자`, `bond 결속`, `cruel 잔혹`. `Unit`에 `critUntilKill?: boolean`.

카드 동작(스펙 §6.1; 판결: 연타는 "세 번째 공격마다", 불굴 강화는 "보호막 50%"):
- finish: kill → `empower = max(empower, 2)`; 강화: `min(4, max(2, empower + 1))`.
- combo: `nth`, nth 3(강화 2) → `strike(c.target, 1, false)`.
- reflex: dodge → `nextCrit`; 강화: + `counter(c.target)`.
- initiative: combatStart → `nextAt = t; nextCrit = true`; 강화: `critUntilKill = true`, beforeHit에서 `nextCrit = true`, kill에서 해제.
- unyielding: crisis → `addShield(u, maxHp × 0.3 (강화 0.5), u)` + 주변 1칸 적 노출.
- morale: kill → 2칸 안 아군 `heal 8`; 강화: + `addShield 12`.
- leap: beforeHit, `attackMoved` → 대상 노출; 강화: 기절.
- bloodthirst: kill, `over > 0` → `heal(self, over)`.
- firstAid: wait → `heal(self, maxHp × 0.15)`.
- plunder: kill → `bio += (brute/warlord ? 5 : 1)` (RoamParty일 때).
- bond: passive `{ bond: 0.15 }`.
- cruel: passive `(u) => ({ critDmg: 0.25 × tagsOf(u).치명 })`.

서약 6은 지금 구현(`KEYSTONES`)을 그대로 쓰고 `kind: 'oath'`, `text` = 지금 문장으로 바꾼다. 판결: 스펙 §6.8의 새 서약 문장 대신 현행 서약 규칙을 유지하고 스펙 §6.8을 현행 문장으로 고친다(이미 규칙형이고, 여섯 개를 갈아엎는 비용 대비 체감이 적음).

- [ ] **Step 1: 실패하는 테스트** (`tests/unit/cardsCommon.test.ts`)

```ts
import { expect, it } from 'vitest';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { emit, action } from '../../src/sim/party/triggers';
import { scene, put } from './support/cardScene';

it('finish: a kill doubles the next blow; upgraded it stacks up to four times', () => {
  const { p, u, foes } = scene('warrior'); const [a, b] = foes; put(p, a!, 5, 4, 1); put(p, b!, 5, 5);
  u.traits = { finish: 1 }; const ev: never[] = [];
  damage(p, 0, u.id, a!, 50, ev); expect(u.empower).toBe(2);
  u.traits = { finish: 2 }; u.empower = 3; put(p, a!, 5, 4, 1); damage(p, 0, u.id, a!, 50, ev); expect(u.empower).toBe(4);
});

it('bloodthirst heals by the overkill', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4, 10);
  u.traits = { bloodthirst: 1 }; entOf(p, u.id)!.hp = 20; const ev: never[] = [];
  damage(p, 0, u.id, a!, 40, ev);
  expect(entOf(p, u.id)!.hp).toBe(50);
});

it('combo: every third attack strikes again', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4, 999);
  u.traits = { combo: 1 }; let hits = 0; const ev: { type: string }[] = [];
  for (let i = 0; i < 3; i++) strike(p, u, a!, i, ev as never);
  hits = ev.filter((e) => e.type === 'bump').length;
  expect(hits).toBe(4);
});

it('first aid: waiting heals 15%', () => {
  const { p, u } = scene('warrior'); u.traits = { firstAid: 1 }; const e = entOf(p, u.id)!; e.hp = 10;
  action(p, () => emit(p, 'wait', { t: 0, src: u, ev: [] }));
  expect(e.hp).toBe(10 + Math.round(e.maxHp * 0.15));
});

it('unyielding: entering crisis gives a shield of 30% max health and exposes foes beside', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4);
  u.traits = { unyielding: 1 }; const e = entOf(p, u.id)!; e.hp = e.maxHp;
  damage(p, 0, a!.id, u, Math.ceil(e.maxHp * 0.6), []);
  expect(u.shield).toBe(Math.min(60, Math.round(e.maxHp * 0.3))); expect((a!.status.exposed?.until ?? 0) > 0).toBe(true);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/cardsCommon.test.ts`.
- [ ] **Step 3: 구현** — `cardsCommon.ts`에 12장을 `card(...)`로. 옛 공용 id(`tough`, `sprint`, `eagle`, `coverPro`, `grit`, `resonance`, `anger`, `absorb`, `weakness`, `pursuit`, `endure`, `seasoned`)를 참조하던 코드(`traitCombat.traitMult` pursuit, `partyLevel.gainXp` seasoned, `T` 기본값)는 정리한다(값이 0이 되므로 참조만 지움). 테스트에서 옛 id를 쓰던 곳은 같은 성격의 새 카드나 직접 수치 설정으로 바꾼다.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit` → 이 Task가 건드린 파일 PASS, 나머지 실패는 Task 7–9에서 다룰 옛 직업 특성 테스트뿐이어야 한다(실패 목록을 원장에 기록).
- [ ] **Step 5: 커밋** — `"공용 카드 12, 서약은 현행 규칙에 카드 문장"`

---

### Task 7: 전사·도적 카드 16 + 전사 기본 도발

**Files:**
- Create: `src/sim/party/cardsMelee.ts`
- Modify: `src/sim/party/partyCore.ts` (`targetOf` 전사 위협, `strikeAction` 저장 피해 `nextFlat`), `traitCombat.ts` (기습 배수), `status.ts` (출혈 중첩), `traitDefs.ts`
- Test: `tests/unit/cardsMelee.test.ts`

**Interfaces:**
- Produces: 전사 `thorns 가시 갑옷`, `rage 분노 축적`, `quake 땅 울림`, `battleCry 도발 함성`, `lastStand 최후의 버팀`, `bloodPrice 피의 대가`, `ironCounter 철벽 반격`, `steadfast 굳건함`; 도적 `vitals 급소 찌르기`, `execute 처형`, `openWounds 상처 벌리기`, `envenom 독 바르기`, `shadowStep 그림자 걸음`, `betrayal 배신의 칼날`, `toxicBurst 독 폭발`, `ambushArt 기습`. `Unit`에 `rage?: number; nextFlat?: number; judge?: number; betrayedAt?: number; chillHits?: number`.
- 전사 위협(기본): 도발이 없을 때, 2칸 안에 전사 계열(`warrior`, `berserker`, `guardian`)이 있으면 적은 그를 노린다.

카드 동작(스펙 §6.2·§6.6; 판결: 가시 갑옷 강화는 "반사 100%", 분노 강화는 "소모 시 주변 1칸 적에게 분노 × 4 피해", 최후의 버팀은 피격 직후 받은 만큼 되돌리는 방식):
- thorns: struck, 공격자 사거리 1 → `damage(attacker, amount × 0.5(강화 1.0), secondary)`.
- rage: struck → `rage = min(5, rage+1)`; beforeHit(basic) rage>0 → `attackMult × (1 + 0.3 × rage)`, 강화면 주변 1칸 적 `rage × 4` 피해, `rage = 0`.
- quake: struck, `amount ≥ maxHp × 0.2` → 주변 1칸 적 기절; 강화: + 노출.
- battleCry: combatStart → 3칸 안 적 `tauntUntil = t + 2, tauntBy = u.id`; 강화: struck, 공격자가 이 전사에게 도발됨 → 공격자 노출.
- lastStand: struck, 체력 < 50%, 20%(강화 35%) → `restore(u, amount)` + `counter(attacker)`.
- bloodPrice: struck → `nextFlat += amount × 0.3`; `strikeAction`이 피해에 `nextFlat`를 더하고 0으로.
- ironCounter: passive `{ counter: 0.5 }` + counter 사건 25% → 대상 기절.
- steadfast: passive `(u) => ({ taken: -0.05 × tagsOf(u).방패 })`.
- vitals: beforeHit → `attackMult × (1 + 0.25(강화 0.4) × 대상의 살아 있는 상태 수)`.
- execute: beforeHit, 대상 체력 < 25%(강화 35%) → 보스(`warlord`)면 ×2, 아니면 ×99.
- openWounds: hit → 출혈 +1중첩(상한 5, 강화 8). `applyStatus` 출혈은 `min(cap, old + stacks)`로 누적.
- envenom: hit → 중독 1(강화 2).
- shadowStep: kill → `hiddenUntil = t + 1` + 가장 가까운 적에게 `stepBehind`; 강화: 이어서 `strike(…, 1, false)`.
- betrayal: hit, 대상의 목표가 내가 아님, `t - betrayedAt ≥ 3`(강화 0) → 기절, `betrayedAt = t`.
- toxicBurst: statusApplied 중독, 중첩 ≥ 5 → `damage(target, 6 × 중첩, secondary)`, 중독 제거, 주변 1칸 적 중독 2.
- ambushArt: `traitMult` 은신 분기에서 `× (1 + 0.5 × tagsOf(u).은신)`.

- [ ] **Step 1: 실패하는 테스트** (`tests/unit/cardsMelee.test.ts`)

```ts
import { expect, it } from 'vitest';
import { damage, entOf, strike, targetOf } from '../../src/sim/party/partyCore';
import { applyStatus } from '../../src/sim/party/status';
import { scene, put } from './support/cardScene';

it('a foe near a warrior goes for the warrior', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 6, 4);
  const other = p.units.find((x) => x.side === 'hero' && x !== u)!; entOf(p, other.id)!.alive = true; other.cls = 'archer'; entOf(p, other.id)!.pos = { x: 7, y: 4 };
  expect(targetOf(p, a!, 0)?.id).toBe(u.id);
});

it('thorns send back half a melee blow', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4);
  u.traits = { thorns: 1 }; u.shield = 0;
  damage(p, 0, a!.id, u, 20, []);
  expect(entOf(p, a!.id)!.hp).toBe(190);
});

it('rage builds with each blow taken and spends itself on the next strike', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4, 999);
  u.traits = { rage: 1 };
  for (let i = 0; i < 3; i++) damage(p, i, a!.id, u, 1, []);
  expect(u.rage).toBe(3);
  strike(p, u, a!, 5, []); expect(u.rage).toBe(0);
});

it('vitals: each state on the foe adds a quarter', () => {
  const { p, u, foes } = scene('rogue'); const [a] = foes; put(p, a!, 5, 4, 999);
  const ev: never[] = []; applyStatus(p, u, a!, 'poison', 0, ev); applyStatus(p, u, a!, 'bleed', 0, ev);
  u.traits = { vitals: 1 }; u.attackMult = 1;
  const before = entOf(p, a!.id)!.hp; p.s.rng.chance = () => true; strike(p, u, a!, 1, []);
  expect(before - entOf(p, a!.id)!.hp).toBeGreaterThan(0);
});

it('toxic burst: five poison stacks blow up and spread', () => {
  const { p, u, foes } = scene('rogue'); const [a, b] = foes; put(p, a!, 5, 4); put(p, b!, 6, 4);
  u.traits = { toxicBurst: 1 }; const ev: never[] = [];
  applyStatus(p, u, a!, 'poison', 0, ev, 5);
  expect(a!.status.poison).toBeUndefined(); expect(entOf(p, a!.id)!.hp).toBe(170); expect(b!.status.poison?.stacks).toBe(2);
});

it('shadow step: a kill hides the rogue and puts it behind the nearest foe; no foe left, no step and no error', () => {
  const { p, u, foes } = scene('rogue'); const [a, b] = foes; put(p, a!, 5, 4, 1); put(p, b!, 9, 4);
  u.traits = { shadowStep: 1 };
  damage(p, 0, u.id, a!, 50, []);
  expect(u.hiddenUntil).toBe(1); expect(Math.abs(entOf(p, u.id)!.pos.x - 9)).toBeLessThanOrEqual(1);
  entOf(p, b!.id)!.alive = false; put(p, a!, 5, 4, 1); expect(() => damage(p, 2, u.id, a!, 50, [])).not.toThrow();
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/cardsMelee.test.ts`.
- [ ] **Step 3: 구현** — `cardsMelee.ts`에 16장. 옛 전사·도적 특성 id(`whirlwind` 등)를 쓰던 코드(`classKit` 포위 베기 cd·범위, 응수 배수는 `T.counter` 유지)를 정리하고, 응수의 `strike`를 `counter(...)`로 바꾼다.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/cardsMelee.test.ts tests/unit/innateFix.test.ts tests/unit/classKit.test.ts` → PASS.
- [ ] **Step 5: 커밋** — `"전사·도적 카드 16, 전사 기본 위협"`

---

### Task 8: 궁수·마법사 카드 16

**Files:**
- Create: `src/sim/party/cardsRanged.ts`
- Modify: `src/sim/party/status.ts` (사냥꾼의 눈 표식 배수, 번개 사슬 2차 튐), `kitEffects.ts` (`fireball`의 `current` 참조 정리), `traitDefs.ts`
- Test: `tests/unit/cardsRanged.test.ts`

**Interfaces:**
- Produces: 궁수 `huntMark 사냥 표식`, `pierce 관통 화살`, `rapidFire 연속 사격`, `poisonArrow 독화살`, `spikeTrap 가시 덫`, `rollShot 구르며 쏘기`, `focusFire 집중 사격`, `hunterEye 사냥꾼의 눈`; 마법사 `elemCycle 원소 순환`, `chainReact 연쇄 반응`, `combust 연소 폭발`, `frostPrison 서리 감옥`, `arcChain 번개 사슬`, `manaBack 마력 역류`, `overload 원소 과부하`, `reactAmp 반응 증폭`. `Unit`에 `markFirst?: boolean; cycle?: number`.

카드 동작(스펙 §6.3·§6.4; 판결: 덫은 바닥 물체 대신 "대기하면 주변 1칸(강화 2칸) 적 출혈 + 1턴 묶임(기절)", 마력 역류는 "피격 시 받은 피해 30%만큼 보호막"):
- huntMark: combatStart → `markFirst = true`; beforeHit(사거리>1) `markFirst` → 대상 표식, 해제; 강화: kill, 대상 표식 → 가장 가까운 적 표식.
- pierce: hit(사거리>1) → 사수→대상 방향 직선에서 대상 뒤 첫 적에게 `damage(roll)`; 강화: 직선 위 모든 적.
- rapidFire: hit(사거리>1), 대상 표식, 25%(강화 40%) → `strike(…, 1, false)`.
- poisonArrow: hit, 대상 표식 → 중독 2; 강화: statusApplied 표식(내가 건 것) → 중독 2.
- spikeTrap: wait → 1칸(강화 2칸) 적 출혈 + 기절.
- rollShot: beforeHit `retreatShot` → `nextCrit`.
- focusFire: passive `(u) => ({ crit: 0.1 × min(4, u.still) })`.
- hunterEye: 표식 배수 `1.3 + 0.1 × tagsOf(attacker).원거리` (공격자가 hunterEye를 가졌을 때; `statusMult`와 `damage`의 표식 계산 둘 다 같은 함수 `markMult(p, attacker)`로).
- elemCycle: hit → `[burn, chill, shock][cycle % 3]` 부여, `cycle++`; 강화: 다음 원소도 함께.
- chainReact: reaction → 대상 주변 1칸(강화 2칸) 적에게 `c.status` 부여(spread).
- combust: kill, 대상 화상 → 대상 주변 1칸 적 `damage(maxHp(대상) × 0.25)` + 화상; 강화: `repeat: true`(폭발로 죽은 적도 폭발, 연쇄 상한 12가 막음).
- frostPrison: statusApplied 냉기(내가 건 것) → `chillHits++`, 2가 되면 빙결·0으로; 강화: 빙결 시 주변 1칸 적 냉기.
- arcChain: 감전 튐 뒤, 튄 적 각각에서 한 번 더 2칸 안 아직 안 맞은 적에게 튐; 강화: 두 번째 튐 피해 ×1.5.
- manaBack: struck → `addShield(u, amount × 0.3, u)`.
- overload: ultimate → 3칸 안 적에게 화상·냉기·감전.
- reactAmp: passive `(u) => ({ react: 0.4 × [화염, 냉기, 전기 중 tagsOf>0인 종류 수] })`.

- [ ] **Step 1: 실패하는 테스트** (`tests/unit/cardsRanged.test.ts`)

```ts
import { expect, it } from 'vitest';
import { damage, entOf, strike } from '../../src/sim/party/partyCore';
import { applyStatus } from '../../src/sim/party/status';
import { action, emit } from '../../src/sim/party/triggers';
import { scene, put } from './support/cardScene';

it('hunt mark: the first shot of a fight marks', () => {
  const { p, u, foes } = scene('archer'); u.weapon = 'longbow'; const [a] = foes; put(p, a!, 8, 4, 999);
  u.traits = { huntMark: 1 }; action(p, () => emit(p, 'combatStart', { t: 0, src: u, ev: [] }));
  p.s.rng.chance = () => true; strike(p, u, a!, 1, []);
  expect((a!.status.mark?.until ?? 0) > 1).toBe(true);
});

it('pierce: the shot goes on into the foe behind', () => {
  const { p, u, foes } = scene('archer'); u.weapon = 'longbow'; const [a, b] = foes; put(p, a!, 7, 4, 999); put(p, b!, 9, 4);
  u.traits = { pierce: 1 }; p.s.rng.chance = () => true; strike(p, u, a!, 1, []);
  expect(entOf(p, b!.id)!.hp).toBeLessThan(200);
});

it('combust: a burning foe that dies blows up; upgraded, the blast can set off more blasts', () => {
  const { p, u, foes } = scene('mage'); const [a, b, c] = foes; put(p, a!, 5, 4, 5); put(p, b!, 6, 4, 10); put(p, c!, 7, 4);
  u.traits = { combust: 2 }; const ev: never[] = [];
  applyStatus(p, u, a!, 'burn', 0, ev); applyStatus(p, u, b!, 'burn', 0, ev);
  damage(p, 0, u.id, a!, 99, ev);
  expect(entOf(p, b!.id)!.alive).toBe(false); expect(entOf(p, c!.id)!.hp).toBeLessThan(200);
});

it('frost prison: a second chill freezes', () => {
  const { p, u, foes } = scene('mage'); const [a] = foes; put(p, a!, 5, 4);
  u.traits = { frostPrison: 1 }; const ev: never[] = [];
  applyStatus(p, u, a!, 'chill', 0, ev); applyStatus(p, u, a!, 'chill', 0, ev);
  expect((a!.status.freeze?.until ?? 0) > 0).toBe(true);
});

it('elemental cycle: burn, then chill, then shock', () => {
  const { p, u, foes } = scene('mage'); const [a] = foes; put(p, a!, 6, 4, 999);
  u.traits = { elemCycle: 1 }; p.s.rng.chance = () => true;
  strike(p, u, a!, 0, []); expect(a!.status.burn).toBeDefined();
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/cardsRanged.test.ts`.
- [ ] **Step 3: 구현** — `cardsRanged.ts`에 16장. 옛 궁수·마법사 특성 id(`steady`, `retreat`, `arrowShower`, `current`, `quickChant`, `flow` 등) 참조를 정리한다(`T.steadyMax`는 기본 3 유지, `ultimate.ts`의 arrowShower 분기 삭제). `triggerFix.test.ts`의 `u.traits = { steady: 3 }`은 정조준 최대치를 직접 바꾸는 방식으로 고친다.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/cardsRanged.test.ts tests/unit/triggerFix.test.ts tests/unit/reactions.test.ts` → PASS.
- [ ] **Step 5: 커밋** — `"궁수·마법사 카드 16"`

---

### Task 9: 성직자 카드 8 + 듀오 10

**Files:**
- Create: `src/sim/party/cardsSupport.ts`
- Modify: `src/sim/party/triggers.ts` (`sourcesOf`에 듀오), `traitCombat.ts` (`shieldBroken`에 보호막 폭발·성스러운 방패, 아군 사망 시 순교), `partyCore.damage` (순교 강화 버팀), `kitEffects.heal`(`purify` 참조 정리)
- Delete: `src/sim/party/traitClasses.ts`, `src/sim/party/traitAdvanced.ts`의 상위 직업 특성(서약만 `cardsCommon.ts`로 옮김)
- Test: `tests/unit/cardsSupport.test.ts`

**Interfaces:**
- Produces: 성직자 `shieldBurst 보호막 폭발`, `judgment 심판 낙인`, `answeredPrayer 응답하는 기도`, `blessingMore 축복 확산`, `martyr 순교`, `overflowGrace 넘친 은총`, `lifeTransfer 생명 전이`, `sacredWall 신성 방벽`; 듀오 `bait`, `shatterDuo`, `holyShield`, `gap`, `elemArrow`, `lightArrow`, `prey`, `purifyFlame`, `toxicSmoke`, `bloodFeast`.
- `duoActive(p, id): boolean` — 살아 있는 영웅 중 누가 그 듀오 카드를 가졌고, 짝 두 직업(기본 계열 기준)이 모두 살아 있음.
- `sourcesOf(u)`: 활성 듀오 중 `who`가 `u`의 기본 계열이거나 `'any'`인 것의 발동.

카드 동작(스펙 §6.5·§6.7; 판결: 축복 확산은 성직자 기본 축복이 이미 파티 전원이라 "전투 시작 시 아군 전원 보호막 +10, 강화: 처치한 아군에게 보호막 5", 사냥감은 "도적이 표식된 체력 40% 미만 적을 치면 ×2", 맹독 연기는 "독 폭발 때 주변 적에게 화상도 걸어 독연을 일으킴"):
- shieldBurst: 아군 보호막 파괴 → 그 아군 주변 1칸 적에게 깨진 양만큼 피해; 강화: + 기절.
- judgment: hit → `judge++`, 5(강화 3)에 피해 20 + 기절, 0으로.
- answeredPrayer: allyCrisis/crisis → 대상 `heal 20` + 보호막 10; 강화: 파티 전원.
- blessingMore: combatStart → 아군 전원 보호막 10; 강화: kill(어느 아군이든 자기 발동) → 처치자 보호막 5.
- martyr: 영웅이 쓰러지면 살아 있는 아군 체력 30% 회복 + `damageBuff 1.3, 2턴`; 강화: 층당 한 번 아군의 치명타를 체력 1로 버팀.
- overflowGrace: overflow → 대상 보호막 `넘친 양 × 2`.
- lifeTransfer: healed(내가 치유) → 대상에 가장 가까운 적 `치유량 × 0.3` 피해.
- sacredWall: `addShield`의 출처 배수(Task 5).
- 듀오: bait(전사 struck → 공격자 표식), shatterDuo(전사 beforeHit 빙결 대상 → ×2, 빙결 해제, 주변 1칸 냉기), holyShield(전사 반격 ×2 보호막 있는 동안, 보호막 파괴 시 `rage = 5`), gap(도적 beforeHit 기절 대상 → `nextCrit`), elemArrow('any', reaction 대상 표식 → 주변 1칸 적 표식), lightArrow(궁수 hit 표식 → `mostHurt` 치유 4), prey(도적), purifyFlame(성직자 overflow → 대상 주변 1칸 적 화상), toxicSmoke(도적, 독 폭발 연동), bloodFeast('any', hit 출혈 대상 → `mostHurt` 치유 3).

- [ ] **Step 1: 실패하는 테스트** (`tests/unit/cardsSupport.test.ts`)

```ts
import { expect, it } from 'vitest';
import { damage, entOf } from '../../src/sim/party/partyCore';
import { duoActive } from '../../src/sim/party/cardsSupport';
import { action, emit } from '../../src/sim/party/triggers';
import { scene, put } from './support/cardScene';

it('shield burst: an ally\'s broken shield hurts the foes beside it', () => {
  const { p, u, foes } = scene('cleric'); const [a] = foes; put(p, a!, 5, 4);
  u.traits = { shieldBurst: 1 }; u.shield = 12;
  damage(p, 0, a!.id, u, 20, []);
  expect(entOf(p, a!.id)!.hp).toBe(188);
});

it('judgment: the fifth mark bursts', () => {
  const { p, u, foes } = scene('cleric'); const [a] = foes; put(p, a!, 5, 4, 999);
  u.traits = { judgment: 1 }; a!.judge = 4;
  action(p, () => emit(p, 'hit', { t: 0, src: u, target: a, ev: [] }));
  expect(a!.judge).toBe(0); expect((a!.status.stun?.until ?? 0) > 0).toBe(true);
});

it('a duo works only while both classes stand', () => {
  const { p, u } = scene('warrior');
  const other = p.units.find((x) => x.side === 'hero' && x !== u)!; other.cls = 'archer'; entOf(p, other.id)!.alive = true;
  u.traits = { bait: 1 };
  expect(duoActive(p, 'bait')).toBe(true);
  entOf(p, other.id)!.alive = false; expect(duoActive(p, 'bait')).toBe(false);
});

it('bait: a foe that hits the warrior is marked (archer alive)', () => {
  const { p, u, foes } = scene('warrior'); const [a] = foes; put(p, a!, 5, 4);
  const other = p.units.find((x) => x.side === 'hero' && x !== u)!; other.cls = 'archer'; entOf(p, other.id)!.alive = true; entOf(p, other.id)!.pos = { x: 1, y: 1 };
  u.traits = { bait: 1 }; damage(p, 0, a!.id, u, 5, []);
  expect((a!.status.mark?.until ?? 0) > 0).toBe(true);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/cardsSupport.test.ts`.
- [ ] **Step 3: 구현** — `cardsSupport.ts`에 18장과 `duoActive`. `traitDefs.TRAITS`를 `COMMON_CARDS + MELEE + RANGED + SUPPORT + KEYSTONES`로. 옛 성직자·상위 직업 특성 id 참조(`quickPrayer`, `purify`, `lifeSpring`, `retribution`, `divinePunish`, `boneArmor` 등)를 정리한다. 옛 특성 텍스트 파일 `traitTextClass.ts`, `traitTextAdvanced.ts`, `traitTextUtil.ts` 삭제, `traitText.ts`는 카드 문장만.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit` 전체 PASS(옛 id를 쓰던 테스트를 모두 고친 상태). `npx tsc --noEmit -p .`, `npm run lint` 통과.
- [ ] **Step 5: 커밋** — `"성직자 카드 8, 듀오 10, 옛 특성 정리"`

---

### Task 10: 제시 규칙

**Files:**
- Modify: `src/sim/party/traitPool.ts`
- Test: `tests/unit/cardOffer.test.ts`

**Interfaces:**
- Produces: `rollOffer(p, u): string[]` —
  - 직업 2장: 기본 계열 풀(상위 직업도 기본 계열 풀; 전직한 상위 직업은 스펙 §6.9대로 그 방향 태그 가중치 ×2). 아직 강화 안 된 내 법칙 카드(`rank < ranks`)도 같은 풀에서 나온다.
  - 1장: 공용 ∪ 활성 가능 듀오(짝 직업이 살아 있는 듀오) ∪ 내 공용 카드 강화.
  - 레벨 2(첫 레벨업): 직업 2장은 `kind === 'law'`만.
  - 학자 기억(Task 11): 공용 칸 1장 더.
  - 풀이 모자라면 있는 만큼(0장이면 공용으로 채움).

- [ ] **Step 1: 실패하는 테스트**

```ts
import { expect, it } from 'vitest';
import { rollOffer } from '../../src/sim/party/traitPool';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { entOf } from '../../src/sim/party/partyCore';
import { scene } from './support/cardScene';

it('the first level-up offers two laws of the class and one more', () => {
  const { p, u } = scene('mage'); u.level = 2;
  const o = rollOffer(p, u);
  expect(o).toHaveLength(3);
  expect(o.slice(0, 2).every((id) => TRAITS[id]!.kind === 'law' && TRAITS[id]!.pool === 'mage')).toBe(true);
});

it('an owned law comes back as its upgrade', () => {
  const { p, u } = scene('mage'); u.level = 3;
  const laws = Object.values(TRAITS).filter((d) => d.pool === 'mage');
  u.traits = Object.fromEntries(laws.map((d) => [d.id, 1]));
  const o = rollOffer(p, u);
  expect(o.filter((id) => TRAITS[id]!.pool === 'mage').every((id) => (u.traits![id] ?? 0) === 1 && TRAITS[id]!.ranks === 2)).toBe(true);
});

it('duos are offered only with the partner class alive; an exhausted pool still offers something', () => {
  const { p, u } = scene('warrior'); u.level = 5;
  const duoIds = Object.values(TRAITS).filter((d) => d.pool === 'duo').map((d) => d.id);
  for (let i = 0; i < 30; i++) expect(rollOffer(p, u).some((id) => duoIds.includes(id))).toBe(false);
  u.traits = Object.fromEntries(Object.values(TRAITS).filter((d) => d.pool !== 'keystone').map((d) => [d.id, d.ranks]));
  expect(rollOffer(p, u).length).toBeGreaterThanOrEqual(0);
  const other = p.units.find((x) => x.side === 'hero' && x !== u)!; other.cls = 'archer'; entOf(p, other.id)!.alive = true;
  u.traits = {};
  let seen = false; for (let i = 0; i < 60 && !seen; i++) seen = rollOffer(p, u).includes('bait');
  expect(seen).toBe(true);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/cardOffer.test.ts`.
- [ ] **Step 3: 구현** — 위 규칙. 레벨업 화면이 0장 제시를 받으면 선택 없이 `picks--`(traitPicker가 빈 제시를 닫음).
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/cardOffer.test.ts tests/unit/partyLevel.test.ts` → PASS.
- [ ] **Step 5: 커밋** — `"제시 규칙: 첫 레벨업 법칙 보장, 강화, 듀오"`

---

### Task 11: 영혼의 기억

**Files:**
- Create: `src/sim/party/memories.ts`
- Modify: `src/sim/roam/roam.ts` (`Soul.memory`, `CarriedSoul`, 줍기·주입), `src/sim/delve/delveSim.ts` (`placeSouls`, `descend` 순례자), `src/sim/overworld/worldGen.ts` (`placeSouls`), `src/sim/party/triggers.ts` (`sourcesOf`), `classKit.tagsOf`, `traitPool.ts` (학자), `src/ui/overworld/pipWindow.ts` (영혼 칸 표시는 Task 13)
- Test: `tests/unit/memories.test.ts`

**Interfaces:**
- Produces:
```ts
export type MemoryId = 'burnt' | 'shieldKeeper' | 'hunter' | 'traitor' | 'poisoner' | 'pilgrim' | 'scholar' | 'herald' | 'frostGrave' | 'lightning' | 'butcher' | 'warden';
export const MEMORIES: Record<MemoryId, { name: string; tag: Tag; text: string; trigger?: TriggerDef }>;
export const MEMORY_IDS: MemoryId[];
export function rollMemory(rng: Rng): MemoryId;
```
- `Soul.memory?: MemoryId`; `CarriedSoul = BaseClass | { cls: BaseClass; hero?: HeroSoulId; memory?: MemoryId }` — 영웅 영혼 판정은 `typeof s !== 'string' && !!s.hero`로 바꾼다(지금 `typeof s !== 'string'`을 영웅 뜻으로 쓰는 곳 모두).
- `Unit.memory?: MemoryId`; `implant`가 `soul.memory`를 옮긴다.
- 기억 동작(스펙 §7): burnt(kill → 인접 적 화상), shieldKeeper(combatStart 표시, 첫 struck → `restore`), hunter(beforeHit 체력 가득 → 표식), traitor(kill → 은신 1), poisoner(combatStart 표시, 첫 hit → 중독 3), pilgrim(`descend`에서 체력 가득), scholar(제시 +1), herald(combatStart → 아군 전원 `nextAt = t`), frostGrave(struck → 공격자 냉기), lightning(crit → 감전), butcher(hit 사거리 1, 30% → 출혈), warden(allyCrisis → 그 아군 곁으로 `stepBehind` 대신 곁 빈칸 순간이동 + 그 아군 보호막 10).

- [ ] **Step 1: 실패하는 테스트**

```ts
import { expect, it } from 'vitest';
import { newDelve, delveTick } from '../../src/sim/delve/delveSim';
import { entOf, damage } from '../../src/sim/party/partyCore';
import { implantCarried, clones } from '../../src/sim/roam/roam';
import { MEMORIES, MEMORY_IDS } from '../../src/sim/party/memories';
import { tagsOf } from '../../src/sim/party/classKit';

it('every soul lying about carries a memory; it goes along when picked up and into the body when implanted', () => {
  const p = newDelve(2);
  expect(p.souls.every((s) => !!s.memory)).toBe(true);
  const s = p.souls[0]!; entOf(p, 'hero')!.pos = { ...s.pos }; delveTick(p, 0.1);
  expect(typeof p.carried[0] === 'object' && p.carried[0].memory).toBe(s.memory);
  implantCarried(p, 'hero', 0);
  const u = clones(p)[0]!; expect(u.memory).toBe(s.memory);
  expect(tagsOf(u)[MEMORIES[s.memory!].tag]).toBeGreaterThanOrEqual(1);
});

it('twelve memories, each with a tag and a line', () => {
  expect(MEMORY_IDS).toHaveLength(12);
  for (const id of MEMORY_IDS) { expect(MEMORIES[id].text.length).toBeGreaterThan(3); expect(MEMORIES[id].tag).toBeDefined(); }
});

it('frost grave: whoever hits the clone is chilled', () => {
  const p = newDelve(2);
  entOf(p, 'hero')!.pos = { ...p.souls[0]!.pos }; delveTick(p, 0.1); implantCarried(p, 'hero', 0);
  const u = clones(p)[0]!; u.memory = 'frostGrave';
  const f = p.units.find((x) => x.side === 'foe')!; entOf(p, f.id)!.alive = true;
  damage(p, p.time, f.id, u, 3, []);
  expect((f.status.chill?.until ?? 0) > 0).toBe(true);
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/memories.test.ts`.
- [ ] **Step 3: 구현** — 위 인터페이스대로. 영혼 생성 시 `rollMemory(rng)`(던전 `placeSouls`, 지상 `placeSouls` 모두). 줍기는 영웅이 아니면 `{ cls, memory }`로 운반.
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/memories.test.ts tests/unit/overworld.test.ts tests/unit/delve.test.ts tests/unit/surface.test.ts tests/unit/delveRoomEdges.test.ts` → PASS(운반 형태 변경으로 `toEqual(['archer'])` 같은 기대값은 `cls` 비교로 고친다).
- [ ] **Step 5: 커밋** — `"영혼의 기억 12종: 생성, 운반, 주입, 시작 규칙"`

---

### Task 12: 봇 밸런스 측정

**Files:**
- Modify: 카드·공명 수치(필요한 곳만)
- Test: 기존 봇 `tests/bot/*` 중 던전 빌드 봇(`tests/unit/delveBuildBot.test.ts`가 쓰는 정책)

**Interfaces:**
- Consumes: Task 1–11 전부.

- [ ] **Step 1: 측정** — 던전 빌드 봇으로 레벨 8 근처 3인 파티의 8층 클리어율(태그 맞춘 빌드 vs 무작위 선택)과 4층 이후 3단 이상 연쇄 비율(chain 이벤트 수 / 전투 수)을 seed 20개로 잰다. 결과를 원장에 기록한다.
- [ ] **Step 2: 판정** — 스펙 §8 목표(맞춘 빌드 70% 이상, 무작위 40% 이상, 연쇄 30% 이상)와 비교한다. 크게 벗어나면(±15%p 이상) 가장 큰 원인 카드·공명의 수치만 조정하고 다시 잰다(최대 3회). 조정 내역은 원장에 `Ruling:`으로.
- [ ] **Step 3: 통과 확인** — `npx vitest run` 전체 PASS.
- [ ] **Step 4: 커밋** — `"카드 밸런스 1차 조정"`

---

### Task 13: 화면 — 카드, 공명, 기억, 연쇄

**Files:**
- Modify: `src/ui/overworld/traitPicker.ts`, `src/ui/overworld/pipWindow.ts`, `src/ui/overworld/pipSkills.ts`, `src/ui/overworld/worldScreen.ts`, `src/ui/delve/delveScreen.ts`, `src/ui/styles/worldPanels.css`
- Create: `src/ui/overworld/resonanceHtml.ts`
- Test: `tests/unit/resonanceHtml.test.ts`

**Interfaces:**
- Consumes: `KIND_NAME`, `traitText`, `tagCount`, `resonant`, `LAW_TEXT`, `RESONANCE_AT`, `MEMORIES`.
- Produces: `resonanceHtml(p, u): string` — 태그가 1 이상인 태그마다 `#화염 4/6` 한 줄, 켜진 법칙 문장(초록), 다음 단계 문장(흐림).

화면 규칙(스펙 §12):
- 카드: 종류 배지(`법칙`·`증폭`·`변환`·`듀오`·`서약`, 강화 제시는 `강화`), 아크라식 한 줄, 태그. 이 카드로 공명이 새로 켜지면 `#화염 3 → 공명` 한 줄.
- 상태 탭: 특성 목록 아래 `공명` 블록(`resonanceHtml`).
- 가방 영혼 칸: `궁수의 영혼` 아래 기억 이름(작게).
- 연쇄: `chain` 이벤트 → 화면 가운데 위 `연쇄 ×n` 팝업(토스트와 별개, 0.9초). 두 화면 모두.

- [ ] **Step 1: 실패하는 테스트**

```ts
import { expect, it } from 'vitest';
import { resonanceHtml } from '../../src/ui/overworld/resonanceHtml';
import { TRAITS } from '../../src/sim/party/traitDefs';
import { scene } from './support/cardScene';

it('the status tab lists each tag with its count toward the next law, lit laws marked', () => {
  const { p, u } = scene('mage'); u.gear = undefined;
  const fire = Object.values(TRAITS).filter((d) => d.tags.includes('화염') && d.pool !== 'duo').slice(0, 3);
  u.traits = Object.fromEntries(fire.map((d) => [d.id, 1]));
  const html = resonanceHtml(p, u);
  expect(html).toContain('#화염'); expect(html).toContain('3/6'); expect(html).toContain('class="on"');
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/resonanceHtml.test.ts`.
- [ ] **Step 3: 구현** — 위 규칙. CSS는 `worldPanels.css`에(400줄 넘으면 `worldCards.css`로 분리하고 두 화면에서 import).
- [ ] **Step 4: 통과 확인** — `npx vitest run tests/unit/resonanceHtml.test.ts`, `npx tsc --noEmit -p .`, `npm run lint`. 개발 서버(5199)를 재시작하고 세로·가로 스크린샷으로 레벨업 카드, 상태 탭 공명, 연쇄 팝업을 눈으로 확인한다.
- [ ] **Step 5: 커밋** — `"화면: 카드 종류·강화, 공명 진행도, 기억 이름, 연쇄 팝업"`

---

### Task 14: 마무리 검증

- [ ] **Step 1:** `npx vitest run`, `npx playwright test`, `npm run lint`, `npx tsc --noEmit -p .` 모두 통과.
- [ ] **Step 2:** 스펙 §3·§6.8 수정분(판결 반영)이 문서에 들어갔는지 확인.
- [ ] **Step 3:** push 후 CI 성공 확인(자기 CI 실행만 조회).
- [ ] **Step 4:** 커밋 — `"규칙형 특성 체계 A 마무리"`
