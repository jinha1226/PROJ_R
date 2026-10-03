# Meta Loop — In-Run Changes (15 Floors · Guns · Suit Engravings · Absorption) Implementation Plan

> **For agentic workers:** implement one task at a time, test-first. Each task is handed to an implementer (Codex) and reviewed afterwards; do not start the next task unasked. Do not commit or push — leave changes in the working tree.

**Goal:** The in-run half of the meta loop design: a 15-floor dungeon in three zones with bosses, ship guns that use suit charge, engravings on the suit, elites whose echoes are absorbed, suit upgrades on level-up. (The ship screen, energy, facilities, saves and the death suit are the next plan.)

**Spec:** `docs/superpowers/specs/2026-10-03-meta-loop-core-design.md` (§1 floors, §2 weapons, §3 suit engravings, §4 absorption, §6 level-up). Overview: `docs/superpowers/specs/2026-10-03-meta-structure-design.md`.

## Global Constraints (every task)
- Project: TypeScript + three.js browser game. Sim code lives in `src/sim/grid/` and must stay **deterministic**: no DOM, no three.js, no `Math.random`, no `Date.now` in `src/sim`; randomness only from `s.rng` (or a seed-derived `createRng` stream where the plan says so). `src/sim` never imports from `src/view`, `src/ui` or `src/app`.
- **Every source file ≤ 300 lines** (`npm run lint` runs eslint and `scripts/check-file-length.mjs`). Split modules rather than exceed it.
- Player-facing text is **Korean**. Code comments in English, matching the surrounding style (short doc comments on exported functions).
- **Test-first**: write or update the failing test, run it and see it fail, then implement. Tests: vitest under `tests/sim/grid/*.test.ts` (hand maps via `tests/sim/grid/kit.ts`: `sim(rows, heroCell, foes, seed)`, `OPEN`, `handMap`, `sureHits`).
- Done means all of these pass: `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run`. (e2e is run by the reviewer.)
- Keep existing behaviour unless the task changes it; when an old test encodes behaviour the task deliberately changes, update that test and say so in your summary.
- Do not commit, push, or touch files outside the repo.

---

### Task 1: Fifteen floors in three zones

**Why:** The run becomes 15 floors: cave (1–5) → crypt (6–10) → ancient ruins (11–15). Floors 5 and 10 end with a zone boss; floor 15 holds the final guardian and the energy source. Today the run is 3 floors with the champion on floor 3 and the run is won when the champion dies.

**Files:**
- Create `src/sim/grid/zones.ts` (zone table + helpers).
- Modify `src/sim/grid/run.ts` (`FLOORS = 15`, longer `XP_STEPS`, boss-floor stairs, victory by picking up the energy source), `src/sim/grid/mapgen.ts` (boss floors 5/10/15 instead of `floor >= 3`), `src/sim/grid/foes.ts` (gentler per-floor scaling; champion power by zone; zone spawn tables), `src/sim/grid/types.ts` (a floor item for the energy source; event types), `src/sim/grid/weapons.ts` `pickUp` (energy source pickup), and the UI/view text that says "/ 3": `src/ui/grid/gridHud.ts`, `src/ui/grid/gridResult.ts`, `src/view/grid/gridRuntime.ts` (banner), plus `src/view/grid/gridElements.ts` (stairs that appear mid-floor, the energy source model) and `src/view/grid/gridItems.ts` if the source is drawn there.
- Tests: new `tests/sim/grid/zones.test.ts`; update `tests/sim/grid/run.test.ts` and any test that assumes the champion on floor 3 or victory on the champion's death (search: `champion`, `FLOORS`, `victory`, `floor: 3`).

**Interfaces — Produces:**
```ts
// zones.ts
export type ZoneId = 'cave' | 'crypt' | 'ruins';
export interface Zone { id: ZoneId; name: string; first: number; last: number }
export const ZONES: Zone[];             // cave 1–5 '동굴', crypt 6–10 '지하 묘지', ruins 11–15 '고대 유적'
export function zoneOf(floor: number): Zone;
export const isBossFloor = (floor: number): boolean;   // 5, 10, 15
export const BOSS_POWER: Record<5 | 10 | 15, number>;  // champion power: 1, 1.6, 2.3
```
- `run.ts`: `export const FLOORS = 15;` `XP_STEPS` extended to 14 steps: `[10, 25, 45, 70, 100, 140, 190, 250, 320, 400, 490, 590, 700, 820]`.
- Floor item for the energy source: extend `FloorItem.item` with `{ kind: 'core'; name: '에너지원' }` (add a `Core` type next to `Consumable` in `items.ts`).
- New event types: `'stairs'` (stairs appeared, `to` = cell) and `'core'` (energy source taken).

**Behaviour:**
1. **Map generation** (`generateMap(seed, floor)`):
   - Non-boss floors (1–4, 6–9, 11–14): as now — stairs at the centre of the deepest room.
   - Boss floors (5, 10, 15): **no stairs in the map**; a `champion` spawn at the centre of the deepest room (as floor 3 does today), and that room holds nothing else (no chest, barrels or other spawns — same rule as today).
   - Replace every `floor >= 3` / `floor < 3` with `isBossFloor(floor)`.
2. **Foe scaling** (`foes.ts`): `PER_FLOOR` 0.25 → **0.12**. The champion is no longer exempt: its power is `BOSS_POWER[floor]` on 5/10/15 (1, 1.6, 2.3) — health and damage scale like other foes. A champion spawned anywhere else (tests) keeps power 1.
3. **Spawn tables by zone** (`spawnKind(rng, floor)`), weights in order minion/brute/ghoul/archer/mage:
   - cave: 0.35 / 0.15 / 0.35 / 0.15 / 0 (no mages)
   - crypt: 0.45 / 0.20 / 0.15 / 0.12 / 0.08 (today's table; mages allowed from floor 6 on, i.e. always in the crypt)
   - ruins: 0.20 / 0.30 / 0.10 / 0.20 / 0.20
   Keep using `rng.next()` (one draw per pick where possible).
4. **Boss death** (where kills are settled — `settleKills` in `run.ts`):
   - On floors 5 and 10: when the champion dies, the stairs appear at the champion's cell: set `s.map.stairs = { ...pos }` and push `{ t, type: 'stairs', to }`. **No victory.**
   - On floor 15: when the champion dies, put the energy source on the floor at its cell: `s.floorItems.push({ pos, item: { kind: 'core', name: '에너지원' } })`. **No victory yet.**
   - Remove the old rule "champion dies ⇒ `s.outcome = 'won'`".
5. **Victory**: walking onto the energy source (`pickUp` in `weapons.ts` handles floor items) sets `s.outcome = 'won'`, `s.run.won = true`, removes the item and pushes `{ type: 'core' }` then `{ type: 'victory' }`. The existing end-of-action logic in `gridSim.ts` already stops the run when `s.outcome` is set — make sure a hero standing on the core is not also sent down stairs (there are none on 15) and that death in the same action does not overwrite the win (keep today's guard).
6. **Stairs appear in the view**: `GridElements` builds the stairs object only in its constructor today. Make `sync(s)` create it when `s.map.stairs` exists and none was built yet (reuse the constructor code via a small private method). Draw the energy source as a glowing cyan crystal (e.g. an `OctahedronGeometry` with emissive `#5ae0ff`, gently rotating) — in `GridItems` alongside other floor items.
7. **Text**:
   - HUD floor line (`gridHud.ts`): `${floor}층 / 15 · ${zone.name} · 처치 ${kills}` and on boss floors append ` · 구간 수호자가 기다린다` (floor 15: ` · 에너지원을 지키는 수호자`).
   - Result screen (`gridResult.ts`): `${floor}층 / 15`.
   - Floor banner (`gridRuntime.ts`): `${floor}층 · ${zone.name}`.
   - Log line for `'stairs'`: `계단이 열렸다` and for `'core'`: `에너지원을 손에 넣었다` (add to the HUD's event lines).
8. **Zone look (view only, light touch)**: in `gridRuntime.ts` (or a small new `src/view/grid/zoneLook.ts` to stay under 300 lines), per zone set the hemisphere light colour and torch count when a floor is built: cave — hemisphere `#7f9a8a`, intensity 0.7, torches ×0.5; crypt — today's values; ruins — hemisphere `#d8cfae`, intensity 0.95, torches as today. Keep it to lights and torch count; no new assets.

**Tests to write first (`tests/sim/grid/zones.test.ts`):**
- `zoneOf` returns cave for 1 and 5, crypt for 6 and 10, ruins for 11 and 15; `isBossFloor` is true exactly for 5, 10, 15.
- `generateMap(seed, f)` for f in 1..15 (a few seeds): boss floors have no `stairs` and exactly one `champion` spawn in the deepest room's centre; other floors have `stairs` and no champion.
- Spawn tables: over many `generateMap` seeds, cave floors never spawn a mage; ruins floors spawn mages.
- Scaling: a minion on floor 11 has `round(10 × (1 + 0.12 × 10))` = 22 hp; the floor-10 champion has 1.6× its base hp.
- Floor 5: killing the champion (put the hero next to it with `sureHits` and enough damage, or set its hp to 1) makes `s.map.stairs` equal the champion's cell, emits `stairs`, and `s.outcome` stays undefined.
- Floor 15: killing the champion leaves a `core` floor item and no outcome; stepping onto it sets `outcome = 'won'` and emits `core` and `victory`.
- Going down the stairs from floor 14 reaches floor 15 (use `nextFloor`), and `FLOORS === 15`.
- (Build the boss-floor states with `newState(generateMap(seed, 5), seed, 'warrior', 5)` from `src/sim/grid/state.ts`, or a hand map with a champion spawn and `s.run.floor = 5`.)

**Update existing tests** that expect the champion on floor 3, victory on the champion's death, or `/ 3` text; keep their intent where it still applies (e.g. "a champion felled in the same moment as the hero still counts" now applies to the core pickup).

**Verify:** `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` all pass.

---

### Task 2: Ship guns and suit charge (outline — detailed before hand-off)
- New weapon groups `pistol | shotgun | rifle` (spec §2 table); `Hero.charge`, `Hero.maxCharge` (10); shooting costs charge; melee hit +1, melee kill +2; shotgun cone 3 cells + push; rifle halves cover penalty.
- Remove bow, crossbow, throwing daggers, arrows (items, gear, weapons, chest loot, UI, belt/HUD) and the classes (`ClassId`, `CLASS_BONUS`, class select) — the run starts with a pistol in hand 1 and hand 2 empty; remove the weapon rack.
- Engravings that read ranged weapons now read guns; "원소 화살" becomes "원소 탄".

### Task 3: Engravings on the suit (outline)
- `Hero.suit: EngraveId[]` (6 slots) replaces `Weapon.engraves`; `has(s, id)` checks the suit and the fit of the weapon in hand (melee/ranged=gun/magic=staff/any).
- Full suit: the absorb/level choice asks which slot to replace (or pass). Remove rune stones, `inscribe`, engraving levels.

### Task 4: Elites, echoes and absorption (outline)
- 1–2 elites per non-boss floor (×1.6 hp/damage, flag `elite`), an echo left on death; stepping in (1 turn) offers 3 engravings of the foe's family: 2 recorded + 1 unrecorded; records live in `s.records` (seeded per run for now: one per family) — persisted by the next plan.

### Task 5: Level-up suit upgrades and screens (outline)
- Level-up 3-choice of suit upgrades (max charge +2, hp +5, kill charge +1, evasion +3%p, gun damage +1, melee damage +1); HUD charge bar; suit panel in the bag; absorb choice reuses the level-up panel.

### Task 6: E2E, README, review, push
