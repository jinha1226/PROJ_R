# Engraving Engine, Pistol Element Rounds, Engraving Families — Implementation Plan

> **For agentic workers:** implemented by Codex in a git worktree, one Part per run (A, then B, then C1, then C2). Tests first for every rule. Do not commit, push or stage. Do not edit `tests/e2e/**`. **Do not tune balance numbers** (that comes later, once builds exist).

**Goal:** Grow the suit engravings from 26 hard-coded entries to ~60 data-driven ones in four families (melee, ranged, fusion, element), make the pistol the only gun with element rounds, drop staffs, and make every engraving unlockable at the ship.

**Architecture:** A small trigger bus (`src/sim/grid/kataBus.ts`): attack paths emit named triggers with a context; data-defined engravings (`src/sim/grid/engraveDefs.ts`) say which trigger they answer, an optional condition, and an effect from an effect registry (`src/sim/grid/kataEffects.ts`). The existing hand-written engravings keep their code but gain family/tag/cost metadata; the six gun-kata rules from `kata.ts` move onto the bus. Element rounds ride on the existing status/reaction code (`status.ts`, `reactions.ts`).

**Tech Stack:** TypeScript, vitest; deterministic sim (`src/sim/grid/**`: no DOM, no `Math.random`, no `Date.now`; randomness only from `s.rng`).

**Spec:** decided with the user 2026-10-05: four families (근접 / 원거리 / 퓨전 / 원소); every engraving unlockable at the ship; elite kind decides the echo's family; light family resonance at 3 of a kind; tags so engravings chain across families; pistol only, element rounds (화염/빙결/전격/독) chosen at launch, a second element can be gained in a run; staffs removed; charge only from melee (no new charge pickups).

## Global Constraints
- Files ≤ 300 lines (`npm run lint`). Split instead of growing past it.
- Player text: Korean, terse labels (a name and a short `조건 → 효과` note, no sentences).
- Each engraving fires at most once per hero action (`fire()` and `s.fired`); bus effects go through `fire()` too.
- Engraving shots spend suit charge; not enough charge → the effect does not happen.
- Old saves and old meta load (missing fields default; removed weapons/ids are dropped or converted, never crash).
- Done per Part = `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` pass.

## Review Focus
1. Bus re-entrancy: an effect that kills can emit `gunKill`/`meleeKill` again; only `fire()` stops loops — test a two-engraving ping-pong.
2. Old saves holding a shotgun, rifle or staff (in hand or bag) or a removed engraving id must load: guns become a pistol, staffs are removed, unknown ids dropped.
3. Element status on bosses (champion) works but never stun-locks: freeze/stun from engravings on a champion is capped at 1 turn.
4. Resonance counts only engravings currently on the suit (not tasted/unlocked lists) and updates when the suit changes.
5. The armory's element choice persists in the remembered loadout and an unlocked-but-not-chosen element is never applied.

---

# Part A — the trigger bus (one run)

### Task A1: Bus, effects registry, definitions

**Files:** Create `src/sim/grid/kataBus.ts`, `src/sim/grid/kataEffects.ts`, `src/sim/grid/engraveDefs.ts`; tests `tests/sim/grid/kataBus.test.ts`.

```ts
// kataBus.ts
export type Trigger =
  | 'meleeHit' | 'meleeKill' | 'gunHit' | 'gunKill' | 'dodge' | 'parry' | 'hurt'
  | 'stunned' | 'elementApplied' | 'reaction' | 'surrounded' | 'afterMove' | 'afterSwap' | 'afterWait' | 'chain';
export interface TriggerCtx { t: number; foe?: Ent; src?: string; element?: Element; count?: number; hooks?: ShotHooks }
/** Calls every suit engraving defined on the bus that answers this trigger, in suit order. */
export function emit(s: GridState, trigger: Trigger, ctx: TriggerCtx): void
```
```ts
// engraveDefs.ts
export type Family = 'melee' | 'ranged' | 'fusion' | 'element';
export interface EngraveDef { on: Trigger; when?: (s: GridState, c: TriggerCtx) => boolean; effect: EffectId; p?: number }
/** Bus-driven engravings by id (hand-written ones are absent from this map). */
export const DEFS: Partial<Record<EngraveId, EngraveDef>>;
```
```ts
// kataEffects.ts
export type EffectId = 'shootNearest' | 'shootFoe' | 'dashSlash' | 'spinShot' | 'slashFoe' | 'execute'
  | 'charge' | 'heal' | 'shield' | 'nextMult' | 'freeNext' | 'push' | 'stun' | 'elementBurst' | 'refund';
/** Runs an effect; returns false (and changes nothing) when it cannot happen (no gun, no charge, no target). */
export function runEffect(s: GridState, id: EffectId, c: TriggerCtx, p?: number): boolean
```
- `emit` loops `s.hero.suit`, looks up `DEFS[id]`, checks `fitsHand` (via `has`), the `when` condition, then `fire(s, t, id)` **only if** `runEffect` would succeed: call a cheap `canRun(s, id, c, p)` first, then `fire`, then `runEffect`.
- `shield`: new `Hero.shield?: number` absorbed before HP in `hurt`/`strike` when the hero is hit (show as event `shield` with amount). `freeNext`: sets `fx.free = true` (Part-A field from the previous plan). `nextMult`: `fx.nextMult = max(fx.nextMult, p)`.
- Move the existing gun-kata rules onto the bus without changing behaviour (their current tests in `tests/sim/grid/kata*.test.ts` must still pass unchanged): `gunRelay` (on `meleeKill`, effect `shootNearest`), `bladeRelay` (on `gunKill`, `dashSlash`), `spinShot` (on `surrounded`, `spinShot`), `counterShot` (on `dodge`, `shootFoe`), `execute` (on `stunned`, `execute`), `flow` (on `chain`, `freeNext`). Keep `kata.ts` helpers (`withOtherHand`, `otherHand`) and use them from effects.
- Emit points (one line each): `meleeAttack` → `meleeHit` (landed) and `meleeKill` (per kill, count = kills); `rangedAttack` → `gunHit`/`gunKill`; `defend` → `dodge`/`parry`; hero takes damage → `hurt`; any hero-caused stun (slam, riposte, engraving stun) → `stunned` with the foe; `addStatus` from a hero source → `elementApplied`; `react` from a hero source → `reaction`; start of `meleeAttack` with ≥ 2 adjacent → `surrounded`; `GridSim.act` after a hero `move` → `afterMove`, after `swap` → `afterSwap`, after `wait` → `afterWait`, and the existing chain point (≥ 3 fired) → `chain`.
- Tests: emit with an empty suit does nothing; a def whose effect cannot run does not `fire` (no `engrave` event); ping-pong (two engravings that each cause the other's trigger) fires each once per action; shield absorbs before HP and emits `shield`.

### Task A2: Families, tags, costs on every engraving; all unlockable

**Files:** Modify `src/sim/grid/engraveCore.ts` (`ENGRAVES` entries get `family: Family`, `tags: string[]`; `base` becomes `true` for every entry; `cost` per the table); `src/sim/grid/absorb.ts`; tests `tests/sim/grid/engraveCatalog.test.ts`.

Existing entries — family and cost (tags in brackets):
- 근접 `melee`: dash 50 [돌진], finisher 40 [연타], leap 60 [돌진], counter 60 [회피], riposte 70 [패링, 기절], wallslam 50 [밀치기, 기절], laststand 50 [위기]
- 원거리 `ranged`: rapid 50 [연사], mark 60 [표식], ricochet 60 [처치], kite 40 [회피], volley 70 [연사]
- 퓨전 `fusion`: gunRelay 60 [처치], bladeRelay 60 [처치, 돌진], spinShot 90 [포위], counterShot 70 [회피], execute 90 [기절, 처치], flow 120 [연쇄], shoveShot 50 [밀치기], quickswap 60 [교체], swapstrike 50 [교체], momentum 80 [처치]
- 원소 `element`: alternate, echo, chain, elemArrow — converted in Part B (keep them `element` with cost 60 each for now)
- Fit rules unchanged (`kata` etc.). `BASE_IDS` is now every id.
- Echo family by elite kind (`absorbOffer`): minion/brute → `melee`; archer → `ranged`; mage → `element`; ghoul and champion → `fusion`. The offer's pool is the family's ids not on the suit; one locked id first when any (taste), the rest from the pool.
- Tests: every entry has a family, ≥ 1 tag, cost > 0; `BASE_IDS.length === ENGRAVE_IDS.length`; an archer elite's offer is all `ranged`.

### Task A3: Family resonance

**Files:** Create `src/sim/grid/resonance.ts`; hook in `heroDmg` (melee), `rangedAttack` cost, the chain threshold in `GridSim.act`, and status duration in `addStatus`; tests `tests/sim/grid/resonance.test.ts`.
- `resonance(s): Record<Family, boolean>` = 3 or more engravings of that family on the suit.
- Bonuses: 근접 → melee damage +1 (both ends of the range); 원거리 → pistol charge cost −1 (minimum 1, so it matters once costs rise above 1 — keep the hook even if today's cost is 1); 퓨전 → the chain threshold becomes 2; 원소 → element statuses applied by the hero last +1 turn.
- HUD: none in this task (Part C adds it).
- Tests: each bonus on with 3, off with 2; removing an engraving turns it off.

---

# Part B — pistol only, element rounds, no staffs (one run)

### Task B1: Remove shotgun, rifle, staff

**Files:** `src/sim/grid/items.ts` (`WeaponGroup` drops `shotgun`, `rifle`, `staff`; `GUNS = ['pistol']`; remove `RIFLE_BURST`, `BURST_GAP`, `shotgunFalloff`, `STAFF_*`), `weapons.ts` (rifle burst, shotgun spread, staff cast, `rechargeStaffs`), `shotCombos.ts` (`castSpell` and spell paths), `gridSim.ts`, `meta.ts` (`armoryShotgun`/`armoryRifle`, `unlockedGuns`), loot tables (`rollEquipment` / `LOCAL`), `runSetup.ts` (`RunOptions.gun` removed or fixed to pistol), `save.ts` + `gridMeta.ts` (migration), UI (`weaponInfo.ts` notes, `panelContents.ts` armory, icons), view (`weaponKit.ts` models for shotgun/rifle may stay unused; remove staff look). Update every test that used these (search `shotgun|rifle|staff` in `tests/`).
- Migration: a saved run's shotgun/rifle in hand or bag becomes a pistol; staffs are removed; old meta's gun unlock flags are ignored.
- Tests: `rollEquipment` never yields removed groups over many seeds; an old save with `{group:'rifle'}` in hand loads as a pistol; an old save with a staff in the bag loads without it.

### Task B2: Element rounds

**Files:** `src/sim/grid/items.ts` (or new `rounds.ts`), `meta.ts`, `runSetup.ts`, `weapons.ts` (`rangedAttack`), `panelContents.ts` (armory), `shipDeck.ts` (remembered loadout); tests `tests/sim/grid/rounds.test.ts`, `tests/unit/shipPanels.test.ts`.
- `type Round = Element | 'plain'`. Meta: `rounds: Element[]` unlocked (fresh `[]`), shop entries `round:fire` 80, `round:frost` 80, `round:shock` 100, `round:poison` 80 (names `화염탄 해금` etc.).
- `RunOptions.round: Round` (default `'plain'`, must be unlocked); hero gets `rounds: Element[]` (0, 1 or 2 elements) and `roundIdx` for which is loaded.
- A pistol hit with an element loaded applies it to the struck foe: `addStatus(s, t, foe, el, hero.id)` for fire/frost/poison; for shock, `applyElement(s, t, 'shock', foe.pos, 0, [1, 2], hero.id)` (jumps per existing reaction code). Reactions happen through the existing code.
- With two elements, the loaded one alternates after every shot (shows in the HUD weapon line as `권총 · 화염`).
- A second element in a run: a new engraving-offer card kind `round` at level-up/echo — when the offer is built and the hero has fewer than 2 elements, one of the three cards may be `원소탄: <element>` (drawn from all four, not only unlocked ones). Choosing it adds that element.
- Armory panel: choices `기본탄` + unlocked rounds; shop lists locked rounds.
- Tests: fire round sets `burn` on the hit foe; shock round damages a neighbour of a wet/poisoned foe per the existing reaction; two elements alternate; a locked round in options falls back to plain.

### Task B3: The four element engravings, converted

**Files:** `engraveCore.ts` notes, `shotCombos.ts` (alternate/echo/elemArrow logic), `reactions.ts`/`status.ts` (chain), tests updated.
- `alternate` 교대 탄: `두 원소 번갈아 → 피해 ×1.5` (needs two elements; a shot whose element differs from the last shot's).
- `echo` 잔향 탄: `3발째 → 원소 한 번 더` (applies the loaded element again to the target).
- `chain` 연쇄 반응: `원소 반응 → 옆 칸으로 번짐` (a hero-caused reaction repeats once on one adjacent foe).
- `elemArrow` 원소 칼날: `칼 타격 → 장전 원소 부여` (melee hits apply the loaded element).
- All four fit `any`; family `element`.

---

# Part C1 — new melee, ranged and fusion engravings on the bus (one run)

Add these ids to `EngraveId`, `ENGRAVES` (name, note, fits, family, tags, cost) and `DEFS` (trigger, condition, effect, p). Notes use the `조건 → 효과` form shown. Each gets one test in `tests/sim/grid/engraveSet*.test.ts` (split files to stay ≤ 300 lines) proving the trigger, the effect, and one "does not fire" case.

근접 (fits melee unless noted):
| id | name | note | on | when | effect (p) | cost | tags |
|---|---|---|---|---|---|---|---|
| bloodlust | 피의 갈증 | 칼 처치 → 체력 +2 | meleeKill | — | heal 2 | 50 | 처치, 회복 |
| fury | 광폭 | 칼 처치 → 다음 공격 ×1.5 | meleeKill | — | nextMult 1.5 | 60 | 처치 |
| shoulder | 어깨치기 | 이동 직후 근접 → 밀치기 | meleeHit | last action was a move | push | 50 | 밀치기 |
| ironwall | 철벽 | 패링 → 보호막 3 | parry | — | shield 3 | 60 | 패링, 방어 |
| cull | 처단 | 체력 30% 이하 적 근접 → 처치 | meleeHit | foe hp ≤ 30% and not champion | execute | 90 | 처치 |
| tempest | 칼날 폭풍 | 포위 → 붙은 적 전부 베기 | surrounded | — | slashFoe each adjacent (melee weapon dmg) | 90 | 포위 |
| gale | 질풍 | 칼 처치 → 다음 행동 0턴 | meleeKill | ≥ 2 kills in the action | freeNext | 100 | 처치 |
| rebound | 반동 | 벽에 박음 → 충전 +2 | stunned | stun came from a slam | charge 2 | 50 | 기절 |

원거리 (fits ranged):
| id | name | note | on | when | effect | cost | tags |
|---|---|---|---|---|---|---|---|
| quickdraw | 속사 | 사격 처치 → 충전 +1 | gunKill | — | charge 1 | 50 | 처치 |
| pierce | 관통탄 | 사격 → 뒤의 적 하나 더 | gunHit | a foe stands right behind the target in line | shootFoe (that foe, no charge) | 70 | 관통 |
| sniper | 저격 | 4칸 이상 사격 → ×1.5 | gunHit | distance ≥ 4 (apply as damage before the hit: use a `when` that sets fx.nextMult before the shot — implement via a `preShot` trigger emitted at the start of `rangedAttack`) | nextMult 1.5 | 60 | 거리 |
| headshot | 헤드샷 | 무상처 적 첫 사격 → 치명 | preShot | foe at full hp | nextMult 2 | 80 | 치명 |
| covering | 엄호 사격 | 회피 → 다음 사격 0턴 | dodge | — | freeNext | 70 | 회피 |
| suppress | 견제 | 사격 명중 → 적 행동 지연 | gunHit | foe alive | delay: foe.nextAt += 0.5 (new effect id `delay`) | 60 | 지연 |
| barrage | 탄막 | 연쇄 → 보이는 적마다 한 발 | chain | — | shootFoe each visible foe in range, 1 charge each | 120 | 연쇄 |
| thrift | 절약 | 사격 처치 → 충전 환급 | gunKill | — | refund (the shot's cost) | 60 | 처치 |
| steady | 조준 | 대기 후 사격 → 치명 | preShot | last action was a wait | nextMult 2 | 50 | 치명 |

퓨전 (fits kata):
| id | name | note | on | when | effect | cost | tags |
|---|---|---|---|---|---|---|---|
| bayonet | 총검 | 칼 타격 → 같은 적에게 한 발 | meleeHit | foe alive | shootFoe (charge 1) | 70 | 연계 |
| reverseCut | 역수 베기 | 붙은 적 사격 → 칼로 한 번 | gunHit | foe adjacent and alive | slashFoe (off-hand blade) | 70 | 연계 |
| reclaim | 칼날 회수 | 칼 처치 → 충전 +1 | meleeKill | — | charge 1 | 40 | 처치 |
| muzzleShove | 총구 밀치기 | 총 타격 → 밀치기 | meleeHit | the blow was a gun bash | push | 40 | 밀치기 |
| executionRush | 처형 연계 | 처형 → 충전 +2 | stunned | the stun led to an execute this action (check `s.fired.has('execute')` after the stun) | charge 2 | 60 | 기절, 처치 |
| trance | 무아지경 | 칼·총 둘 다 처치 → 체력 +3 | chain | this action had both a melee kill and a gun kill | heal 3 | 80 | 연쇄, 회복 |

Also in C1:
- New effect ids `delay`, and trigger `preShot` (emitted at the start of `rangedAttack` before the hit roll, with `foe`).
- Suit lab panel lists engravings grouped by family (header per family, `${name} ⚡${cost}`), resonance shown in the HUD suit strip as a family mark lit at 3 (terse: `근접 3`).

# Part C2 — element-family engravings (one run)

Fits `any`, family `element`, tags include the element name. Each needs the loaded or inflicted element as stated.
| id | name | note | on | when | effect | cost |
|---|---|---|---|---|---|---|
| fireSpread | 화염 확산 | 불붙은 적 처치 → 주변 화상 | meleeKill / gunKill | killed foe was burning | elementBurst fire r1 | 70 |
| fireBlade | 불길 베기 | 불붙은 적 근접 → ×1.5 | meleeHit (pre-hit: emit `preMelee`) | foe burning | nextMult 1.5 | 60 |
| fireStoke | 소각 | 화상 피해 +1 | (passive: `status.ts` burn tick adds 1 when on suit) | — | — | 50 |
| fireEmber | 불씨 | 불붙은 적 사격 처치 → 충전 +1 | gunKill | foe was burning | charge 1 | 50 |
| frostShatter | 빙결 파쇄 | 얼어붙은 적 근접 → ×2, 해빙 | preMelee | foe frozen | nextMult 2 (and clear freeze after the hit) | 90 |
| frostVeil | 서리 장막 | 빙결 부여 → 보호막 2 | elementApplied | element frost | shield 2 | 60 |
| frostBite | 동상 | 얼어붙은 적 사격 → ×1.3 | preShot | foe frozen | nextMult 1.3 | 50 |
| frostSnap | 한파 | 연쇄 → 붙은 적 빙결 | chain | — | elementBurst frost r1 (adjacent only) | 90 |
| shockArc | 전격 연쇄 | 전격 → 한 번 더 튐 | elementApplied | element shock | elementBurst shock on one more foe | 70 |
| shockCharge | 과충전 | 전격 부여 → 충전 +1 | elementApplied | element shock | charge 1 | 60 |
| shockCut | 감전 베기 | 근접 → 전격 부여 | meleeHit | the hero has shock rounds | elementBurst shock r0 on the foe | 60 |
| shockDischarge | 방전 | 회피 → 주변 전격 | dodge | — | elementBurst shock r1 | 80 |
| poisonBurst | 독 폭발 | 중독된 적 처치 → 독구름 | meleeKill / gunKill | foe was poisoned | elementBurst poison r1 | 70 |
| poisonVenom | 맹독 | 칼 타격 → 독 2배 | meleeHit | foe poisoned | add the foe's poison again | 60 |
| poisonParalyze | 마비독 | 중독된 적 기절 → 기절 +1 | stunned | foe poisoned (champion capped at 1) | stun +1 | 70 |
| poisonSiphon | 해독 흡수 | 독 피해 → 체력 +1 | (passive: poison tick on a foe heals the hero 1, at most once per turn) | — | — | 60 |

- `elementBurst` (p = radius; element given by the def) uses `applyElement`.
- `preMelee` trigger: emitted in `meleeAttack` before the hit roll.
- Passive entries (`fireStoke`, `poisonSiphon`) are checked in `status.ts` ticks with `has(s, id)` and `fire()` for the pop.
- Tests per entry as in C1; plus a champion is never frozen or stunned more than 1 turn by these.

## Verify (each Part)
`npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run`. Report changed files and every decision made.
