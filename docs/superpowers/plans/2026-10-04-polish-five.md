# Polish Five — Explore, HP Bars, Regen, Trap/Loot Curve, Death Recap

> **For agentic workers:** five small tasks, do them **in order**, test-first for every sim rule and pure helper. Implemented by Codex in a separate worktree; reviewed with screenshots afterwards. Do not commit or push.

**Goal:** Make the new 15-floor run comfortable and fair: walk the floor without endless taps, read foe health at a glance, recover between fights, keep deep floors from drowning in traps, and see what killed you.

**Context:** TypeScript + three.js turn-based grid roguelike. Sim `src/sim/grid/**` (deterministic), view `src/view/grid/**`, UI `src/ui/grid/**`, app flow `src/app/gridFlow.ts`. Hand-map test kit: `tests/sim/grid/kit.ts` (`sim(rows, hero, foes, seed)`, `OPEN`, `handMap`, `sureHits`). The landscape HUD has an action cluster bottom-right (`src/ui/grid/gridTouch.ts`) shown on touch and non-touch.

## Constraints (every task)
- Sim stays deterministic: no DOM/three/`Math.random`/`Date.now` in `src/sim`; randomness only from `s.rng` or seed-derived `createRng` streams. `src/sim` never imports view/ui/app.
- Files ≤ 300 lines (`npm run lint`). Korean player text. Keep all existing `data-testid`s.
- Do not edit `tests/e2e/**`. Other game modes (`src/data/**`, `src/sim/roster/**`, `src/sim/extract/**`) are off limits.
- Done = `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` pass.

---

### Task 1: Auto-explore and travel to the stairs
- New pure sim helper `src/sim/grid/explore.ts`:
  ```ts
  export function exploreTarget(s: GridState): Cell | null;
  ```
  The nearest (by walking steps, BFS over 8 directions with `canStep`) **seen, walkable** cell that has at least one **unseen** neighbour, reachable without crossing `walkBlocked` cells (shut chests, barrels, living foes, found traps — reuse `walkBlocked` from `actions.ts`). `null` when the floor is fully explored or nothing is reachable. Deterministic tie-break (first found in BFS order of `DIRS`).
- UI (`gridScreen.ts`, `gridTouch.ts`, `gridControls.ts`):
  - **탐색** button in the action cluster (`data-testid="grid-explore"`, key `O`): starts auto-walking — repeatedly `walkTo(exploreTarget(s))` each time the previous walk finishes — until something interrupts (the existing interruption rules: a new foe in sight, damage taken), the floor is explored (log `더 갈 곳이 없다`), or the player gives any other input.
  - **계단** button (`data-testid="grid-stairs"`, key `G`), shown only when `s.map.stairs` exists and has been seen: walks there (it stops before stepping on — the player steps down themselves; do not auto-descend).
- Tests (`tests/sim/grid/explore.test.ts`): on a hand map with a seen room and an unseen corridor, `exploreTarget` returns the corridor mouth; it never targets across a found trap or a barrel; `null` when everything is seen; deterministic for the same state.

### Task 2: Health bars over foes
- View (`src/view/grid/gridActors.ts` or a small new `src/view/grid/hpBars.ts`): a thin bar above a foe's head (red fill on a dark back, gold frame for elites) shown when the foe is visible and **damaged** (`hp < maxHp`) or **elite**; hidden for dead foes. Updated when the runtime refreshes (after each action). Sprites or a small plane that always faces the camera; cheap (shared geometry/materials).
- A pure helper `barState(e): { show: boolean; frac: number; elite: boolean }` with unit tests (`tests/unit/gridHpBars.test.ts`).

### Task 3: Recovery between fights
- Sim (`src/sim/grid/regen.ts`, wired where `selfCharge` is called in `gridSim.ts`): the hero regains **1 HP per 6 turns of game time** while **no awake living foe is within 8 cells and in sight** (`s.visible`) and the hero is **not burning or poisoned**; banked time resets while those conditions fail; never above `maxHp`. Keep a `Hero.regenClock?: number` like `chargeClock`.
- Tests (`tests/sim/grid/regen.test.ts`): +1 after 6 waits alone; nothing while an awake foe is visible; nothing while poisoned; capped at max; zero-cost actions add nothing.

### Task 4: Trap and loot curve for 15 floors
- `placeTraps` (`src/sim/grid/traps.ts`): count = `min(9, 3 + Math.ceil(floor / 2))` (was `3 + floor`).
- `scatterLoot` (`src/sim/grid/consumables.ts`): count = `2 + Math.floor((floor - 1) / 5)` (2 on floors 1–5, 3 on 6–10, 4 on 11–15).
- Update the tests that assert the old counts; add a test for both curves at floors 1, 5, 6, 10, 11, 15.

### Task 5: Death recap
- Sim: record what killed the hero. When the hero dies, set `s.run.killedBy` to a short id: the killing foe's kind (`'minion' | … | 'champion'`, and `elite: true` if it was an elite), or `'trap'`, `'burn'`, `'poison'`, `'blast'` (explosions), `'self'` for anything else. Find it from the `die` event whose `dst` is the hero (its `src` is the foe id, `'trap'`, `'burn'`, `'poison'`, or the hero for own blasts). Type: `RunState.killedBy?: { kind: string; elite?: boolean }`.
- UI (`src/ui/grid/gridResult.ts`, `src/app/gridFlow.ts`): the result screen adds — on death — `쓰러뜨린 것: 정예 해골 전사` (Korean names for kinds; `함정`, `화상`, `중독`, `폭발`), the zone reached (`7층 · 지하 묘지`), and the suit's engravings at the end as small chips (names from `ENGRAVES`). Keep existing testids (`grid-result`, `grid-again`, …).
- Tests: a hero killed by a minion's blow records `{ kind: 'minion' }`; by an elite brute `{ kind: 'brute', elite: true }`; by burning `{ kind: 'burn' }`; a pure helper that turns `killedBy` into the Korean line is unit-tested.

## Verify
After all five: `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run`.
