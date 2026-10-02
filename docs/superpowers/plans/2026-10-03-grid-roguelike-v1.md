# Grid Roguelike v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the grid sortie prototype into a 3-floor roguelike: classes, picked-up weapon groups (melee/ranged half-half), explosives, four elements, new foes and a boss.

**Architecture:** Extend the deterministic grid sim (`src/sim/grid/*`) with a run layer (floors), gear (hands/bag/belt/classes), weapon-group rules, statuses/elements/explosives, new AI; replace the extraction rules. The view/UI gain element and explosion visuals, class select, bag panel, throw aiming and floor transitions. Existing engine, playback, chase, pixel pass, mannequin actors and controls are reused.

**Tech Stack:** TypeScript, three.js, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-grid-roguelike-v1-design.md`

## Global Constraints

- Sim stays deterministic: no DOM/three/`Math.random`/`Date.now` under `src/sim`; randomness only from `s.rng`. Same seed + class + action list → same run.
- Files ≤ 300 lines (`npm run lint`), layering core → data → sim → app → view/ui.
- Player text in Korean. Touch buttons ≥ 56 px where they fit (belt row ≥ 48 px on narrow portrait).
- Party extraction mode untouched. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Floor change keeps the hero, drops the floor** — HP/gear/level/statuses carry over; foes, fire/poison tiles, telegraphs, chests, seen/visible reset; no stale foe ids leak into targeting or playback.
2. **Status ticks and frozen turns cannot stall the scheduler** — a frozen hero still advances time (each `act` while frozen = forced wait), frozen foes skip but consume time; burning/poison deaths during foe turns resolve outcome once.
3. **Explosion chains terminate** — barrels exploding each other, fire igniting barrels, flasks on barrels: each barrel explodes once, no recursion blow-up, damage applied once per explosion per target.
4. **Weapon rules respect walls and corners** — spear 2nd cell, axe sweep cells, mace push target cell, throw landing: never through walls/closed doors or across a blocked diagonal corner.
5. **Bag/hands edge cases** — full bag drops to floor (never lost), equipping from bag with both hands full swaps cleanly, unequipping the last weapon leaves bash available, ammo 0 blocks bow/crossbow shots with a clear refusal.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/sim/grid/items.ts` | weapon groups, armor, consumables tables; `rollEquipment(rng, floor)`; `rollChest` |
| `src/sim/grid/gear.ts` | `Gear` (hands[2], active, bag[8], armor, belt), classes & kits, equip/swap/pickup/drop |
| `src/sim/grid/weapons.ts` | hero attack by weapon group (melee bump variants, ranged/staff shot, bash, throw) |
| `src/sim/grid/status.ts` | statuses (burn/freeze/poison), tile effects (fire/poison cloud), per-turn ticking, shock chain |
| `src/sim/grid/explosives.ts` | barrels, bombs, flasks, area resolution |
| `src/sim/grid/foes.ts` | foe table (minion/brute/ghoul/archer/mage/champion), floor scaling, spawn mix |
| `src/sim/grid/boss.ts` | champion: whirl telegraph every 3 turns, summon at 50% |
| `src/sim/grid/run.ts` | floors 1–3, stairs, victory/death, wanderers, XP/levels, run result |
| existing `types/state/actions/ai/clock/danger/gridSim/mapgen` | extended / extraction rules removed |
| `src/view/grid/gridElements.ts` | fire/poison tiles, explosions, frost tint, lightning, telegraph tiles, barrels, stairs |
| `src/ui/grid/classSelect.ts`, `gridBag.ts`, `gridAim.ts` | class cards, bag panel, throw/spell aim mode |
| existing `gridHud/gridTouch/gridScreen/gridResult/gridFlow` | extended |

---

### Task 1: Items, gear and classes

**Files:** Create `src/sim/grid/items.ts`, `src/sim/grid/gear.ts`; Modify `types.ts`, `state.ts`; Test `tests/sim/grid/gear.test.ts`

**Interfaces — Produces:**
```ts
export type WeaponGroup = 'dagger' | 'sword' | 'axe' | 'spear' | 'mace' | 'bow' | 'crossbow' | 'throwing' | 'staff';
export type Element = 'fire' | 'frost' | 'shock' | 'poison';
export interface Weapon { kind: 'weapon'; group: WeaponGroup; tier: 1 | 2; name: string; element?: Element /* staffs only */; loaded?: boolean; charges?: number; stack?: number }
export interface Armor { kind: 'armor'; tier: 1 | 2 | 3; name: string; reduce: number }
export type Equipment = Weapon | Armor;
export type BeltItem = 'potion' | 'bomb' | 'fireFlask' | 'frostFlask' | 'shockFlask' | 'poisonFlask';
export type ClassId = 'warrior' | 'hunter' | 'mage';
export interface Gear { hands: [Weapon | null, Weapon | null]; active: 0 | 1; bag: Equipment[]; armor: Armor | null; belt: Record<BeltItem, number>; arrows: number; cls: ClassId }
export const WEAPONS: Record<WeaponGroup, { melee: boolean; dmg: [[number, number], [number, number]]; hit: number; time: number; range?: number; reload?: number }>;
export const STAFF_DMG: Record<Element, [[number, number], [number, number]]>;
export const BAG_SIZE = 8;
export function makeWeapon(group: WeaponGroup, tier: 1 | 2, element?: Element): Weapon;
export function rollEquipment(rng: Rng, floor: number): Equipment;   // half melee / half ranged groups; tier 2 chance 10/35/60%
export function startGear(cls: ClassId): Gear;
export const CLASS_BONUS: Record<ClassId, { meleeDmg: number; maxHp: number; rangedHit: number; reload: number; charges: number; recharge: number; statusTurns: number }>;
export function activeWeapon(g: Gear): Weapon | null;
export function swapHands(g: Gear): void;
export function equipFromBag(g: Gear, bagIndex: number): boolean;     // into active hand; old → bag
export function wearFromBag(g: Gear, bagIndex: number): boolean;
export function addToBag(g: Gear, e: Equipment): boolean;             // false when full
```
- Hero gains `gear: Gear`; `newState(map, seed, cls = 'warrior', floor = 1)`; hero maxHp = 30 + class bonus.
- [ ] Tests: each class start kit and bonus (warrior sword+crossbow+leather+2 potions+10 arrows, maxHp 40; hunter bow+dagger+20 arrows; mage fire staff (charges 4) + dagger + fire/frost flask); `rollEquipment` over 400 rolls is ~50% melee (40–60%), tier-2 share grows with floor; `swapHands` toggles active; `equipFromBag` puts bag item in the active hand and the old weapon into the bag; `wearFromBag` swaps armor; `addToBag` refuses at 8.
- [ ] Implement; `npx vitest run tests/sim/grid/gear.test.ts` → PASS; commit `sim(grid): items, gear, classes`.

### Task 2: Hero actions with weapon groups

**Files:** Create `src/sim/grid/weapons.ts`; Modify `actions.ts`, `types.ts` (GAction), `combat.ts`; Test `tests/sim/grid/weapons.test.ts`

**Interfaces:**
```ts
export type GAction =
  | { kind: 'move'; dir: Cell } | { kind: 'shoot'; target?: string } | { kind: 'reload' } | { kind: 'wait' }
  | { kind: 'swap' } | { kind: 'equip'; bag: number } | { kind: 'wear'; bag: number } | { kind: 'drop'; bag: number }
  | { kind: 'use'; item: BeltItem; at?: Cell };
// weapons.ts
export function meleeAttack(s: GridState, t: number, dir: Cell, foe: Ent): number;  // returns time cost
export function rangedAttack(s: GridState, t: number, target: Ent): number | null;
export function bash(s: GridState, t: number, foe: Ent): number;
```
- Bump with melee active → group rule; with ranged active → bash 2–4 (time 1). Dagger time 0.7 and ×3 on asleep/unaware (`!foe.awake`), others ×2. Axe hits front + both side-diagonals of the bump direction (only foes, through no walls). Spear: bump target plus the cell beyond if walkable line (if the first cell is empty and the second has a foe, `move` toward an empty cell whose next cell holds a foe attacks instead of moving — "reach"). Mace: push 1 away if free (floor, no body/chest); if blocked by wall/foe → +3 damage and `stun` 1 turn.
- Shoot with bow/crossbow: needs `loaded` and arrows > 0 (else refused); reload time 0.5 / 1.5 (×0.75 hunter). Throwing: no reload, stack −1, the dagger lands on the target cell (hit) or the cell behind/at target (miss) as a floor item `throwing` stack 1 that `move` onto picks up (merges into hand stack if same group/tier, else bag). Staff: needs charges > 0; −1 charge; element effect delegated to Task 3 (`applyElement` stub returns nothing yet); recharge 1 per 8 turns (×2 mage) handled in `afterTurn`.
- Damage: weapon tier dmg + level bonus + class melee bonus (×1.2), minus target armor (foes 0), min 1. Hit chance: weapon hit (+0.1 hunter ranged) with existing distance/cover rules.
- `swap` 0.5, `equip` 1, `wear` 1, `drop` 0.5 (drops to floor under hero), refusals cost nothing.
- Floor items: `GridState.floorItems: { pos: Cell; item: Equipment | { kind: 'throwing'; ... } }[]`; stepping onto picks up (bag full → stays, event `full`).
- [ ] Tests: dagger ×3 on a sleeping foe and time 0.7; axe hits three foes in the arc, not the one behind the hero; spear hits two in a line and reaches over an empty cell; spear never reaches through a wall/corner; mace pushes a foe one cell, slams into a wall for +3 and stun (stunned foe skips its next turn); bow reload 0.5, crossbow 1.5, hunter ×0.75; no arrows → shoot refused; throwing dagger leaves a pickup that returns to the stack; staff charges drop and recharge after 8 turns (4 for mage); bash with a ranged weapon in hand; swap/equip/wear/drop costs; armor reduces foe hits (min 1).
- [ ] Implement; tests PASS; commit `sim(grid): weapon groups and gear actions`.

### Task 3: Statuses, elements, explosives

**Files:** Create `src/sim/grid/status.ts`, `src/sim/grid/explosives.ts`; Modify `actions.ts` (use item), `weapons.ts` (staff), `mapgen.ts` (barrels), `gridSim.ts` (tick); Test `tests/sim/grid/elements.test.ts`

**Interfaces:**
```ts
export interface Statuses { burn: number; freeze: number; poison: number; stun: number }   // on Ent (default zeros)
export interface TileFx { pos: Cell; kind: 'fire' | 'poison'; turns: number }               // GridState.tiles
export function applyElement(s: GridState, t: number, el: Element, at: Cell, radius: number, dmg: [number, number] | null, src: string): void;
export function tickStatuses(s: GridState, e: Ent, t: number): void;    // at the start of that entity's turn
export function tickTiles(s: GridState): void;                           // once per hero turn (time step)
export function explodeBarrel(s: GridState, t: number, at: Cell, src: string): void;
// GridState.barrels: Cell[]
```
- Burn 3 turns × 2 dmg; freeze 2 turns (turn passes, no action; hero `act` while frozen performs a forced wait and returns events); poison 6 turns × 1 (re-apply adds); shock: target damage + 50% to each foe adjacent to it (once); mage class +1 status turn.
- Fire tile 4 turns (enter/stand → burn 3); poison cloud 3 turns (enter/stand → poison +3).
- Barrels block movement and shots like a body; any hit (melee/shot/explosion/fire tile) explodes once: radius 1, 6–9 dmg, fire tiles on floor cells in radius; adjacent barrels chain (iterative queue, each once).
- Belt `use`: potion heals 12; bomb (range 6, r1, 8–12); flasks (range 6, r1): fire 4–7 + burn, frost 3–5 + freeze, shock 5–8 + chain, poison cloud. `at` must be visible, in range, line clear (throw arcs over bodies but not walls).
- Mapgen: 0–2 barrels per room (not on doors/paths blocking: not in corridors, not adjacent to doors), deterministic.
- [ ] Tests: burn ticks 2×3 then ends; frozen foe skips two turns; hero frozen: `act({kind:'move'})` → forced wait, time advances; poison stacks; shock chains to adjacent only; fire tile burns on entry and expires after 4; poison cloud; barrel explosion radius/damage, fire tiles, chain of three barrels each once; shooting a barrel explodes it; bomb and four flasks; out-of-range/blocked throw refused; foe death from burn during its turn ends cleanly; hero death from poison → outcome `dead` once.
- [ ] Implement; tests PASS; commit `sim(grid): statuses, elements, explosives`.

### Task 4: Foes, boss, floors

**Files:** Create `src/sim/grid/foes.ts`, `src/sim/grid/boss.ts`, `src/sim/grid/run.ts`; Modify `ai.ts`, `mapgen.ts` (stairs, boss room, spawn mix), `danger.ts` (remove extraction; wanderers), `gridSim.ts`, `state.ts`; Test `tests/sim/grid/run.test.ts`

**Interfaces:**
```ts
export type FoeKind = 'minion' | 'brute' | 'ghoul' | 'archer' | 'mage' | 'champion';
export const FOE_TABLE: Record<FoeKind, { hp: number; move: number; dmg: [number, number]; hit: number; range: number; xp: number }>;
export function scaleFoe(kind: FoeKind, floor: number): { hp: number; dmg: [number, number] };   // +25%/floor beyond 1
export function spawnKind(rng: Rng, floor: number): FoeKind;   // minion 45, brute 20, ghoul 15, archer 12, mage 8 (floor ≥ 2; else re-roll)
export interface Telegraph { cells: Cell[]; src: string; el?: Element; dmg: [number, number]; at: number }   // GridState.telegraphs
export interface RunState { floor: number; kills: number; turns: number; won: boolean }   // GridState.run
export function nextFloor(s: GridState): void;     // keeps hero (pos → new start), new map seed(seed, floor)
export const XP_STEPS = [10, 25, 45, 70, 100];
```
- Mage: keeps 3–6 like archer; casts a fire or frost area (radius 1 around hero's current cell) as a telegraph (event `telegraph`), resolving at the mage's next turn on those cells (dodge by leaving them); mage killed → telegraph removed.
- Ghoul: move cost 0.7, melee.
- Champion (floor 3, farthest room, awake when seen): melee 8–12; every 3rd turn telegraphs whirl on its 8 neighbours, resolving next turn; at ≤ 50% HP once summons 2 minions adjacent.
- Floors: map from `generateMap(seed * 31 + floor)`; floors 1–2 place `stairs` at the farthest room centre (tile `stairs`, walkable) — stepping on it → `nextFloor` + event `floor`; floor 3: no stairs, champion; champion death → `run.won`, outcome `won`, event `victory`.
- Remove exits/extraction/alarm/reinforce/exit collapse; wanderers: every 150 turns on a floor, 1–2 minions spawn out of sight ≥ 10 tiles.
- XP per kill (table), level-ups at `XP_STEPS`: maxHp +5, heal 5, dmg +1, event `levelUp`.
- [ ] Tests: stairs → floor 2 with hero hp/gear/level kept, new map, no old foes/tiles/telegraphs; floor 3 has a champion and no stairs; killing it → outcome `won`; mage telegraph hits next turn, stepping out avoids it; ghoul moves ~10 times per 7 hero waits; champion whirl telegraph and one-time summon; spawn mix over 2000 rolls: ranged (archer+mage) 15–25% on floor 2; no mage on floor 1; floor scaling; wanderers at 150 turns; XP/level-up; determinism across a floor change.
- [ ] Implement; tests PASS; commit `sim(grid): foes, boss and three floors`.

### Task 5: View — elements, explosions, gear look

**Files:** Create `src/view/grid/gridElements.ts`; Modify `gridRuntime.ts`, `gridActors.ts`, `ualActor.ts`, `gridTerrain.ts` (stairs, barrels, rebuild on floor change)
- Fire tiles: flickering flame clusters; poison: green translucent cloud boxes; frost: actor blue tint while frozen; shock: zigzag line to chained targets; explosion: expanding fireball sphere + sparks + bone/wood chips + shake; telegraph cells: pulsing red/blue floor squares; barrels (env `dungeon/barrel`); stairs: dark square with steps + glow; floor change: runtime `setFloor(sim)` rebuilds terrain/torches/actors with a 0.4 s fade (DOM overlay) and "N층" banner.
- Hero's block weapon follows the active weapon group (sword/axe/spear/mace/dagger/bow/crossbow/throwing/staff shapes); foes by kind (ghoul hunched/green, mage with staff, champion big/gold trim).
- [ ] Verify: `npx tsc --noEmit -p .`, `npm run lint`, Playwright screenshots (explosion, fire, poison, telegraph, stairs, floor banner); commit `view(grid): elements, explosions, barrels, stairs, floor change, weapon looks`.

### Task 6: UI — class select, HUD, bag, aiming, result

**Files:** Create `src/ui/grid/classSelect.ts`, `gridBag.ts`, `gridAim.ts`; Modify `gridHud.ts`, `gridTouch.ts`, `gridControls.ts`, `gridScreen.ts`, `gridResult.ts`, `gridFlow.ts`, `src/ui/run/titleScreen.ts` (label `격자 던전 (시험)`), `grid.css`
- Class select (3 cards, `data-testid="class-warrior|hunter|mage"`) → run. HUD: floor `n/3`, level + XP bar, HP, hands (two chips, active highlighted, loaded/charges, tap = swap, `data-testid="grid-hands"`), arrows, belt buttons (`grid-use-<item>`, count, dimmed at 0), status icons, bag button (`grid-bag`).
- Bag panel: 8 slots + armor + hands; selecting shows stats vs current; buttons 손에 들기 / 입기 / 버리기 (actions `equip`/`wear`/`drop`), close.
- Aim mode (`gridAim`): from a belt item or staff shot: highlights range cells, tap/arrow keys move the reticle, preview radius, confirm (fire button/Enter/F), cancel (Esc/✕). Staff shots aim like flasks (radius 1 for fire/poison).
- Keys: `X` swap, `I`/`B` bag, `2`–`7` belt items (1 = potion), Enter/F confirm, Esc cancel. Pad: LB/RB still target, Y potion, D-pad left = swap.
- Result: victory/death, floor reached, kills, level, turns; record `projr.grid.v1` `{ best, wins }`.
- Debug hook adds `run()`, `toStairs()` (walk path to stairs), `cls`.
- [ ] Verify: tsc, lint, build, screenshots portrait/landscape (class select, HUD, bag, aim). Commit `ui(grid): class select, gear HUD, bag, aiming, results`.

### Task 7: E2E, README, push

**Files:** Modify `tests/e2e/grid.spec.ts`, `README.md`
- [ ] e2e: title → 격자 던전 → pick warrior → `toStairs` → banner "2층" and `state().run.floor === 2` → open bag → use a flask via aim mode (or hook `act({kind:'use'})`) → force death → result shows floor 2 → 다시 → class select. Portrait: hands/belt/bag buttons ≥ 48 px. Console errors 0.
- [ ] README section rewritten for the dungeon; full `npx vitest run`, `npm run lint`, `npm run build`, `npx playwright test` green; commit; final review; push main; verify CI.
