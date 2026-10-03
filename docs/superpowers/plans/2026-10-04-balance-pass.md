# Balance Pass — Harder Runs, a Guaranteed Melee Weapon, and a Balance Bot

> **For agentic workers:** implemented by Codex in a separate worktree. Test-first for rule changes. Do not commit or push.

**Why (user, 2026-10-04):** "난이도가 너무 쉬워. 권총만 쏘면서 다녀도 클리어가 돼. 자동충전 없애고 1층 중간~끝에서 근접무기를 하나 줍게 해. 밸런스봇 돌려야겠다."

**Context:** TypeScript turn-based grid roguelike. Sim `src/sim/grid/**` (deterministic), the run is created by `newRunState` / `GridSim.createRun` (`src/sim/grid/runSetup.ts`), floors by `generateMap` + `nextFloor` (`run.ts`), guns use suit charge (`suitCharge.ts`: melee hit +1, melee kill +2, and a self-charge every 3 turns), auto-explore helper `exploreTarget` (`explore.ts`), foe stats `FOES` (`types.ts`) and depth scaling `scaleFoe` (`foes.ts`, +12%/floor), elites (`absorb.ts` ELITE_MULT 1.6), regen (`regen.ts`, 1 HP / 6 safe turns), upgrades (`upgrades.ts`). An old balance bot for another mode lives in `tests/sim/support/sortieBot.ts` (pattern only).

## Constraints
- Sim deterministic; files ≤ 300 lines (`npm run lint`); Korean player text; other modes off limits; do not edit `tests/e2e/**`.
- Done = `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` pass (the balance run itself is opt-in, see Task 3).

### Task 1: No more self-charge
- Remove the suit's self-charge (`selfCharge` and its call in `gridSim.ts`, `Hero.chargeClock`). Charge comes only from melee hits (+1) and melee kills (+2) — and the start of a run (full). Update the tests that expected self-charge; keep a test that waiting does **not** refill charge.

### Task 2: A melee weapon guaranteed on the run's first floor
- When a run is created (`newRunState`, any start floor), place one **tier-1 melee weapon** (random among dagger/sword/axe/spear/mace from a seed-derived stream) as a floor item on that first floor, in a room whose distance from the start is between the **middle and the far end** of the floor (rank the rooms other than the start room and the stairs/boss room by walking distance from the start; pick from the farther half; deterministic per seed). Not on a trap, chest, barrel, foe or another item.
- Tests: present on the first floor for many seeds (start 1, 6 and 11), never in the start room, in the farther half by distance, deterministic, a melee group.

### Task 3: A balance bot and a balance report
- `tests/sim/support/gridBot.ts`: a deterministic policy that plays a whole run through `GridSim` (no UI): take pending upgrades/offers (first card; slot 0 when the suit is full); drink a healing potion below 40% HP; equip a melee weapon from the bag into an empty hand; with a foe adjacent use melee (swap to the melee weapon if held); with an awake foe in sight and in range and enough charge, shoot; walk onto items; otherwise explore (`exploreTarget`, step along `findPath`), and when the floor is explored walk to the stairs and descend; stop at victory, death, or a turn cap (e.g. 6000).
- A **pistol-only** variant that never picks up or uses melee weapons.
- `tests/sim/gridBalance.test.ts`: skipped unless `BALANCE=1`; runs both bots over ≥ 40 seeds and prints a table: win rate, death floor distribution (median, quartiles), deaths by zone, average turns, average level at death, how often charge was empty when a foe was in sight.
- A small always-on test that the bot finishes a run on a fixed seed without throwing (bounded turns) so it does not rot.

### Task 4: Tune to the targets
- Targets (with the decent bot): win rate **10–25 %**, median death floor **6–9**, some deaths in every zone. Pistol-only bot: **0 %** wins, median death floor **≤ 5**.
- Knobs you may change (prefer tables/constants, one place each): `FOES` hp/dmg/hit, `PER_FLOOR` scaling, `BOSS_POWER`, `ELITE_MULT` and elite count, gun damage/cost/time (`WEAPONS`, `GUN_COST`), melee refill amounts, regen rate, healing potion amount and chest supply odds, upgrade sizes, XP curve. Do not change systems or add new mechanics.
- In your final reply, give the **before/after table** for both bots and list every number you changed with old → new.

## Verify
`npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` pass; `BALANCE=1 npx vitest run tests/sim/gridBalance.test.ts` prints the report.
