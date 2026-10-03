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

### Task 2: Ship guns and suit charge; bows, throwing daggers and classes removed

**Why:** The agent carries ship guns that draw on the suit's charge; local ranged weapons other than staffs go away, and so do classes (the starting gun replaces them; the ship screen that picks it comes in the next plan).

**Scope — only these areas:** `src/sim/grid/**`, `src/ui/grid/**`, `src/view/grid/**`, `src/app/gridFlow.ts`, `tests/sim/grid/**`, grid tests in `tests/unit/**` (`gridFeel`, `gridLook`, `gridPack`), `tests/e2e/grid.spec.ts`. **Other game modes also use names like `bow`, `crossbow`, `ClassId` (`src/data/**`, `src/sim/roster/**`, `src/sim/extract/**`, `src/ui/hud/**`, `src/ui/i18n/**`) — do not touch them.**

**Interfaces — Produces:**
```ts
// items.ts
export type WeaponGroup = 'dagger' | 'sword' | 'axe' | 'spear' | 'mace' | 'staff' | 'pistol' | 'shotgun' | 'rifle';
export type GunGroup = 'pistol' | 'shotgun' | 'rifle';
export const GUNS: GunGroup[];
export const GUN_COST: Record<GunGroup, number>;   // pistol 1, shotgun 2, rifle 2
export const isGun = (g: WeaponGroup): g is GunGroup;
// types.ts — Hero gains
charge: number;      // starts full
maxCharge: number;   // 10
// gear.ts
export function startGear(gun: GunGroup = 'pistol'): Gear;   // hand 1 = that gun, hand 2 = null, leather armour, 2 potions
// state.ts / gridSim.ts
newState(map, seed, gun: GunGroup = 'pistol', floor = 1)
GridSim.create(seed, gun: GunGroup = 'pistol')
```

**Behaviour:**
1. **Weapon table** (`WEAPONS` in `items.ts`): remove `bow`, `crossbow`, `throwing` (and `THROW_STACK`, `stack`). Add guns (both tier rows equal; guns are always tier 1):
   - pistol: melee false, dmg [4, 6], hit 0.85, time 0.8, range 7
   - shotgun: melee false, dmg [5, 8], hit 0.9, time 1.0, range 4
   - rifle: melee false, dmg [8, 12], hit 0.85, time 1.2, range 9
   Names: 권총 / 산탄총 / 소총. `makeWeapon('pistol', 1)` etc. work as for other groups.
2. **Drops**: guns never drop (no chest, no floor). `rollEquipment`: one in five is armour as now; weapons are picked from the 5 melee groups and `staff` with equal weight (so melee ≈ 5/6 of weapon finds) — update the old "half melee" test accordingly.
3. **Suit charge**: `Hero.charge`/`maxCharge` (10, full at the start of a run; `nextFloor` does not refill it).
   - `canFire` for a gun: `charge >= GUN_COST[group]`. Staffs keep their own charges.
   - Firing a gun (`rangedAttack`, and `shootCell` at a barrel) spends `GUN_COST`. Noise: pistol 4, shotgun 6, rifle 6.
   - Melee refills: a hero melee action whose main blow lands gives **+1** (once per action, not per sweep target); every foe killed by the hero's melee in that action gives **+2**. Counter/riposte blows count as melee. Never above `maxCharge`. Bashing with a gun in hand (no melee weapon) refills nothing.
4. **Shotgun**: hits the target cell and the two cells flanking it, perpendicular to the line from the hero (like the axe's sweep cells but around the target; diagonals: the two orthogonal neighbours of the target that are not farther from the hero). Each foe on those cells gets its own hit roll and damage; every foe hit and still alive is pushed one cell away from the hero (reuse `pushFoe` from `weapons.ts`, direction = sign of (foe − hero)). One charge cost for the whole blast.
5. **Rifle**: the cover penalty in its hit chance is halved (add an optional cover factor to `hitChance(m, from, to, base, coverMul = 1)` in `combat.ts`; rifle passes 0.5).
6. **Arrows removed**: delete `Gear.arrows` and every use — chest loot no longer gives arrows, HUD/touch/belt/weapon info stop showing them. `weaponState` shows `충전 ${charge}/${maxCharge}` for guns (it now needs the hero's charge — change its signature as needed), `충전 n` for staffs, '' for melee.
7. **Classes removed**: delete `ClassId`, `CLASS_BONUS`, `CLASS_NAME` and every use in grid code; use the neutral values (melee damage ×1, ranged hit +0, ranged time ×1, staff charges +0, recharge ×1, status turns +0). Hero max HP = `HERO.hp` raised to **35**. The HUD badge that showed the class shows `요원`.
   - `startGear(gun)`: hand 1 = that gun with the starting engraving `rapid` on it (engravings move to the suit in Task 3), hand 2 = null, armour = leather (`armorOf(1)`), belt = 2 potions.
   - Delete the weapon rack (`weaponRack`, `RACK_ENGRAVES`) and its call in `GridSim.create`; scattered loot stays.
   - `src/app/gridFlow.ts`: no class select — `격자 출격` launches a run with the pistol directly (temporary until the ship screen). Delete `src/ui/grid/classSelect.ts`. Keep the best/wins record.
8. **Engravings that read ranged weapons now read guns**: no rule change is needed beyond the groups — `rapid`, `mark`, `ricochet`, `kite`, `volley`, `shoveShot` (fires the gun in the other hand if it can) work with guns. Rename `elemArrow`'s display text: name `원소 탄`, note `마지막 원소가 다음 총탄에 실림` (keep the id `elemArrow`).
9. **View**: add block meshes for `pistol`, `shotgun`, `rifle` in `weaponMeshes.ts` (simple dark-metal boxes of increasing length, held in the right hand) and map them in the actor code: idle `Pistol_Idle_Loop` for guns, shoot animation `shoot` (Pistol_Shoot). **Keep the `crossbow`/`bow` looks** — skeleton archers still carry a crossbow model. Weapon icons for the three guns in `src/ui/grid/icons.ts` (simple SVG silhouettes, or reuse an existing icon if one fits); `GROUP_NOTE` lines: 권총 `빠름(0.8턴) · 충전 1`, 산탄총 `가까운 부채꼴 3칸 · 밀치기 · 충전 2`, 소총 `멀리 · 엄폐 무시 절반 · 충전 2`.
10. **HUD**: the resource row shows charge (e.g. a lightning icon `charge`/`maxCharge`) instead of arrows. The fire button's sub-label uses the new `weaponState`.

**Tests to write first** (new `tests/sim/grid/guns.test.ts`):
- A run starts with a pistol in hand 1, hand 2 empty, charge 10/10, 35 hp, leather armour; `GridSim.create(seed)` lays no weapon rack (no weapon floor items at the start).
- Pistol shot spends 1 charge and takes 0.8 time; with 0 charge `shoot` is refused (`blocked`, no time).
- Shotgun: foes on the target and both flanking cells are all hit and pushed one cell away; costs 2.
- Rifle: against a foe in cover, its hit chance is higher than the pistol's with the same base (cover halved).
- Melee refills: a landed sword blow +1; a killing blow +1 +2; an axe sweep hitting three foes still +1 (+2 per kill); never above max; a missed blow gives nothing.
- `rollEquipment` never returns a gun, a bow, a crossbow or throwing; staffs appear.
- Chests no longer give arrows.

**Update existing tests**: many grid tests use `bow`, `crossbow`, `throwing`, `arrows`, classes (`'warrior' | 'hunter' | 'mage'`), the weapon rack, or `CLASS_BONUS`. Convert them to the new rules keeping their intent: bow/crossbow → pistol/rifle (and arrows → charge), class-specific expectations → the neutral values, rack tests → deleted (the rack is gone). The engraving tests in `engrave.test.ts`/`review3.test.ts` that use `bow`/`crossbow` keep testing the same engraving with a gun. Update `tests/e2e/grid.spec.ts` for the removed class select (no `class-*` clicks) and the HUD text (it is run later by the reviewer — keep the changes minimal and obvious).

**Verify:** `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` all pass.

### Task 3: Engravings on the suit

**Why:** Engravings move from weapons to the agent's suit (6 slots). Each fires only when the weapon in hand fits it. Rune stones, inscribing and engraving levels go away. (Absorbing engravings from elites comes in Task 4; until then level-ups still offer engravings.)

**Scope:** `src/sim/grid/**`, `src/ui/grid/**`, `src/view/grid/**` (only if needed), `tests/sim/grid/**`, grid unit tests. **Do not edit `tests/e2e/**`** (the reviewer updates e2e at the end of the plan). Other game modes are off limits as before.

**Interfaces — Produces:**
```ts
// engraveCore.ts
export const SUIT_SLOTS = 6;
export type Fit = 'melee' | 'ranged' | 'magic' | 'any';      // ENGRAVES[id].fits keeps these values
export function fitsHand(s: GridState, id: EngraveId): boolean; // melee → melee weapon in hand; ranged → a gun in hand; magic → a staff in hand; any → always
export function has(s: GridState, id: EngraveId): boolean;      // id is on the suit AND fitsHand
// types.ts — Hero gains
suit: EngraveId[];   // at most SUIT_SLOTS, starts empty
// engrave.ts
export function putOnSuit(s: GridState, id: EngraveId, slot?: number): boolean;  // free slot → append; full → needs `slot` (0..5) to replace, else false; an id already on the suit → false
// GAction 'choose' gains an optional slot:
{ kind: 'choose'; i: number | null; slot?: number }
```

**Behaviour:**
1. Remove `Weapon.engraves`, the `Engraving` type's `lvl` (and the type itself if nothing needs it), `engravingOn`, rune stones (`RuneStone`, `runeStone`, `RUNE_CHANCE` and the chest roll), the `inscribe` action and event, `inscribe()`, `canInscribe`, `wouldErase`, `ENGRAVE_SLOTS`. `Equipment` becomes `Weapon | Armor`. Starting gear has no engravings; `Hero.suit` starts `[]`.
2. `has(s, id)` returns a boolean: on the suit and `fitsHand`. Fix every caller that compared it with `> 0` or used its number.
3. Engravings tied to swapping now read the suit:
   - `quickswap`: a swap is free (cost 0) and the next blow +50% **only when the swap changes the kind of weapon in hand** (melee ↔ gun ↔ staff, or to/from an empty hand). Same-kind swaps cost the normal half turn and give nothing.
   - `swapstrike`: after any swap, if the weapon now in hand can strike (melee foe adjacent / gun or staff with a target in range), it strikes at ×0.5 — and that swap always costs the normal half turn (keep the existing rule).
   - Both are `fits: 'any'`.
4. `shoveShot` (melee): unchanged — the other hand's gun fires if it can.
5. Level-up choice (`choose`): the picked engraving goes on the suit via `putOnSuit`. With a free slot, `slot` is ignored. With a full suit, `slot` is required (0..5) and replaces that engraving; without it the action is refused (`null` → `blocked`), and the offer stays. `i: null` still passes the offer up. Offers (`offerFor`) never include engravings already on the suit; weighting by the weapon in hand stays.
6. **UI**:
   - Level-up panel (`levelUp.ts`): with a full suit, picking a card switches the panel to "어느 칸을 바꿀까요?" showing the 6 suit engravings as buttons (`data-testid="grid-suit-slot-${n}"`) plus 취소; clicking one sends `{ kind: 'choose', i, slot: n }`. Remove the old "가장 오래된 … 지워집니다" warning.
   - Bag (`gridBag.ts`): remove the rune/inscribe UI and the weapon engraving chips; add a **슈트 각인** row listing the suit's engravings (name + note on hover; dim the ones that do not fit the weapon in hand, e.g. class `off`) — `data-testid="grid-suit"`.
   - HUD: nothing required.
7. Keep the engraving effects themselves unchanged (dash, finisher, leap, counter, riposte, momentum, wallslam, laststand, rapid, mark, ricochet, kite, volley, alternate, echo, chain, elemArrow/원소 탄).

**Tests to write first** (new `tests/sim/grid/suit.test.ts`):
- `has`: `dash` on the suit fires with a sword in hand and does not with a pistol in hand; `rapid` fires with a pistol, not with a sword; `momentum` (any) fires with either; `chain` (magic) only with a staff.
- `putOnSuit`: fills up to 6; a 7th without a slot is refused; with `slot: 2` replaces the third; a duplicate is refused.
- `choose` with a full suit and no slot → `blocked` and the offer is still there; with a slot → replaced, offer consumed, no time spent.
- `quickswap`: pistol ↔ sword swap costs 0 and the next blow ×1.5; sword ↔ axe swap costs 0.5 and gives nothing.
- Chests never give rune stones; there is no `inscribe` action.

**Update existing tests**: `engrave.test.ts` (its `arm()` helper should put the ids on `s.hero.suit` and set up the hands), `review3.test.ts`, `review4.test.ts`, `acquire.test.ts` (rune/inscribe tests deleted; level-up tests converted to the suit), and any others referring to `engraves`, `inscribe`, `runeStone`, `ENGRAVE_SLOTS`. Keep each engraving's behaviour test.

**Verify:** `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` all pass.

### Task 4: Elites, echoes and absorption

**Why:** New engravings come from hunting. Each non-boss floor has 1–2 glowing elites; killing one leaves an echo, and walking into it offers three engravings of that foe's family (two already recorded, one new). Records grow as engravings are first taken (they are kept per run for now; the next plan saves them between runs).

**Scope:** `src/sim/grid/**`, `src/ui/grid/**`, `src/view/grid/**`, `tests/sim/grid/**`, grid unit tests. Do not edit `tests/e2e/**`. Other modes off limits.

**Interfaces — Produces:**
```ts
// types.ts
Ent.elite?: boolean;
GridMap.spawns[n].elite?: boolean;
GridState.records: EngraveId[];          // seeded at newState: ['dash', 'rapid', 'chain', 'momentum']
// items.ts — a floor item
export interface Echo { kind: 'echo'; family: Family; name: '잔향' }
FloorItem.item: Equipment | Consumable | Core | Echo
// absorb.ts (new)
export type Family = 'melee' | 'ranged' | 'magic' | 'any' | 'all';
export const FAMILY: Record<FoeKind, Family>;   // minion, brute → melee; archer → ranged; mage → magic; ghoul → any; champion → all
export function absorbOffer(s: GridState, family: Family): EngraveId[];   // up to 3
export function record(s: GridState, t: number, id: EngraveId): void;     // adds to s.records once, emits 'record'
export const ELITE_MULT = 1.6;
```
New events: `'absorb'` (echo taken, `text` = family) and `'record'` (`text` = engraving id).

**Behaviour:**
1. **Elites in map generation**: on non-boss floors, after spawns are placed, mark 1 or 2 of the non-champion spawns `elite: true` using a **separate seed-derived rng stream** (e.g. `createRng((seed ^ 0x3e11a7) + floor * 6151)`) so the rest of the floor stays the same. Boss floors have no elites. (Hand-built test maps have none unless a test sets them.)
2. **Elite foes**: `makeFoe` (or where map spawns become foes in `state.ts`/`run.ts`) gives an elite `elite = true`, hp × `ELITE_MULT` and power × `ELITE_MULT` (damage scales through power as today). Elites give **×3 XP**.
3. **Echo on death**: when an elite dies (settle kills), drop `{ kind: 'echo', family: FAMILY[kind], name: '잔향' }` at its cell. A champion's death also drops an echo with family `'all'` (in addition to the stairs / energy source it already leaves). If the cell already holds an item, still push (items can share a cell).
4. **Absorbing**: walking onto an echo (`pickUp`) removes it, emits `absorb`, and pushes `absorbOffer(s, family)` onto `s.offers` (the same queue and 3-choice panel as level-ups; nothing is pushed if the offer is empty). No extra time beyond the step.
5. **`absorbOffer(s, family)`**: the pool is every engraving whose `fits` equals the family (for `'all'`: every engraving), minus those already on the suit. Pick up to **2 recorded** (in `s.records`) and **1 unrecorded**, using `s.rng`; if one side runs short, fill from the other; return at most 3, recorded first.
6. **Recording**: when an engraving is put on the suit through `choose` (level-up or absorb), call `record` — if it was not in `s.records`, add it and emit `record`.
7. Level-ups keep offering engravings for now (Task 5 changes that).
8. **Screen**:
   - Elites: a gold ring under the foe instead of the red one, a slightly larger model (×1.12), and the target card shows `정예 ` before the name (`gridHud.ts`).
   - Echo on the floor: a violet glowing wisp (e.g. emissive `#b48aff` sphere, bobbing) in `gridItems.ts`.
   - Log lines: `absorb` → `잔향을 흡수했다`; `record` → `새 각인 기록 — ${name}` (the engraving popup system may also show it). The 3-choice panel title for an absorb offer can stay generic (`각인 하나를 고르세요`) — tell level-up and absorb apart only if it is easy.

**Tests to write first** (new `tests/sim/grid/absorb.test.ts`):
- `FAMILY` mapping; `generateMap` gives 1–2 elites on non-boss floors and none on 5/10/15, and the same seed gives the same elites; adding elites does not change the floor's other spawns/chests/stairs versus the same map with elite flags ignored (compare positions and kinds).
- An elite foe has `round(base × 1.6)` hp at floor 1 and gives 3× XP.
- Killing an elite leaves an echo of its family; killing a champion leaves an `'all'` echo.
- Walking onto an echo pushes an offer of 3 with exactly 2 recorded and 1 unrecorded (set `s.records` to make it deterministic); none already on the suit.
- Short pools: with only 1 recorded in the family the offer is 1 recorded + 2 unrecorded; with everything recorded, 3 recorded.
- Choosing an unrecorded engraving records it (event `record`); choosing a recorded one emits no `record`.
- `newState` seeds the four starting records.

**Verify:** `npx tsc --noEmit -p .` · `npm run lint` · `npx vitest run` all pass.

### Task 5: Level-up suit upgrades and screens (outline)
- Level-up 3-choice of suit upgrades (max charge +2, hp +5, kill charge +1, evasion +3%p, gun damage +1, melee damage +1); HUD charge bar; suit panel in the bag; absorb choice reuses the level-up panel.

### Task 6: E2E, README, review, push
