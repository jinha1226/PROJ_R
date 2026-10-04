# Gun-Kata Engravings Implementation Plan

> **For agentic workers:** implemented by Codex in a git worktree, one Part per run. Tests first for every rule. Do not commit, push or stage. Do not edit `tests/e2e/**`.

**Goal:** Make "gun + blade" the run's identity through Path-of-Achra-style conditional engravings that chain across the two hands, with a pistol + agent knife start and engravings bought permanently at the ship.

**Architecture:** The time-based sim stays (HP and damage ranges unchanged). New engravings hook into the existing attack paths (`meleeAttack`, `rangedAttack`, `counterBlow`, `defend`, the push/slam stun) through small functions in a new `src/sim/grid/kata.ts`. Meta gains permanent unlocks; the suit lab sells them; elite echoes let a run try locked ones. The view swaps the hero's hands per event and slows the show on long chains.

**Tech Stack:** TypeScript, three.js view, vitest. Deterministic sim (`src/sim/grid/**`: no DOM, no `Math.random`, no `Date.now`; randomness only from `s.rng`).

**Spec:** this document (decided with the user, 2026-10-04/05; reference demo `?demo=kata`, files `src/ui/grid/kataScenes.ts`, `kataDemo.ts`).

## Global Constraints
- Files ≤ 300 lines (`npm run lint` checks). Split instead of growing a file past it.
- Player text is Korean and terse: names and short labels, no explanatory sentences.
- HP and damage ranges stay as they are (no hearts).
- Done = `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` all pass.
- Existing data-testids stay unchanged.

## Review Focus
1. A chain must never loop: each engraving fires at most once per hero action (`fire()` already guards with `s.fired`); relay shots/strikes from engravings must go through the same guard.
2. Engraving shots spend suit charge like normal shots; with too little charge the engraving simply does not fire (no negative charge).
3. Temporarily switching `gear.active` for an other-hand attack must always switch back, even when the attack kills the last foe or the hero dies.
4. Guardians (`champion`) are never executed outright.
5. Old saves/meta without the new fields load (defaults filled), and a saved run in progress still continues.

---

# Part A — sim rules (one Codex run)

### Task 1: Pistol + agent knife start; no guaranteed first-floor melee drop

**Files:** Modify `src/sim/grid/gear.ts` (`startGear`), `src/sim/grid/runSetup.ts`; delete `src/sim/grid/firstMelee.ts` and `tests/sim/grid/firstMelee.test.ts`; update tests that assumed an empty second hand (search `hands[1]` and `startGear` in `tests/`).

- `startGear(gun)` returns `hands: [gun weapon, knife]` where the knife is `{ ...makeWeapon('dagger', 1), name: '요원 칼' }`, `active: 0`.
- `newRunState` no longer calls `placeFirstMelee`.
- Tests (`tests/sim/grid/startKit.test.ts`): a new run (start floor 1, 6 and 11) has the chosen gun in hand 0 and a tier-1 dagger named `요원 칼` in hand 1; no floor item is placed by the old first-melee rule (count of melee weapons on floor 1 for seeds 1–20 equals what `scatterLoot` alone produces — assert `placeFirstMelee` is gone by checking the module no longer exists is not possible, so assert instead that `newRunState` floor items equal `scatterLoot`-only output for a fixed seed by comparing with a state built the same way without it).

### Task 2: Engraving catalogue — the "kata" fit, base/run-only, costs

**Files:** Modify `src/sim/grid/engraveCore.ts`; tests `tests/sim/grid/engraveCatalog.test.ts`.

- `EngraveId` gains: `'gunRelay' | 'bladeRelay' | 'spinShot' | 'counterShot' | 'execute' | 'flow'`.
- `Fit` gains `'kata'`: fits when one hand holds a melee weapon and the other a gun (either hand active). `fitsHand` handles it.
- Each `ENGRAVES` entry gains `base: boolean` (sold at the ship) and `cost: number` (energy; 0 for run-only). New entries (name — note — fit — base — cost):
  - `gunRelay`: `총 연계` — `칼로 처치하면 다른 손 총이 가장 가까운 적에게 한 발` — kata — true — 60
  - `bladeRelay`: `칼 연계` — `총으로 처치하면 2칸 앞 적에게 돌진 베기` — kata — true — 60
  - `spinShot`: `회전 사격` — `둘 이상 붙은 채 베면 나머지 붙은 적에게 한 발씩` — kata — true — 90
  - `counterShot`: `반격 사격` — `회피하면 공격한 적에게 한 발` — any — true — 70
  - `execute`: `처형` — `곁의 적이 기절하면 총구를 대고 처치` — any — true — 90
  - `flow`: `흐름` — `한 행동에 각인 3번 이상: 다음 행동 0턴` — any — true — 120
- Existing entries: `base: true` with costs for `shoveShot` 50, `dash` 50, `riposte` 70, `counter` 60, `momentum` 80, `quickswap` 60; every other existing entry `base: false, cost: 0` (run-only: found through level-up/echo offers).
- `riposte` note becomes `패링하면 바로 반격, 기절`.
- Export `BASE_IDS: EngraveId[]` (entries with `base`).
- Tests: `fitsHand` for `'kata'` is true with [pistol, dagger] whichever hand is active, false with [pistol, null], [dagger, sword], [pistol, rifle]; `BASE_IDS` contains the 12 ids above and every base entry has `cost > 0`; every run-only entry has `cost === 0`.

### Task 3: The six gun-kata rules

**Files:** Create `src/sim/grid/kata.ts`; modify `src/sim/grid/weapons.ts` (`meleeAttack`, `rangedAttack`, `pushFoe` slam), `src/sim/grid/combos.ts` (`counterBlow`, `lunge` leap branch), `src/sim/grid/defense.ts`, `src/sim/grid/gridSim.ts` (`act`), `src/sim/grid/types.ts` (event type, `HeroFx`); tests `tests/sim/grid/kata.test.ts` (use `tests/sim/grid/kit.ts`: `sim(OPEN, hero, foes)`, `sureHits(g)`, `makeWeapon`).

Shared helper in `kata.ts`:
```ts
/** Runs `fn` with the other hand active, then always restores the hand that was active. */
export function withOtherHand<T>(s: GridState, fn: () => T): T
/** The other hand's weapon (null when empty). */
export function otherHand(s: GridState): Weapon | null
```
Kills are detected the way `refillMelee` does: count `die` events with `src === hero.id` added after an `eventStart` index.

Rules (each guarded by `has(s, id)` and `fire(s, t, id)`; `fire` already limits each to once per hero action):
1. **gunRelay** — at the end of `meleeAttack` (after `refillMelee`), and after the leap's strikes in `lunge` and after `counterBlow`'s strike: if the blow killed ≥ 1 foe and `otherHand` is a gun with `s.hero.charge >= GUN_COST[group]`, pick the nearest foe in `shootable(s)` computed with the other hand active (ties: lowest id) and `rangedAttack` it inside `withOtherHand`. Hooks: `meleeAttack` already receives optional `hooks`; when hooks are missing, gunRelay does not fire.
2. **bladeRelay** — at the end of `rangedAttack` for guns: if the shot killed ≥ 1 foe and `otherHand` is melee (not spear): look in the 8 directions (`DIRS` order from `types.ts`) for a visible foe exactly two steps away with the middle cell free (`freeCell`, `canStep` both steps, not the stairs). Prefer `s.hero.target` if it qualifies. Step to the middle cell (event `move` with `text: 'dash'`), then `meleeAttack` toward it inside `withOtherHand`. Adds `0.3` to the returned time (same as the dash engraving's `DASH_TIME`).
3. **spinShot** — in `meleeAttack`, count adjacent swing-able foes (same rule as `canSwingAt` in combos.ts; export it) before the main blow. If ≥ 2 and a gun is in either hand: after the main blow, for each other adjacent foe still alive, while `charge >= 1`: point-blank shot — `shoot` event (`text: 'spin'`), `strike(s, t, h, foe, 1, heroDmg(s, gun))` (always hits), `charge -= 1`. Kills from these shots count for gunRelay/flow like any kill.
4. **counterShot** — in `defend`, right after a dodge: if a gun is in either hand, the attacker is alive, within that gun's `weaponRange` and `shotClear`, and charge ≥ cost: `rangedAttack` it (inside `withOtherHand` if the gun is the other hand). Needs `ShotHooks`: pass `{ noise: () => {}, cast: () => 1 }` (no noise from a reflex shot).
5. **riposte stuns** — in `counterBlow` for `'parry'`, when the blow lands: `f.stun = Math.max(f.stun ?? 0, 1)` and push a `stun` event (`src: hero`, `dst: f.id`, `to`).
6. **execute** — new `onStunned(s, t, foe)` in kata.ts, called wherever the hero's action stuns a foe (the slam in `pushFoe`, riposte above): if the foe is adjacent to the hero (Chebyshev 1), alive, a gun is in either hand and charge ≥ 1: `shoot` event (`text: 'execute'`), `charge -= 1`; a non-champion dies (`hp = 0`, `alive = false`, `hit` event with `crit: true` and `amount` = the hp it had, then `die` event); a champion takes `Math.ceil(maxHp * 0.25)` instead.
7. **flow** — in `GridSim.act`, after `heroAct`: let `n = s.fired.size` (engravings fired this action). If `n >= 3`, push `{ t: t0, type: 'chain', src: hero.id, amount: n }` (new `GEventType` `'chain'`, used by the view for slow motion). If also `has(s, 'flow')` and `fire(s, t0, 'flow')`: set `fx.free = true` (new `HeroFx` field, default false). At the start of the next `act`, like `momentum`: if `fx.free` was set and the action costs time, its cost becomes 0 and `free` clears; a free action (cost 0) keeps it.

Event weapon tag (used by the view in Part B): `GEvent` gains optional `group?: WeaponGroup`. `meleeAttack` puts the weapon used on its `bump` event (the gun's group for a bash; omit for bare hands); `rangedAttack`, spinShot and execute put the gun's group on their `shoot` event.

Tests (`kata.test.ts`, each sets `g.s.hero.suit = [ids]`, hands [pistol, dagger] unless stated, `sureHits`):
- gunRelay: dagger active, minion adjacent with 1 hp, second minion 3 cells away → after `meleeAttack` both are dead, one `engrave` event `gunRelay`, charge dropped by 1, `gear.active` is back to the dagger.
- gunRelay without charge (0) → second minion untouched, no `gunRelay` event.
- gunRelay with [dagger, sword] (no gun) → does not fire.
- bladeRelay: pistol active, minion at range dies to the shot, brute two cells east with the middle free → hero ends on the middle cell, brute took a melee hit, `engrave` `bladeRelay`, `gear.active` back to the pistol.
- bladeRelay with the middle cell blocked by a wall → no step, no `bladeRelay`.
- spinShot: dagger active, three minions adjacent (1 hp each), charge 5 → all three dead after one `meleeAttack`, charge 3, one `spinShot` event.
- spinShot with charge 1 and three adjacent → exactly one extra shot.
- spinShot with a single adjacent foe → does not fire.
- counterShot: force a dodge (`s.rng.chance = () => true` with `parryOf` 0 → dodge path), archer attacker 4 cells away in a clear line → archer takes a pistol hit, `counterShot` event.
- riposte: sword active, `riposte` on the suit, force a parry → attacker `stun >= 1` and a `stun` event.
- execute: `wallslam`-style slam (push a brute into a wall with a mace via `pushFoe`) next to the hero with `execute` on the suit → brute dead, charge −1; same setup with a `champion` → loses `ceil(maxHp*0.25)` and stays alive.
- flow: a melee kill that fires gunRelay → bladeRelay → (third) momentum or spinShot in one action yields a `chain` event with `amount >= 3`; with `flow` on the suit the next `wait` costs 0 time (`s.hero.nextAt` unchanged after it), the one after costs 1.
- No loop: with gunRelay and bladeRelay both on and foes placed so each relay kills, one action fires each engraving at most once (count `engrave` events per id ≤ 1).

### Task 4: Run-only offers keep working

**Files:** Modify `src/sim/grid/absorb.ts`, `src/sim/grid/upgrades.ts` or wherever level-up/scroll engraving offers are drawn (search `ENGRAVE_IDS`); tests in `tests/sim/grid/absorb.test.ts`.

- `absorbOffer`: pool = ids fitting the family (treat `'kata'` as fitting families `melee` and `ranged`), not on the suit. Offer three: if any **locked** base id is in the pool (the run's `s.run.unlocked` from meta, see Part B; when undefined treat every base id as unlocked), one of them comes first (a taste); the rest are drawn from the pool (`s.rng.shuffle`).
- Putting a locked base id on the suit during a run pushes it to `s.run.tasted` (new optional `RunState` field, `EngraveId[]`, no duplicates).
- Tests: with `s.run.unlocked = []`, an offer always contains at least one base id; choosing it adds it to `s.run.tasted`; with all unlocked, no `tasted` entry is ever added.

---

# Part B — meta, ship UI, view, balance (second Codex run)

### Task 5: Permanent unlocks in meta

**Files:** Modify `src/sim/grid/meta.ts`, `src/app/gridMeta.ts` (load/validate), `src/sim/grid/runSetup.ts`, `src/sim/grid/state.ts` if `RunState` defaults live there; tests `tests/sim/grid/metaUnlock.test.ts`, `tests/unit/gridMeta.test.ts`.

- `MetaState` gains `unlocked: EngraveId[]` (fresh: `['gunRelay', 'spinShot']`) and `tasted: EngraveId[]` (fresh: `[]`).
- `facilities.suitSlots` becomes `2 | 3 | 4` (fresh 2). Shop: `suitSlots3` 100, `suitSlots4` 250 (replacing `suitSlots2`/`suitSlots3`). Loading an old meta maps 1→2, 2→3, 3→4 and fills missing `unlocked`/`tasted` with the fresh values.
- Unlock offers: `engraveShop(m): { id: string; name: string; cost: number }[]` lists every base id not in `m.unlocked`, `id: 'engrave:<id>'`, `name: ENGRAVES[id].name`, `cost: m.tasted.includes(id) ? Math.ceil(cost / 2) : cost`. `buy(m, 'engrave:<id>')` spends the energy and adds to `unlocked` (removes from `tasted`).
- `newRunState`: `s.run.unlocked = [...meta.unlocked]`; start suit (start floor 1 only, as now) = `opts.startSuit` filtered to `meta.unlocked`, at most `suitSlots`; **when `opts.startSuit` is empty, use the first `suitSlots` of `meta.unlocked`**.
- `settleRun`: `m.tasted` gains `s.run.tasted` (not already unlocked); a recovered left suit (`s.run.recovered`) adds its base ids to `tasted` and gives `+10` energy per recovered engraving (instead of setting `startCandidates`).
- Keep `records`/`startCandidates` fields readable (old saves) but nothing new depends on `startCandidates`.
- Tests: fresh meta unlocked/tasted/slots; buying an engraving (enough / not enough energy; tasted halves the price and is cleared); old meta migration; empty startSuit auto-fills; settle adds tasted and recovered energy.

### Task 6: Ship panels

**Files:** Modify `src/ui/grid/ship/panelContents.ts`, `src/ui/grid/ship/shipDeck.ts` (buy handler routes `engrave:*` through `buy`), tests `tests/unit/shipPanels.test.ts`.

- Suit lab panel: lines `시작 각인 N칸 · 최대 충전 M`; shop = slot/charge items plus `engraveShop(m)` entries (label `${name} ⚡${cost}`; testid `ship-buy-engrave:<id>` stays the same pattern as other buys).
- Hatch panel: start-suit choices list `m.unlocked` (instead of `startCandidates`), label `${name} — ${note}`, selection limit `suitSlots`.
- Tests: suit lab lists locked base engravings with halved price when tasted; hatch choices are the unlocked ones.

### Task 7: View — hands follow the event, chains slow down

**Files:** Modify `src/view/grid/gridActors.ts`, `src/view/grid/gridRuntime.ts`, `src/view/grid/gridFx.ts`, `src/view/grid/comboCues.ts`; demo `src/ui/grid/kataScenes.ts` (add `group` to its `bump`/`shoot` events) and `src/ui/grid/kataDemo.ts` (drop the `autoHands` line).

- `GridActors`: remove `autoHands`. `lunge(id, at, anim?, group?)` and `shoot(id, at, group?)`: for the hero, if `group` is given and equals the off-hand look while the main hand differs, swap (main ↔ off) before playing. `gridRuntime` passes `e.group` from `bump`/`shoot` events.
- `GridFx.slow(sec, scale)` and a `timeScale` getter (1 when idle); `gridRuntime.update` multiplies the playback/actor/particle `dt` by it. A `chain` event calls `fx.slow(1.4, 0.35)` and shows the combo counter (`pops.hits(amount, true)`).
- Shots with `text: 'spin'` snap the hero's facing (already supported); `text: 'execute'` adds a camera punch.
- Keep `gridRuntime.ts` ≤ 300 lines (move helpers out if needed).
- Tests: a pure helper `handSwap(main, off, group): [main, off] | null` in a new small file with unit tests (gun event with knife main → swapped; melee event with gun main and knife off → swapped; gun bash event (group pistol) with pistol main → null).

### Task 8: Balance check

- Run `BALANCE=1 npx vitest run tests/sim/gridBalance.test.ts`. The bots now start with the knife; the "pistol-only" bot must keep never attacking with melee weapons (bashes with the gun are allowed). Targets: decent bot win 10–25 %, median death floor 6–10; pistol-only 0 % wins. Tune only numbers (FOES table, `PER_FLOOR`, engraving costs do not matter for bots). Report before/after tables and every number changed.

## Verify (each Part)
`npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run`.
